import { prisma } from '../../infrastructure/database/prisma.js';
import { cacheService } from '../../infrastructure/cache/redis.js';
import { NotFoundError } from '../../lib/errors.js';
import { Prisma } from '../../infrastructure/database/prisma.js';

class InventoryService {
  /**
   * Check if product is available in inventory
   */
  async checkAvailability(productId: string, branchId: string, quantity: number): Promise<boolean> {
    const inventory = await prisma.inventory.findFirst({
      where: {
        itemName: productId,
        branchId,
      },
    });

    if (!inventory) {
      return true; // No tracking = unlimited
    }

    return Number(inventory.quantity) >= quantity;
  }

  /**
   * Deduct inventory
   */
  async deduct(
    productId: string,
    branchId: string,
    quantity: number,
    reference?: string
  ): Promise<void> {
    const inventory = await prisma.inventory.findFirst({
      where: {
        itemName: productId,
        branchId,
      },
    });

    if (!inventory) {
      return; // No tracking
    }

    const previousQty = Number(inventory.quantity);
    const newQty = previousQty - quantity;

    if (newQty < 0) {
      throw new Error('Insufficient stock');
    }

    await prisma.$transaction([
      prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: newQty,
          status: newQty <= Number(inventory.threshold) ? 'LOW_STOCK' : 'IN_STOCK',
        },
      }),
      prisma.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          userId: 'system',
          action: 'DECREMENT',
          quantity,
          previousQty,
          newQty,
          reference,
        },
      }),
    ]);
  }

  /**
   * Restock inventory
   */
  async restock(
    productId: string,
    branchId: string,
    quantity: number,
    reason?: string,
    userId?: string
  ): Promise<void> {
    let inventory = await prisma.inventory.findFirst({
      where: {
        itemName: productId,
        branchId,
      },
    });

    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          branchId,
          itemName: productId,
          quantity,
          status: 'IN_STOCK',
        },
      });
    } else {
      const previousQty = Number(inventory.quantity);
      const newQty = previousQty + quantity;

      await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: newQty,
          status: 'IN_STOCK',
          lastRestocked: new Date(),
        },
      });

      await prisma.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          userId: userId || 'system',
          action: 'RESTOCK',
          quantity,
          previousQty,
          newQty,
          reason,
        },
      });
    }
  }
}

export const inventoryService = new InventoryService();
