import { prisma } from '../../infrastructure/database/prisma.js';
import { emitToUser, emitToBranch } from '../../lib/socket.js';
import { createError } from '../../lib/errors.js';
import { OrderStatus } from '@prisma/client';

class BaristaService {
  async getPendingTasks(branchId: string) {
    const orders = await prisma.order.findMany({
      where: { branchId, status: { in: ['PAID', 'PREPARING'] as OrderStatus[] } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        user: { include: { profile: true } },
        items: true,
        tableSession: true,
      },
    });

    return orders.map(order => ({
      orderId: order.id,
      items: order.items.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        customizations: [],
        notes: item.notes,
      })),
      priority: order.priority,
      orderType: order.type,
      tableNumber: order.tableSession?.tableNumber,
      customerName: order.user.profile?.firstName || 'Guest',
      createdAt: order.createdAt,
    }));
  }

  async startPreparing(orderId: string, baristaId: string, branchId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, branchId, status: 'PAID' as OrderStatus },
    });
    if (!order) throw createError.notFound('Order');

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PREPARING' as OrderStatus, assignedBaristaId: baristaId, preparationStartedAt: new Date() },
    });

    emitToUser(orderId, 'ORDER_UPDATE', { orderId, status: 'PREPARING' });
    emitToBranch(branchId, 'TASK_STARTED', { orderId, baristaId });
    return updated;
  }

  async markReady(orderId: string, _baristaId: string, branchId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, branchId, status: 'PREPARING' as OrderStatus },
    });
    if (!order) throw createError.notFound('Order');

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'READY' as OrderStatus, preparationCompletedAt: new Date() },
    });

    emitToUser(order.userId, 'ORDER_READY', { orderId, message: 'Your order is ready!' });
    emitToBranch(branchId, 'TASK_COMPLETED', { orderId });
    return updated;
  }

  async markServed(orderId: string, _baristaId: string, branchId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, branchId, status: 'READY' as OrderStatus },
    });
    if (!order) throw createError.notFound('Order');

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SERVED' as OrderStatus, completedAt: new Date() },
    });

    emitToUser(orderId, 'ORDER_UPDATE', { orderId, status: 'SERVED' });
    return updated;
  }

  async cancelOrder(orderId: string, _userId: string, reason: string, branchId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, branchId, status: { in: ['PENDING', 'PAID'] as OrderStatus[] } },
    });
    if (!order) throw createError.notFound('Order');

    return prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' as OrderStatus, cancelledAt: new Date(), cancellationReason: reason },
    });
  }

  async getBaristaStats(baristaId: string, branchId: string) {
    const orders = await prisma.order.findMany({
      where: { assignedBaristaId: baristaId, branchId, status: { in: ['PREPARING', 'READY', 'SERVED'] as OrderStatus[] } },
      select: { status: true, preparationStartedAt: true, preparationCompletedAt: true },
    });

    const completed = orders.filter(o => o.status === 'SERVED');
    const prepTimes = completed.filter(o => o.preparationStartedAt && o.preparationCompletedAt);
    const avgPrep = prepTimes.length > 0
      ? prepTimes.reduce((sum, o) => sum + (new Date(o.preparationCompletedAt!).getTime() - new Date(o.preparationStartedAt!).getTime()), 0) / prepTimes.length
      : 0;

    return {
      totalTasks: orders.length,
      completedTasks: completed.length,
      inProgressTasks: orders.filter(o => o.status === 'PREPARING').length,
      readyTasks: orders.filter(o => o.status === 'READY').length,
      avgPrepTimeMinutes: Math.round(avgPrep / 60000),
    };
  }
}

export const baristaService = new BaristaService();
