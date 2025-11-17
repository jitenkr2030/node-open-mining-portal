import EventEmitter from 'events';
import redisClient from '../../database/redis/client.js';
import logger from '../../utils/logger.js';

/**
 * Modern Share Processor
 * Handles share validation, storage, and round management
 */
class ShareProcessor extends EventEmitter {
  constructor(poolName, poolConfig) {
    super();
    this.poolName = poolName;
    this.poolConfig = poolConfig;
    this.currentRound = null;
  }

  /**
   * Initialize share processor
   */
  async initialize() {
    try {
      await this.loadCurrentRound();
      logger.system('ShareProcessor', `Initialized for pool ${this.poolName}`);
    } catch (error) {
      logger.error('Failed to initialize ShareProcessor:', error);
      throw error;
    }
  }

  /**
   * Load current mining round
   */
  async loadCurrentRound() {
    const roundKey = `${this.poolName}:current_round`;
    const roundData = await redisClient.get(roundKey);
    
    if (roundData) {
      this.currentRound = JSON.parse(roundData);
    } else {
      this.currentRound = {
        height: 0,
        startTime: Date.now(),
        shares: {}
      };
      await this.saveCurrentRound();
    }
  }

  /**
   * Save current round to Redis
   */
  async saveCurrentRound() {
    const roundKey = `${this.poolName}:current_round`;
    await redisClient.set(roundKey, JSON.stringify(this.currentRound));
  }

