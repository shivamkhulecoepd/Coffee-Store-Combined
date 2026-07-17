import { prisma } from '../../infrastructure/database/prisma.js';
import { createError } from '../../lib/errors.js';
import { PaymentStatus } from '@prisma/client';

class PaymentService {
  async processCashPayment(orderId: string, _amountTendered?: number) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw createError.notFound('Order');
    if (order.status !== 'PENDING') throw createError.badRequest('Order cannot be paid');

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paymentStatus: 'COMPLETED' as PaymentStatus,
        paymentMethod: 'CASH',
        paidAt: new Date(),
      },
    });

    const profile = await prisma.profile.findUnique({ where: { userId: order.userId } });
    if (profile) {
      const points = Math.floor(Number(order.totalAmount));
      await prisma.profile.update({
        where: { userId: order.userId },
        data: {
          loyaltyPoints: profile.loyaltyPoints + points,
          totalSpent: { increment: order.totalAmount },
        },
      });
    }

    return { success: true, paymentStatus: updated.paymentStatus };
  }

  async processLoyaltyPayment(orderId: string, userId: string, pointsToRedeem: number) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw createError.notFound('Order');

    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile || profile.loyaltyPoints < pointsToRedeem) {
      throw createError.badRequest('Insufficient loyalty points');
    }

    const cashValue = pointsToRedeem * 0.01;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paymentStatus: 'COMPLETED' as PaymentStatus,
        paymentMethod: 'LOYALTY_POINTS',
        discountAmount: cashValue,
        paidAt: new Date(),
      },
    });

    await prisma.profile.update({
      where: { userId },
      data: { loyaltyPoints: { decrement: pointsToRedeem } },
    });

    return { success: true, pointsRedeemed: pointsToRedeem, cashValue };
  }

  async getAvailablePaymentMethods() {
    return [
      { id: 'cash', type: 'cash', name: 'Cash' },
      { id: 'loyalty', type: 'loyalty_points', name: 'Loyalty Points' },
    ];
  }
}

export const paymentService = new PaymentService();
