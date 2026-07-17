import { prisma } from '../../infrastructure/database/prisma.js';
import { createError } from '../../lib/errors.js';
import { OrderStatus } from '@prisma/client';

export interface CreateOrderInput {
  userId: string;
  branchId: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  items: {
    productId: string;
    quantity: number;
    customizations?: { name: string; option: string; price: number }[];
  }[];
  tableSessionId?: string;
  notes?: string;
}

class OrderService {
  async createOrder(input: CreateOrderInput) {
    const TAX_RATE = 0.08;
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of input.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) {
        throw createError.badRequest(`Product ${item.productId} not available`);
      }

      const customizationTotal = item.customizations?.reduce((sum, c) => sum + c.price, 0) || 0;
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
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.order.count({
      where: { createdAt: { gte: new Date(date.setHours(0, 0, 0, 0)) } },
    });
    const orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: input.userId,
        branchId: input.branchId,
        type: input.type,
        status: 'PENDING',
        subtotal,
        taxAmount,
        totalAmount,
        notes: input.notes,
        tableSessionId: input.tableSessionId,
        items: { create: orderItems },
      },
      include: { items: true, branch: { select: { id: true, name: true } } },
    });

    const { emitToBranch } = await import('../../lib/socket.js');
    emitToBranch(input.branchId, 'ORDER_NEW', { orderId: order.id, orderNumber: order.orderNumber });

    return order;
  }

  async updateStatus(orderId: string, status: OrderStatus, userId?: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw createError.notFound('Order');
    }

    const updateData: any = { status };
    if (status === 'PREPARING') {
      updateData.preparationStartedAt = new Date();
      updateData.assignedBaristaId = userId;
    } else if (status === 'READY') {
      updateData.preparationCompletedAt = new Date();
    } else if (status === 'SERVED') {
      updateData.completedAt = new Date();
    } else if (status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { items: true, branch: true },
    });

    const { emitToUser, emitToBranch } = await import('../../lib/socket.js');
    emitToUser(order.userId, 'ORDER_UPDATE', { orderId, status });
    emitToBranch(order.branchId, 'ORDER_UPDATE', { orderId, status });

    return updated;
  }

  async getOrderById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, branch: true, user: { include: { profile: true } } },
    });
  }
}

export const orderService = new OrderService();