  /**
   * Process a submitted share
   */
  async processShare(client, share, isValid, isBlock = false, blockData = null) {
    const timestamp = Date.now();
    
    try {
      if (isValid) {
        await this.handleValidShare(client, share, timestamp, isBlock, blockData);
      } else {
        await this.handleInvalidShare(client, share, timestamp);
      }

      // Update statistics
      await this.updateStats(client, isValid, isBlock);

    } catch (error) {
      logger.error('Error processing share:', {
        worker: client.worker,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle valid share submission
   */
  async handleValidShare(client, share, timestamp, isBlock, blockData) {
    const shareKey = `${this.poolName}:shares:round_${this.currentRound.height}`;
    const workerKey = `${this.poolName}:workers:${client.worker}`;

    // Increment share count for this worker
    const difficulty = share.difficulty || client.difficulty;
    await redisClient.hIncrBy(shareKey, client.worker, difficulty);

    // Update worker stats
    await redisClient.hSet(workerKey, 'lastShare', timestamp.toString());
    await redisClient.hIncrBy(workerKey, 'validShares', 1);

    // Store share in time-series for hashrate calculation
    const hashrateKey = `${this.poolName}:hashrate:${client.worker}`;
    await redisClient.zAdd(hashrateKey, timestamp, `${timestamp}:${difficulty}`);
    await redisClient.expire(hashrateKey, 3600); // Keep 1 hour

    logger.debug('Valid share processed', {
      pool: this.poolName,
      worker: client.worker,
      difficulty,
      isBlock
    });

    if (isBlock) {
      await this.handleBlockFound(client, share, blockData);
    }

    this.emit('share.valid', {
      pool: this.poolName,
      worker: client.worker,
      difficulty,
      isBlock,
      timestamp
    });
  }

  /**
   * Handle invalid share submission
   */
  async handleInvalidShare(client, share, timestamp) {
    const workerKey = `${this.poolName}:workers:${client.worker}`;
    
    await redisClient.hIncrBy(workerKey, 'invalidShares', 1);

    logger.warn('Invalid share', {
      pool: this.poolName,
      worker: client.worker,
      jobId: share.jobId
    });

    this.emit('share.invalid', {
      pool: this.poolName,
      worker: client.worker,
      timestamp
    });
  }

  /**
   * Handle block found
   */
  async handleBlockFound(client, share, blockData) {
    const blockKey = `${this.poolName}:blocks:pending`;
    
    const block = {
      height: blockData.height,
      hash: blockData.hash,
      reward: blockData.reward,
      difficulty: blockData.difficulty,
      worker: client.worker,
      timestamp: Date.now(),
      shares: { ...this.currentRound.shares },
      confirmations: 0,
      status: 'pending'
    };

    // Store block
    await redisClient.hSet(blockKey, block.hash, JSON.stringify(block));

    logger.system('BlockFound', `Block found by ${client.worker}`, {
      pool: this.poolName,
      height: block.height,
      hash: block.hash,
      reward: block.reward
    });

    // Start new round
    await this.startNewRound(blockData.height + 1);

    this.emit('block.found', block);
  }

  /**
   * Start a new mining round
   */
  async startNewRound(height) {
    // Save previous round
    const previousRoundKey = `${this.poolName}:rounds:${this.currentRound.height}`;
    await redisClient.set(previousRoundKey, JSON.stringify(this.currentRound));

    // Start new round
    this.currentRound = {
      height,
      startTime: Date.now(),
      shares: {}
    };

    await this.saveCurrentRound();

    logger.system('ShareProcessor', `Started new round at height ${height}`, {
      pool: this.poolName
    });

    this.emit('round.new', { height, pool: this.poolName });
  }

  /**
   * Handle orphaned block
   */
  async handleOrphanedBlock(blockHash) {
    const blockKey = `${this.poolName}:blocks:pending`;
    const blockData = await redisClient.hGet(blockKey, blockHash);

    if (!blockData) {
      logger.warn('Orphaned block not found in pending blocks', { blockHash });
      return;
    }

    const block = JSON.parse(blockData);
    block.status = 'orphaned';

    // Move to orphaned blocks
    await redisClient.hDel(blockKey, blockHash);
    await redisClient.hSet(`${this.poolName}:blocks:orphaned`, blockHash, JSON.stringify(block));

    // Merge shares back into current round
    for (const [worker, shares] of Object.entries(block.shares)) {
      await redisClient.hIncrBy(
        `${this.poolName}:shares:round_${this.currentRound.height}`,
        worker,
        shares
      );
    }

    logger.warn('Block orphaned, shares merged to current round', {
      pool: this.poolName,
      blockHash,
      height: block.height
    });

    this.emit('block.orphaned', block);
  }

  /**
   * Confirm a block
   */
  async confirmBlock(blockHash, confirmations) {
    const blockKey = `${this.poolName}:blocks:pending`;
    const blockData = await redisClient.hGet(blockKey, blockHash);

    if (!blockData) {
      return;
    }

    const block = JSON.parse(blockData);
    block.confirmations = confirmations;

    if (confirmations >= this.poolConfig.confirmations) {
      block.status = 'confirmed';
      
      // Move to confirmed blocks
      await redisClient.hDel(blockKey, blockHash);
      await redisClient.hSet(`${this.poolName}:blocks:confirmed`, blockHash, JSON.stringify(block));

      logger.system('BlockConfirmed', `Block confirmed`, {
        pool: this.poolName,
        height: block.height,
        hash: blockHash,
        confirmations
      });

      this.emit('block.confirmed', block);
    } else {
      await redisClient.hSet(blockKey, blockHash, JSON.stringify(block));
    }
  }

  /**
   * Update pool and worker statistics
   */
  async updateStats(client, isValid, isBlock) {
    const poolStatsKey = `${this.poolName}:stats`;
    const timestamp = Date.now();

    // Update pool stats
    await redisClient.hIncrBy(poolStatsKey, isValid ? 'validShares' : 'invalidShares', 1);
    await redisClient.hSet(poolStatsKey, 'lastUpdate', timestamp.toString());

    if (isBlock) {
      await redisClient.hIncrBy(poolStatsKey, 'blocksFound', 1);
    }
  }

  /**
   * Calculate worker hashrate
   */
  async calculateHashrate(worker, timeWindow = 300) {
    const hashrateKey = `${this.poolName}:hashrate:${worker}`;
    const now = Date.now();
    const since = now - (timeWindow * 1000);

    // Get shares in time window
    const shares = await redisClient.zRangeByScore(hashrateKey, since, now);

    if (shares.length === 0) {
      return 0;
    }

    let totalDifficulty = 0;
    for (const share of shares) {
      const [, difficulty] = share.split(':');
      totalDifficulty += parseInt(difficulty, 10);
    }

    // Hashrate = (total difficulty * 2^32) / time window
    const hashrate = (totalDifficulty * Math.pow(2, 32)) / timeWindow;

    return hashrate;
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(worker) {
    const workerKey = `${this.poolName}:workers:${worker}`;
    const stats = await redisClient.hGetAll(workerKey);

    if (!stats || Object.keys(stats).length === 0) {
      return null;
    }

    const hashrate = await this.calculateHashrate(worker);

    return {
      worker,
      validShares: parseInt(stats.validShares || 0, 10),
      invalidShares: parseInt(stats.invalidShares || 0, 10),
      lastShare: parseInt(stats.lastShare || 0, 10),
      hashrate,
      efficiency: this.calculateEfficiency(stats)
    };
  }

  /**
   * Calculate worker efficiency
   */
  calculateEfficiency(stats) {
    const valid = parseInt(stats.validShares || 0, 10);
    const invalid = parseInt(stats.invalidShares || 0, 10);
    const total = valid + invalid;

    if (total === 0) return 100;

    return ((valid / total) * 100).toFixed(2);
  }

  /**
   * Get round information
   */
  async getRoundInfo() {
    const shareKey = `${this.poolName}:shares:round_${this.currentRound.height}`;
    const shares = await redisClient.hGetAll(shareKey);

    return {
      height: this.currentRound.height,
      startTime: this.currentRound.startTime,
      duration: Date.now() - this.currentRound.startTime,
      shares: shares || {},
      totalShares: Object.values(shares || {}).reduce((sum, val) => sum + parseInt(val, 10), 0)
    };
  }

  /**
   * Clean up old data
   */
  async cleanup() {
    const now = Date.now();
    const retentionPeriod = 86400000; // 24 hours

    // Clean up old hashrate data
    const workers = await redisClient.keys(`${this.poolName}:hashrate:*`);
    
    for (const key of workers) {
      await redisClient.zRemRangeByScore(key, 0, now - retentionPeriod);
    }

    logger.debug('Share processor cleanup completed', { pool: this.poolName });
  }
}

export default ShareProcessor;
