import mysql from 'mysql2/promise';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class MySQLClient {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    if (!config.mysql) {
      logger.warn('MySQL configuration not provided, skipping MySQL connection');
      return null;
    }

    try {
      this.pool = mysql.createPool({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });

      // Test connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      this.isConnected = true;
      logger.system('MySQL', 'Successfully connected to MySQL database', {
        host: config.mysql.host,
        database: config.mysql.database
      });

      return this.pool;
    } catch (error) {
      logger.error('Failed to connect to MySQL:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool && this.isConnected) {
      await this.pool.end();
      this.isConnected = false;
      logger.system('MySQL', 'MySQL connection pool closed gracefully');
    }
  }

  async query(sql, params = []) {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      logger.error('MySQL query error:', { sql, error: error.message });
      throw error;
    }
  }

  async transaction(callback) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      logger.error('MySQL transaction error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  getPool() {
    return this.pool;
  }

  isReady() {
    return this.isConnected;
  }
}

// Create singleton instance
const mysqlClient = new MySQLClient();

export default mysqlClient;
