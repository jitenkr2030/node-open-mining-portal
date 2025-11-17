import express from 'express';

const router = express.Router();

/**
 * GET /api/pools
 * List all pools
 */
router.get('/', async (req, res, next) => {
  try {
    const poolManagers = req.app.locals.poolManagers;
    
    const pools = await Promise.all(
      Array.from(poolManagers.entries()).map(async ([name, manager]) => {
        const stats = await manager.getStats();
        return {
          name,
          coin: stats.coin,
          algorithm: stats.algorithm,
          isRunning: stats.isRunning,
          workers: stats.workers.connected,
          ports: Object.keys(stats.ports)
        };
      })
    );

    res.json({
      success: true,
      pools
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/pools/:poolName
 * Get specific pool details
 */
router.get('/:poolName', async (req, res, next) => {
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

    const stats = await manager.getStats();

    res.json({
      success: true,
      pool: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/pools/:poolName/blocks
 * Get pool blocks
 */
router.get('/:poolName/blocks', async (req, res, next) => {
  try {
    const { poolName } = req.params;
    const { status = 'all', limit = 50 } = req.query;
    
    const poolManagers = req.app.locals.poolManagers;
    const manager = poolManagers.get(poolName);

    if (!manager) {
      return res.status(404).json({
        success: false,
        error: 'Pool not found'
      });
    }

    // Get blocks from Redis
    // Implementation would fetch blocks based on status filter

    res.json({
      success: true,
      blocks: []
    });
  } catch (error) {
    next(error);
  }
});

export default router;
