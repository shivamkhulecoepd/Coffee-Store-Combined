import { prisma } from '../../infrastructure/database/prisma.js';
import { emitToUser } from '../../lib/socket.js';

class NotificationService {
  async sendToUser(userId: string, payload: { type: string; title: string; body: string; data?: any }) {
    emitToUser(userId, 'notification', { ...payload, timestamp: new Date().toISOString() });
    return { success: true };
  }

  async sendToBranch(branchId: string, payload: { type: string; title: string; body: string }) {
    const staff = await prisma.user.findMany({
      where: { staffBranches: { some: { branchId } }, role: { in: ['BARISTA', 'ADMIN', 'MANAGER'] } },
      select: { id: true },
    });
    await Promise.all(staff.map(s => this.sendToUser(s.id, payload)));
    return { sent: staff.length };
  }

  async sendOrderReady(orderId: string, userId: string, orderNumber: string) {
    return this.sendToUser(userId, {
      type: 'ORDER_READY',
      title: 'Order Ready!',
      body: `Order #${orderNumber} is ready for pickup.`,
    });
  }
}

export const notificationService = new NotificationService();
