import { prisma } from '../../infrastructure/database/prisma.js';
import { cacheService } from '../../infrastructure/cache/redis.js';
import { emitOrderEvent } from '../../lib/socket.js';
import { createError } from '../../lib/errors.js';
import { OrderStatus } from '@prisma/client';

class CartService {
  async getActiveCart(userId: string, branchId: string) {
    const cached = await cacheService.get<any>(`cart:${userId}:${branchId}`);
    if (cached) return cached;

    const pendingOrder = await prisma.order.findFirst({
      where: { userId, branchId, status: 'PENDING' as OrderStatus },
      include: { items: { include: { product: true } } },
    });

    if (pendingOrder) {
      await cacheService.set(`cart:${userId}:${branchId}`, pendingOrder, 3600);
      return pendingOrder;
    }
    return null;
  }

  async addItem(userId: string, input: { productId: string; quantity: number; branchId: string; notes?: string }) {
    const product = await prisma.product.findUnique({ where: { id: input.productId } });
    if (!product || !product.isActive) {
      throw createError.notFound('Product');
    }

    let order = await prisma.order.findFirst({
      where: { userId, branchId: input.branchId, status: 'PENDING' as OrderStatus },
    });

    if (!order) {
      const date = new Date();
      const orderNumber = `ORD-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
      order = await prisma.order.create({
        data: {
          orderNumber,
          userId,
          branchId: input.branchId,
          type: 'DINE_IN',
          status: 'PENDING',
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
        },
      });
    }

    const subtotal = Number(product.basePrice) * input.quantity;

    const existingItem = await prisma.orderItem.findFirst({
      where: { orderId: order.id, productId: input.productId },
    });

    if (existingItem) {
      await prisma.orderItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + input.quantity },
      });
    } else {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: input.productId,
          productName: product.name,
          quantity: input.quantity,
          unitPrice: product.basePrice,
          subtotal,
          notes: input.notes,
        },
      });
    }

    await this.recalculateOrderTotal(order.id);
    await cacheService.del(`cart:${userId}:${input.branchId}`);
    emitOrderEvent(order.id, 'cart_updated', { orderId: order.id });

    return this.getOrderById(order.id);
  }

  async updateItem(userId: string, orderId: string, itemId: string, quantity: number) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId, status: 'PENDING' as OrderStatus },
    });
    if (!order) throw createError.notFound('Cart');

    if (quantity <= 0) {
      await this.removeItem(userId, orderId, itemId);
      return null;
    }

    await prisma.orderItem.update({ where: { id: itemId }, data: { quantity } });
    await this.recalculateOrderTotal(orderId);
    await cacheService.del(`cart:${userId}:${order.branchId}`);
    return this.getOrderById(orderId);
  }

  async removeItem(userId: string, orderId: string, itemId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId, status: 'PENDING' as OrderStatus },
    });
    if (!order) throw createError.notFound('Cart');

    await prisma.orderItem.delete({ where: { id: itemId } });
    await this.recalculateOrderTotal(orderId);
    await cacheService.del(`cart:${userId}:${order.branchId}`);

    const remaining = await prisma.orderItem.count({ where: { orderId } });
    if (remaining === 0) {
      await prisma.order.delete({ where: { id: orderId } });
      return null;
    }
    return this.getOrderById(orderId);
  }

  private async recalculateOrderTotal(orderId: string) {
    const items = await prisma.orderItem.findMany({ where: { orderId } });
    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const taxAmount = subtotal * 0.08;
    await prisma.order.update({
      where: { id: orderId },
      data: { subtotal, taxAmount, totalAmount: subtotal + taxAmount },
    });
  }

  async getOrderById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, branch: true, user: { include: { profile: true } } },
    });
  }
}

export const cartService = new CartService();
