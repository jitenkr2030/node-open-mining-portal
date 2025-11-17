import express from 'express';
import config from '../../config/index.js';

const router = express.Router();

/**
 * Admin authentication middleware
 */
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const token = authHeader.substring(7);
  
  if (token !== config.security.adminPassword) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden'
    });
  }

  next();
}

// Apply authentication to all admin routes
router.use(authenticateAdmin);

/**
 * POST /api/admin/pools/:poolName/restart
 * Restart a pool
 */
router.post('/pools/:poolName/restart', async (req, res, next) => {
  try {
    const { poolName } = req.params;
    const poolManagers = req.app.locals.poolManagers;
    const manager = poolManagers.get(poolName);

    if (!manager) {
      return res.status(404).json({
        success: false,
        error: 'Pool not found'
      });
    }

    await manager.stop();
    await manager.start();

    res.json({
      success: true,
      message: `Pool ${poolName} restarted`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/pools/:poolName/stop
 * Stop a pool
 */
router.post('/pools/:poolName/stop', async (req, res, next) => {
  try {
    const { poolName } = req.params;
    const poolManagers = req.app.locals.poolManagers;
    const manager = poolManagers.get(poolName);

    if (!manager) {
      return res.status(404).json({
        success: false,
        error: 'Pool not found'
      });
    }

    await manager.stop();

    res.json({
      success: true,
      message: `Pool ${poolName} stopped`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/system
 * Get system information
 */
router.get('/system', (req, res) => {
  res.json({
    success: true,
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  });
});

export default router;
