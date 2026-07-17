import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma, OrderStatus } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { ValidationError, AppError } from '../../../lib/errors.js';
import { emitToUser, emitToBranch } from '../../../lib/socket.js';
import { logger } from '../../../lib/logger.js';

const router = Router();

const TAX_RATE = 0.08;

const validTransitions: Record<string, string[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
};

router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, type = 'DINE_IN', items, tableSessionId, notes } = req.body;
    const userId = req.user!.userId;

    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) throw new ValidationError(`Product ${item.productId} not available`);

      const customizationTotal = item.customizations?.reduce((sum: number, c: any) => sum + c.price, 0) || 0;
      const itemSubtotal = (Number(product.basePrice) + customizationTotal) * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.basePrice,
        customizations: item.customizations || [],
        subtotal: itemSubtotal,
      });
    }

    const taxAmount = subtotal * TAX_RATE;
    const totalAmount = subtotal + taxAmount;

    const date = new Date();
    const orderNumber = `ORD-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        branchId,
        type: type as any,
        status: 'PENDING',
        subtotal,
        taxAmount,
        totalAmount,
        notes,
        tableSessionId,
        items: { create: orderItems },
      },
      include: { items: true, branch: { select: { id: true, name: true } } },
    });

    emitToBranch(branchId, 'ORDER_NEW', { orderId: order.id, orderNumber, total: totalAmount });

    res.status(201).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const where: any = { userId: req.user!.userId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, branch: { select: { id: true, name: true } } },
        skip: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
        take: parseInt(limit as string, 10),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ success: true, data: { orders, total, page: parseInt(page as string, 10) } });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, branch: true, user: { select: { id: true, email: true, profile: true } } },
    });
    if (!order) throw new ValidationError('Order not found');

    if (order.userId !== req.user!.userId && !['ADMIN', 'MANAGER', 'BARISTA', 'SUPER_ADMIN'].includes(req.user!.role)) {
      throw new AppError(403, 'Access denied');
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', authenticate, authorize('ADMIN', 'MANAGER', 'BARISTA'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: string };
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });

    if (!order) throw new ValidationError('Order not found');
    if (!validTransitions[order.status]?.includes(status)) {
      throw new ValidationError(`Invalid transition from ${order.status} to ${status}`);
    }

    const updateData: any = { status };
    if (status === 'PREPARING') updateData.preparationStartedAt = new Date();
    if (status === 'READY') updateData.preparationCompletedAt = new Date();
    if (status === 'SERVED') updateData.completedAt = new Date();
    if (status === 'CANCELLED') updateData.cancelledAt = new Date();

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: updateData,
      include: { items: true },
    });

    const orderId = order.id;
    emitToOrder(orderId, 'ORDER_UPDATE', { orderId, status });
    emitToUser(order.userId, 'ORDER_UPDATE', { orderId, status });
    emitToBranch(order.branchId, 'ORDER_UPDATE', { orderId, status });

    if (status === 'READY') {
      emitToUser(order.userId, 'ORDER_READY', { orderId, message: 'Order ready!' });
    }

    logger.info('Order status updated', { orderId: req.params.id, status });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

function emitToOrder(orderId: string, event: string, data: any) {
  emitToUser(orderId, event, data);
}

export { router as orderRouter };
