import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { CacheService } from '../../../infrastructure/cache/redis.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { ValidationError } from '../../../lib/errors.js';

const router = Router();
const cache = new CacheService('tables:');

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.query.branchId as string) || req.user!.branchId;
    if (!branchId) throw new ValidationError('Branch ID required');

    const tables = await prisma.tableSession.findMany({
      where: { branchId: branchId || undefined },
      orderBy: { tableNumber: 'asc' },
    });
    res.json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const table = await prisma.tableSession.findUnique({
      where: { id: req.params.id },
      include: { orders: { where: { status: { in: ['PAID', 'PREPARING', 'READY'] as any } } } },
    });
    if (!table) throw new ValidationError('Table not found');
    res.json({ success: true, data: table });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/start-session', authenticate, authorize('BARISTA', 'MANAGER', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await prisma.tableSession.update({
      where: { id: req.params.id },
      data: { status: 'OCCUPIED', baristaId: req.user!.userId, startTime: new Date() },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/close-session', authenticate, authorize('BARISTA', 'MANAGER', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await prisma.tableSession.update({
      where: { id: req.params.id },
      data: { status: 'VACANT', baristaId: null, currentOrderId: null, endTime: new Date() },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export { router as tableRouter };
