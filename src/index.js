import cluster from 'cluster';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import config from './config/index.js';
import logger from './utils/logger.js';
import redisClient from './database/redis/client.js';
import mysqlClient from './database/mysql/client.js';
import PoolManager from './core/pool/manager.js';
import { createAPIServer, startAPIServer } from './api/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * NOMP v2 - Modern Mining Pool
 * Enterprise-grade cryptocurrency mining pool software
 */
class NOMPv2 {
  constructor() {
    this.poolManagers = new Map();
    this.apiServer = null;
    this.isRunning = false;
  }

  /**
   * Initialize the mining pool system
   */
  async initialize() {
    try {
      logger.system('NOMP', '╔════════════════════════════════════════╗');
      logger.system('NOMP', '║   NOMP v2 - Modern Mining Pool       ║');
      logger.system('NOMP', '║   Enterprise Edition                  ║');
      logger.system('NOMP', '╚════════════════════════════════════════╝');
      logger.system('NOMP', 'Initializing system...');

      // Connect to databases
      await this.connectDatabases();

      // Load pool configurations
      const poolConfigs = await this.loadPoolConfigs();

      // Initialize pools
      await this.initializePools(poolConfigs);

      // Start API server
      await this.startAPI();

      this.isRunning = true;

      logger.system('NOMP', '✓ System initialized successfully', {
        pools: this.poolManagers.size,
        workers: config.clustering.workers
      });

    } catch (error) {
      logger.error('Failed to initialize NOMP:', error);
      throw error;
    }
  }

  /**
   * Connect to databases
   */
  async connectDatabases() {
    logger.system('NOMP', 'Connecting to databases...');

    // Connect to Redis
    await redisClient.connect();

    // Connect to MySQL if configured
    if (config.mysql) {
      await mysqlClient.connect();
    }

    logger.system('NOMP', '✓ Database connections established');
  }

  /**
   * Load pool configurations
   */
  async loadPoolConfigs() {
    const configDir = join(__dirname, '..', 'config', 'pools');
    const coinDir = join(__dirname, '..', 'config', 'coins');

    if (!existsSync(configDir)) {
      logger.warn('Pool config directory not found, no pools will be started');
      return {};
    }

    const poolConfigs = {};
    const fs = await import('fs/promises');
    const files = await fs.readdir(configDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const poolConfigPath = join(configDir, file);
        const poolConfig = JSON.parse(readFileSync(poolConfigPath, 'utf8'));

        if (!poolConfig.enabled) {
          logger.debug(`Pool ${file} is disabled, skipping`);
          continue;
        }

        // Load coin configuration
        const coinConfigPath = join(coinDir, poolConfig.coin);
        if (!existsSync(coinConfigPath)) {
          logger.error(`Coin config not found: ${poolConfig.coin}`);
          continue;
        }

        const coinConfig = JSON.parse(readFileSync(coinConfigPath, 'utf8'));
        poolConfig.coin = coinConfig;

        poolConfigs[poolConfig.name || file.replace('.json', '')] = poolConfig;

        logger.debug(`Loaded pool config: ${file}`);

      } catch (error) {
        logger.error(`Error loading pool config ${file}:`, error);
      }
    }

    return poolConfigs;
  }

  /**
   * Initialize pool managers
   */
  async initializePools(poolConfigs) {
    logger.system('NOMP', `Initializing ${Object.keys(poolConfigs).length} pool(s)...`);

    for (const [poolName, poolConfig] of Object.entries(poolConfigs)) {
      try {
        const manager = new PoolManager(poolName, poolConfig);
        
        // Setup event handlers
        this.setupPoolEvents(manager);

        // Start pool
        await manager.start();

        this.poolManagers.set(poolName, manager);

        logger.system('NOMP', `✓ Pool ${poolName} initialized`, {
          coin: poolConfig.coin.name,
          algorithm: poolConfig.coin.algorithm
        });

      } catch (error) {
        logger.error(`Failed to initialize pool ${poolName}:`, error);
      }
    }

    if (this.poolManagers.size === 0) {
      logger.warn('No pools were initialized!');
    }
  }

  /**
   * Setup pool event handlers
   */
  setupPoolEvents(manager) {
    manager.on('block.found', (block) => {
      logger.system('BlockFound', `🎉 Block found on ${manager.getName()}!`, {
        height: block.height,
        hash: block.hash,
        worker: block.worker
      });
    });

    manager.on('block.confirmed', (block) => {
      logger.system('BlockConfirmed', `✓ Block confirmed on ${manager.getName()}`, {
        height: block.height
      });
    });

    manager.on('error', (error) => {
      logger.error(`Pool ${manager.getName()} error:`, error);
    });
  }

  /**
   * Start API server
   */
  async startAPI() {
    logger.system('NOMP', 'Starting API server...');

    const app = createAPIServer(this.poolManagers);
    this.apiServer = await startAPIServer(app);

    logger.system('NOMP', `✓ API server started on http://${config.host}:${config.port}`);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (!this.isRunning) return;

    logger.system('NOMP', 'Initiating graceful shutdown...');

    this.isRunning = false;

    // Stop all pools
    for (const [poolName, manager] of this.poolManagers) {
      try {
        await manager.stop();
        logger.system('NOMP', `✓ Stopped pool: ${poolName}`);
      } catch (error) {
        logger.error(`Error stopping pool ${poolName}:`, error);
      }
    }

    // Close API server
    if (this.apiServer) {
      await new Promise((resolve) => {
        this.apiServer.close(resolve);
      });
      logger.system('NOMP', '✓ API server closed');
    }

    // Disconnect databases
    await redisClient.disconnect();
    if (mysqlClient.isReady()) {
      await mysqlClient.disconnect();
    }

    logger.system('NOMP', '✓ Shutdown complete');
  }
}

/**
 * Main execution
 */
async function main() {
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    process.exit(1);
  });

  // Clustering support
  if (config.clustering.enabled && cluster.isPrimary) {
    const numWorkers = config.clustering.workers === 'auto' 
      ? os.cpus().length 
      : config.clustering.workers;

    logger.system('Master', `Starting ${numWorkers} worker(s)...`);

    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died. Restarting...`);
      cluster.fork();
    });

  } else {
    // Worker process or single-process mode
    const nomp = new NOMPv2();

    // Handle shutdown signals
    const shutdownHandler = async (signal) => {
      logger.system('NOMP', `Received ${signal}, shutting down...`);
      await nomp.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    // Start the system
    try {
      await nomp.initialize();
      
      if (cluster.isWorker) {
        logger.system('Worker', `Worker ${process.pid} started`);
      }
    } catch (error) {
      logger.error('Failed to start NOMP:', error);
      process.exit(1);
    }
  }
}

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
