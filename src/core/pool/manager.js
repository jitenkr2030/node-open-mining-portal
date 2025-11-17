import EventEmitter from 'events';
import StratumServer from '../stratum/server.js';
import ShareProcessor from '../../services/share/processor.js';
import PaymentProcessor from '../../services/payment/processor.js';
import logger from '../../utils/logger.js';

/**
 * Pool Manager
 * Manages individual mining pool lifecycle
 */
class PoolManager extends EventEmitter {
  constructor(poolName, poolConfig) {
    super();
    this.poolName = poolName;
    this.poolConfig = poolConfig;
    this.stratumServers = new Map();
    this.shareProcessor = null;
    this.paymentProcessor = null;
    this.isRunning = false;
    this.stats = {
      startTime: null,
      workers: new Map(),
      blocks: {
        pending: 0,
        confirmed: 0,
        orphaned: 0
      }
    };
  }

  /**
   * Initialize and start the pool
   */
  async start() {
    try {
      logger.system('PoolManager', `Starting pool: ${this.poolName}`);

      // Initialize share processor
      this.shareProcessor = new ShareProcessor(this.poolName, this.poolConfig);
      await this.shareProcessor.initialize();

      // Setup share processor events
      this.setupShareProcessorEvents();

      // Initialize payment processor if enabled
      if (this.poolConfig.paymentProcessing?.enabled) {
        this.paymentProcessor = new PaymentProcessor(
          this.poolName,
          this.poolConfig,
          null // Daemon client would be injected here
        );
        await this.paymentProcessor.start();
      }

      // Start stratum servers for each port
      await this.startStratumServers();

      this.isRunning = true;
      this.stats.startTime = Date.now();

      logger.system('PoolManager', `Pool ${this.poolName} started successfully`, {
        coin: this.poolConfig.coin.name,
        algorithm: this.poolConfig.coin.algorithm,
        ports: Array.from(this.stratumServers.keys())
      });

      this.emit('started');

    } catch (error) {
      logger.error(`Failed to start pool ${this.poolName}:`, error);
      throw error;
    }
  }

  /**
   * Start stratum servers for all configured ports
   */
  async startStratumServers() {
    const ports = this.poolConfig.ports || {};

    for (const [port, portConfig] of Object.entries(ports)) {
      try {
        const server = new StratumServer({
          port: parseInt(port, 10),
          difficulty: portConfig.diff,
          varDiff: portConfig.varDiff,
          maxConnections: this.poolConfig.maxConnections || 10000,
          connectionTimeout: this.poolConfig.connectionTimeout || 600,
          banning: this.poolConfig.banning
        });

        // Setup server event handlers
        this.setupStratumServerEvents(server);

        await server.start();
        this.stratumServers.set(port, server);

        logger.system('PoolManager', `Stratum server started on port ${port}`, {
          pool: this.poolName,
          difficulty: portConfig.diff,
          varDiff: !!portConfig.varDiff
        });

      } catch (error) {
        logger.error(`Failed to start stratum server on port ${port}:`, error);
        throw error;
      }
    }
  }

  /**
   * Setup stratum server event handlers
   */
  setupStratumServerEvents(server) {
    server.on('client.connected', (client) => {
      logger.stratum('Client connected', {
        pool: this.poolName,
        clientId: client.id,
        ip: client.ip
      });
      this.emit('client.connected', client);
    });

    server.on('client.disconnected', (client) => {
      logger.stratum('Client disconnected', {
        pool: this.poolName,
        clientId: client.id,
        duration: Date.now() - client.connectedAt
      });
      
      this.stats.workers.delete(client.worker);
      this.emit('client.disconnected', client);
    });

    server.on('client.authorized', (client) => {
      logger.stratum('Client authorized', {
        pool: this.poolName,
        worker: client.worker
      });

      this.stats.workers.set(client.worker, {
        connectedAt: Date.now(),
        difficulty: client.difficulty
      });

      this.emit('client.authorized', client);
    });

    server.on('client.share', async (client, share, callback) => {
      try {
        // Validate share (simplified - real implementation would verify POW)
        const isValid = await this.validateShare(client, share);
        const isBlock = false; // Would check if share meets network difficulty
        const blockData = null;

        // Process share
        await this.shareProcessor.processShare(
          client,
          share,
          isValid,
          isBlock,
          blockData
        );

        callback(isValid, isValid ? null : 'Invalid share');

      } catch (error) {
        logger.error('Error processing share:', error);
        callback(false, 'Internal error');
      }
    });

    server.on('ip.banned', (ip, duration) => {
      logger.warn('IP banned', {
        pool: this.poolName,
        ip,
        duration
      });
      this.emit('ip.banned', ip, duration);
    });

    server.on('error', (error) => {
      logger.error('Stratum server error:', {
        pool: this.poolName,
        error: error.message
      });
      this.emit('error', error);
    });
  }

