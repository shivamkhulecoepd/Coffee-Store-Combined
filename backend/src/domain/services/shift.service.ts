import { prisma } from '../../infrastructure/database/prisma.js';

class ShiftService {
  async createShift(input: {
    userId: string;
    branchId: string;
    startTime: Date;
    endTime: Date;
    role: string;
    notes?: string;
  }, createdBy: string) {
    await prisma.auditLog.create({
      data: {
        action: 'SHIFT_CREATED',
        entityType: 'SHIFT',
        entityId: `shift_${Date.now()}`,
        userId: input.userId,
        branchId: input.branchId,
        metadata: { startTime: input.startTime, endTime: input.endTime, role: input.role, notes: input.notes },
      },
    });
    return { success: true };
  }

  async getBranchShifts(branchId: string, startDate: Date, endDate: Date) {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'SHIFT_CREATED',
        branchId,
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    return logs.map(log => ({
      id: log.entityId,
      userId: log.userId,
      startTime: (log.metadata as any)?.startTime,
      endTime: (log.metadata as any)?.endTime,
      role: (log.metadata as any)?.role,
    }));
  }

  async clockIn(userId: string, branchId: string, shiftId: string) {
    await prisma.auditLog.create({
      data: {
        action: 'CLOCK_IN',
        entityType: 'SHIFT',
        entityId: shiftId,
        userId,
        branchId,
      },
    });
    return { success: true, clockedInAt: new Date() };
  }

  async clockOut(userId: string, branchId: string, shiftId: string) {
    await prisma.auditLog.create({
      data: {
        action: 'CLOCK_OUT',
        entityType: 'SHIFT',
        entityId: shiftId,
        userId,
        branchId,
      },
    });
    return { success: true, clockedOutAt: new Date() };
  }
}

export const shiftService = new ShiftService();
