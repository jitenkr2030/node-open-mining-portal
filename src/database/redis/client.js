import { createClient } from '@redis/client';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const redisConfig = {
        socket: {
          host: config.redis.host,
          port: config.redis.port,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis reconnection failed after 10 attempts');
              return new Error('Max reconnection attempts reached');
            }
            const delay = Math.min(retries * 100, 3000);
            logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
          }
        }
      };

      if (config.redis.password) {
        redisConfig.password = config.redis.password;
      }

      if (config.redis.db) {
        redisConfig.database = config.redis.db;
      }

      this.client = createClient(redisConfig);

      // Event handlers
      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        logger.system('Redis', 'Connecting to Redis server...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        logger.system('Redis', 'Successfully connected to Redis server', {
          host: config.redis.host,
          port: config.redis.port,
          db: config.redis.db
        });
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis client reconnecting...');
      });

      this.client.on('end', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      logger.system('Redis', 'Redis connection closed gracefully');
    }
  }

  // Convenience methods with error handling
  async get(key) {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      throw error;
    }
  }

  async set(key, value, options = {}) {
    try {
      return await this.client.set(key, value, options);
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      throw error;
    }
  }

  async setEx(key, seconds, value) {
    try {
      return await this.client.setEx(key, seconds, value);
    } catch (error) {
      logger.error(`Redis SETEX error for key ${key}:`, error);
      throw error;
    }
  }

  async del(key) {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      throw error;
    }
  }

  async hSet(key, field, value) {
    try {
      return await this.client.hSet(key, field, value);
    } catch (error) {
      logger.error(`Redis HSET error for key ${key}:`, error);
      throw error;
    }
  }

  async hGet(key, field) {
    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      logger.error(`Redis HGET error for key ${key}:`, error);
      throw error;
    }
  }

  async hGetAll(key) {
    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      logger.error(`Redis HGETALL error for key ${key}:`, error);
      throw error;
    }
  }

  async hDel(key, field) {
    try {
      return await this.client.hDel(key, field);
    } catch (error) {
      logger.error(`Redis HDEL error for key ${key}:`, error);
      throw error;
    }
  }

  async zAdd(key, score, member) {
    try {
      return await this.client.zAdd(key, { score, value: member });
    } catch (error) {
      logger.error(`Redis ZADD error for key ${key}:`, error);
      throw error;
    }
  }

  async zRange(key, start, stop) {
    try {
      return await this.client.zRange(key, start, stop);
    } catch (error) {
      logger.error(`Redis ZRANGE error for key ${key}:`, error);
      throw error;
    }
  }

  async zRemRangeByScore(key, min, max) {
    try {
      return await this.client.zRemRangeByScore(key, min, max);
    } catch (error) {
      logger.error(`Redis ZREMRANGEBYSCORE error for key ${key}:`, error);
      throw error;
    }
  }

  async incr(key) {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}:`, error);
      throw error;
    }
  }

  async incrBy(key, increment) {
    try {
      return await this.client.incrBy(key, increment);
    } catch (error) {
      logger.error(`Redis INCRBY error for key ${key}:`, error);
      throw error;
    }
  }

  async expire(key, seconds) {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}:`, error);
      throw error;
    }
  }

  async exists(key) {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      throw error;
    }
  }

  async keys(pattern) {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected;
  }
}

// Create singleton instance
const redisClient = new RedisClient();

export default redisClient;