  /**
   * Setup share processor event handlers
   */
  setupShareProcessorEvents() {
    this.shareProcessor.on('block.found', (block) => {
      this.stats.blocks.pending++;
      logger.system('PoolManager', `Block found!`, {
        pool: this.poolName,
        height: block.height,
        hash: block.hash
      });
      this.emit('block.found', block);
    });

    this.shareProcessor.on('block.confirmed', (block) => {
      this.stats.blocks.pending--;
      this.stats.blocks.confirmed++;
      logger.system('PoolManager', `Block confirmed`, {
        pool: this.poolName,
        height: block.height
      });
      this.emit('block.confirmed', block);
    });

    this.shareProcessor.on('block.orphaned', (block) => {
      this.stats.blocks.pending--;
      this.stats.blocks.orphaned++;
      logger.warn('Block orphaned', {
        pool: this.poolName,
        height: block.height
      });
      this.emit('block.orphaned', block);
    });
  }

  /**
   * Validate share (simplified version)
   */
  async validateShare(client, share) {
    // Real implementation would:
    // 1. Verify job ID exists and is recent
    // 2. Check for duplicate shares
    // 3. Verify proof of work
    // 4. Check if share meets difficulty
    
    // For now, simple validation
    return share.jobId && share.nonce && share.nTime && share.extraNonce2;
  }

  /**
   * Stop the pool
   */
  async stop() {
    try {
      logger.system('PoolManager', `Stopping pool: ${this.poolName}`);

      // Stop payment processor
      if (this.paymentProcessor) {
        await this.paymentProcessor.stop();
      }

      // Stop all stratum servers
      for (const [port, server] of this.stratumServers) {
        await server.stop();
        logger.system('PoolManager', `Stopped stratum server on port ${port}`);
      }

      this.isRunning = false;
      this.emit('stopped');

      logger.system('PoolManager', `Pool ${this.poolName} stopped`);

    } catch (error) {
      logger.error(`Error stopping pool ${this.poolName}:`, error);
      throw error;
    }
  }

  /**
   * Get pool statistics
   */
  async getStats() {
    const stats = {
      pool: this.poolName,
      coin: this.poolConfig.coin.name,
      algorithm: this.poolConfig.coin.algorithm,
      isRunning: this.isRunning,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
      workers: {
        connected: this.stats.workers.size,
        list: Array.from(this.stats.workers.entries()).map(([worker, data]) => ({
          worker,
          ...data
        }))
      },
      blocks: this.stats.blocks,
      ports: {}
    };

    // Get port-specific stats
    for (const [port, server] of this.stratumServers) {
      stats.ports[port] = server.getStats();
    }

    // Get round info from share processor
    if (this.shareProcessor) {
      stats.round = await this.shareProcessor.getRoundInfo();
    }

    // Get payment stats if available
    if (this.paymentProcessor) {
      stats.payments = await this.paymentProcessor.getPaymentStats();
    }

    return stats;
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(workerAddress) {
    const stats = {};

    if (this.shareProcessor) {
      stats.shares = await this.shareProcessor.getWorkerStats(workerAddress);
    }

    if (this.paymentProcessor) {
      stats.balance = await this.paymentProcessor.getWorkerBalance(workerAddress);
      stats.payments = await this.paymentProcessor.getWorkerPaymentHistory(workerAddress);
    }

    stats.connected = this.stats.workers.has(workerAddress);

    return stats;
  }

  /**
   * Broadcast new work to all connected miners
   */
  broadcastWork(jobData) {
    for (const server of this.stratumServers.values()) {
      server.broadcast({
        id: null,
        method: 'mining.notify',
        params: jobData
      });
    }
  }

  /**
   * Get pool name
   */
  getName() {
    return this.poolName;
  }

  /**
   * Check if pool is running
   */
  isActive() {
    return this.isRunning;
  }
}

export default PoolManager;
