import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import config from '../config/index.js';
import logger, { apiLogger } from '../utils/logger.js';
import poolRoutes from './routes/pools.js';
import statsRoutes from './routes/stats.js';
import workerRoutes from './routes/workers.js';
import adminRoutes from './routes/admin.js';

/**
 * Create and configure Express API server
 */
export function createAPIServer(poolManagers) {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:']
      }
    }
  }));

  // CORS
  if (config.security.enableCors) {
    app.use(cors());
  }

  // Compression
  app.use(compression());

  // Body parsing
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.security.apiRateWindow * 60 * 1000,
    max: config.security.apiRateLimit,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/', limiter);

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      apiLogger.info('API Request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        ip: req.ip
      });
    });
    
    next();
  });

  // Make pool managers available to routes
  app.locals.poolManagers = poolManagers;

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '2.0.0'
    });
  });

  // API routes
  app.use('/api/pools', poolRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/workers', workerRoutes);
  app.use('/api/admin', adminRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.path
    });
  });

  // Error handler
  app.use((error, req, res, next) => {
    logger.error('API Error:', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method
    });

    res.status(error.status || 500).json({
      error: error.message || 'Internal Server Error',
      ...(config.env === 'development' && { stack: error.stack })
    });
  });

  return app;
}

/**
 * Start API server
 */
export async function startAPIServer(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, config.host, () => {
      logger.system('API', `Server listening on ${config.host}:${config.port}`);
      resolve(server);
    });

    server.on('error', (error) => {
      logger.error('API Server error:', error);
      reject(error);
    });
  });
}
