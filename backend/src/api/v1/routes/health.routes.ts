import { Router, Request, Response } from 'express';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/cache/redis.js';

const router = Router();

/**
 * GET /health - Basic health check
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /health/detailed - Detailed health check
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  const checks: Record<string, any> = {};
  
  // Check database
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  
  // Check Redis
  try {
    const redisStart = Date.now();
    await redis.ping();
    checks.redis = {
      status: 'healthy',
      latency: Date.now() - redisStart,
    };
  } catch (error) {
    checks.redis = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  
  // Check memory
  const memUsage = process.memoryUsage();
  checks.memory = {
    status: memUsage.heapUsed < memUsage.heapTotal * 0.9 ? 'healthy' : 'warning',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
  };
  
  // Overall status
  const isHealthy = Object.values(checks).every(
    (check: any) => check.status === 'healthy' || check.status === 'warning'
  );
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    checks,
  });
});

/**
 * GET /health/simple - Simple health check (no dependencies)
 */
router.get('/simple', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRouter };
