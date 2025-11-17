import dotenv from 'dotenv';
import Joi from 'joi';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration Schema with Validation
const configSchema = Joi.object({
  env: Joi.string().valid('development', 'production', 'test').default('production'),
  port: Joi.number().default(8080),
  host: Joi.string().default('0.0.0.0'),
  
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    dir: Joi.string().default('./logs')
  }),
  
  redis: Joi.object({
    host: Joi.string().default('127.0.0.1'),
    port: Joi.number().default(6379),
    password: Joi.string().allow('').optional(),
    db: Joi.number().default(0)
  }),
  
  mysql: Joi.object({
    host: Joi.string().default('127.0.0.1'),
    port: Joi.number().default(3306),
    user: Joi.string().required(),
    password: Joi.string().allow('').optional(),
    database: Joi.string().required()
  }).optional(),
  
  clustering: Joi.object({
    enabled: Joi.boolean().default(true),
    workers: Joi.alternatives().try(
      Joi.string().valid('auto'),
      Joi.number().min(1)
    ).default('auto')
  }),
  
  cli: Joi.object({
    port: Joi.number().default(17117)
  }),
  
  website: Joi.object({
    enabled: Joi.boolean().default(true),
    port: Joi.number().default(80),
    host: Joi.string().default('0.0.0.0'),
    stratumHost: Joi.string().required()
  }),
  
  stats: Joi.object({
    updateInterval: Joi.number().default(15),
    retentionSeconds: Joi.number().default(43200),
    hashrateWindow: Joi.number().default(300)
  }),
  
  security: Joi.object({
    apiRateLimit: Joi.number().default(100),
    apiRateWindow: Joi.number().default(15),
    enableCors: Joi.boolean().default(true),
    adminPassword: Joi.string().min(8).required()
  }),
  
  poolDefaults: Joi.object({
    blockRefreshInterval: Joi.number().default(1000),
    jobRebroadcastTimeout: Joi.number().default(55),
    connectionTimeout: Joi.number().default(600),
    validateWorkerUsername: Joi.boolean().default(true)
  }),
  
  banning: Joi.object({
    enabled: Joi.boolean().default(true),
    time: Joi.number().default(600),
    invalidPercent: Joi.number().min(0).max(100).default(50),
    checkThreshold: Joi.number().default(500),
    purgeInterval: Joi.number().default(300)
  })
}).required();

// Build configuration object from environment variables
const config = {
  env: process.env.NODE_ENV || 'production',
  port: parseInt(process.env.PORT, 10) || 8080,
  host: process.env.HOST || '0.0.0.0',
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs'
  },
  
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0
  },
  
  mysql: process.env.MYSQL_HOST ? {
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE
  } : undefined,
  
  clustering: {
    enabled: process.env.CLUSTER_ENABLED === 'true',
    workers: process.env.CLUSTER_WORKERS === 'auto' ? 'auto' : parseInt(process.env.CLUSTER_WORKERS, 10)
  },
  
  cli: {
    port: parseInt(process.env.CLI_PORT, 10) || 17117
  },
  
  website: {
    enabled: process.env.WEBSITE_ENABLED === 'true',
    port: parseInt(process.env.WEBSITE_PORT, 10) || 80,
    host: process.env.WEBSITE_HOST || '0.0.0.0',
    stratumHost: process.env.STRATUM_HOST || 'localhost'
  },
  
  stats: {
    updateInterval: parseInt(process.env.STATS_UPDATE_INTERVAL, 10) || 15,
    retentionSeconds: parseInt(process.env.STATS_RETENTION_SECONDS, 10) || 43200,
    hashrateWindow: parseInt(process.env.HASHRATE_WINDOW, 10) || 300
  },
  
  security: {
    apiRateLimit: parseInt(process.env.API_RATE_LIMIT, 10) || 100,
    apiRateWindow: parseInt(process.env.API_RATE_WINDOW, 10) || 15,
    enableCors: process.env.ENABLE_CORS === 'true',
    adminPassword: process.env.ADMIN_PASSWORD || 'changeme'
  },
  
  poolDefaults: {
    blockRefreshInterval: parseInt(process.env.BLOCK_REFRESH_INTERVAL, 10) || 1000,
    jobRebroadcastTimeout: parseInt(process.env.JOB_REBROADCAST_TIMEOUT, 10) || 55,
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT, 10) || 600,
    validateWorkerUsername: process.env.VALIDATE_WORKER_USERNAME === 'true'
  },
  
  banning: {
    enabled: process.env.BANNING_ENABLED === 'true',
    time: parseInt(process.env.BANNING_TIME, 10) || 600,
    invalidPercent: parseInt(process.env.BANNING_INVALID_PERCENT, 10) || 50,
    checkThreshold: parseInt(process.env.BANNING_CHECK_THRESHOLD, 10) || 500,
    purgeInterval: parseInt(process.env.BANNING_PURGE_INTERVAL, 10) || 300
  }
};

// Validate configuration
const { error, value: validatedConfig } = configSchema.validate(config, {
  abortEarly: false,
  stripUnknown: true
});

if (error) {
  throw new Error(`Configuration validation error: ${error.message}`);
}

export default validatedConfig;
