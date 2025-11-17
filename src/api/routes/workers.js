import express from 'express';

const router = express.Router();

/**
 * GET /api/workers/:address
 * Get worker statistics
 */
router.get('/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    const { pool } = req.query;

    const poolManagers = req.app.locals.poolManagers;
    
    if (pool) {
      // Get stats for specific pool
      const manager = poolManagers.get(pool);
      
      if (!manager) {
        return res.status(404).json({
          success: false,
          error: 'Pool not found'
        });
      }

      const stats = await manager.getWorkerStats(address);

      return res.json({
        success: true,
        worker: {
          address,
          pool,
          ...stats
        }
      });
    }

    // Get stats across all pools
    const allStats = await Promise.all(
      Array.from(poolManagers.entries()).map(async ([poolName, manager]) => {
        const stats = await manager.getWorkerStats(address);
        return {
          pool: poolName,
          ...stats
        };
      })
    );

    res.json({
      success: true,
      worker: {
        address,
        pools: allStats.filter(s => s.shares || s.balance)
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/workers/:address/payments
 * Get worker payment history
 */
router.get('/:address/payments', async (req, res, next) => {
  try {
    const { address } = req.params;
    const { pool, limit = 10 } = req.query;

    const poolManagers = req.app.locals.poolManagers;
    
    if (!pool) {
      return res.status(400).json({
        success: false,
        error: 'Pool parameter required'
      });
    }

    const manager = poolManagers.get(pool);
    
    if (!manager || !manager.paymentProcessor) {
      return res.status(404).json({
        success: false,
        error: 'Pool not found or payments not enabled'
      });
    }

    const payments = await manager.paymentProcessor.getWorkerPaymentHistory(
      address,
      parseInt(limit, 10)
    );

    res.json({
      success: true,
      payments
    });

  } catch (error) {
    next(error);
  }
});

export default router;
