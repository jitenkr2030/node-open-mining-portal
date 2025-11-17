import express from 'express';

const router = express.Router();

/**
 * GET /api/stats
 * Get global statistics
 */
router.get('/', async (req, res, next) => {
  try {
    const poolManagers = req.app.locals.poolManagers;
    
    let totalWorkers = 0;
    let totalHashrate = 0;
    const pools = [];

    for (const [name, manager] of poolManagers) {
      const stats = await manager.getStats();
      totalWorkers += stats.workers.connected;
      pools.push({
        name,
        workers: stats.workers.connected,
        blocks: stats.blocks
      });
    }

    res.json({
      success: true,
      stats: {
        totalPools: poolManagers.size,
        totalWorkers,
        totalHashrate,
        pools,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stats/:poolName
 * Get pool-specific statistics
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
      stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;
