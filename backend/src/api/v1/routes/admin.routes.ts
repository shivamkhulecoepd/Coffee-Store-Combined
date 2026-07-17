import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { CacheService } from '../../../infrastructure/cache/redis.js';
import { authenticate, authorizeMinRole } from '../middlewares/auth.middleware.js';
import { ValidationError } from '../../../lib/errors.js';
import { emitToBranch } from '../../../lib/socket.js';
import { UnitType, InventoryStatus, AuditAction } from '@prisma/client';

const router = Router();
const cache = new CacheService('admin:');

router.get('/inventory', authenticate, authorizeMinRole('BARISTA'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.query.branchId as string) || req.user!.branchId;
    const inventory = await prisma.inventory.findMany({
      where: { branchId: branchId || undefined },
      orderBy: { itemName: 'asc' },
    });
    res.json({ success: true, data: inventory });
  } catch (error) {
    next(error);
  }
});

router.patch('/inventory/:id', authenticate, authorizeMinRole('MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quantity, reason } = req.body as { quantity: number; reason?: string };
    const itemId = req.params.id!;
    const item = await prisma.inventory.findUnique({ where: { id: itemId } });
    if (!item) throw new ValidationError('Inventory item not found');

    const updated = await prisma.inventory.update({
      where: { id: itemId },
      data: {
        quantity,
        status: quantity <= Number(item.threshold) ? 'LOW_STOCK' as InventoryStatus : 'IN_STOCK' as InventoryStatus,
      },
    });

    await prisma.inventoryLog.create({
      data: {
        inventoryId: itemId,
        userId: req.user!.userId,
        action: Number(quantity) > Number(item.quantity) ? 'INCREMENT' : 'DECREMENT',
        quantity: Math.abs(Number(quantity) - Number(item.quantity)),
        previousQty: item.quantity,
        newQty: quantity,
        reason,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.get('/kpis', authenticate, authorizeMinRole('MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.query.branchId as string) || req.user!.branchId;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [totalOrders, completedOrders, revenue] = await Promise.all([
      prisma.order.count({ where: { branchId: branchId || undefined, createdAt: { gte: today } } }),
      prisma.order.count({ where: { branchId: branchId || undefined, createdAt: { gte: today }, status: 'SERVED' } }),
      prisma.order.aggregate({ where: { branchId: branchId || undefined, createdAt: { gte: today }, status: 'SERVED' }, _sum: { totalAmount: true } }),
    ]);

    res.json({
      success: true,
      data: {
        orders: { total: totalOrders, completed: completedOrders },
        revenue: { total: revenue._sum.totalAmount || 0 },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/reports/sales', authenticate, authorizeMinRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.query.branchId as string) || req.user!.branchId;
    const orders = await prisma.order.findMany({
      where: { branchId: branchId || undefined, status: 'SERVED' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const totalRevenue = orders.reduce((sum: number, o: { totalAmount: any; }) => sum + Number(o.totalAmount), 0);
    res.json({
      success: true,
      data: { totalOrders: orders.length, totalRevenue, averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0 },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/employees', authenticate, authorizeMinRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'MANAGER', 'BARISTA'] }, deletedAt: null },
      select: { id: true, email: true, role: true, isActive: true, profile: true },
    });
    res.json({ success: true, data: employees });
  } catch (error) {
    next(error);
  }
});

export { router as adminRouter };
