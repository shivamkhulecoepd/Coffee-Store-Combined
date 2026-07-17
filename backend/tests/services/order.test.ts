import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OrderStatus, OrderType } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  orderItem: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  inventory: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  inventoryLog: {
    create: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  profile: {
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('../../src/infrastructure/database/prisma.js', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../src/lib/socket.js', () => ({
  emitOrderEvent: jest.fn(),
  emitUserEvent: jest.fn(),
  emitBranchEvent: jest.fn(),
}));

import { cartService } from '../../src/domain/services/cart.service.js';
import { inventoryService } from '../../src/domain/services/inventory.service.js';

describe('Cart Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addItem', () => {
    it('should throw error if product not found', async () => {
      mockPrisma.product.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        cartService.addItem('user-1', {
          productId: 'product-1',
          quantity: 1,
          branchId: 'branch-1',
        })
      ).rejects.toThrow('Product not available');
    });

    it('should throw error if product is unavailable', async () => {
      mockPrisma.product.findUnique = jest.fn().mockResolvedValue({
        id: 'product-1',
        name: 'Test Coffee',
        basePrice: 4.99,
        isAvailable: false,
      });

      await expect(
        cartService.addItem('user-1', {
          productId: 'product-1',
          quantity: 1,
          branchId: 'branch-1',
        })
      ).rejects.toThrow('Product not available');
    });

    it('should create new order if no pending order exists', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Coffee',
        basePrice: 4.99,
        isAvailable: true,
        customizations: [],
      };

      mockPrisma.product.findUnique = jest.fn().mockResolvedValue(mockProduct);
      mockPrisma.order.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.order.create = jest.fn().mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        branchId: 'branch-1',
        status: 'PENDING',
        totalAmount: 0,
      });
      mockPrisma.orderItem.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.orderItem.create = jest.fn().mockResolvedValue({
        id: 'item-1',
        productId: 'product-1',
        quantity: 1,
        unitPrice: 4.99,
      });
      mockPrisma.orderItem.findMany = jest.fn().mockResolvedValue([
        { quantity: 1, unitPrice: 4.99, customizations: [] },
      ]);
      mockPrisma.order.update = jest.fn().mockResolvedValue({});
      mockPrisma.orderItem.count = jest.fn().mockResolvedValue(1);

      const result = await cartService.addItem('user-1', {
        productId: 'product-1',
        quantity: 1,
        branchId: 'branch-1',
      });

      expect(mockPrisma.order.create).toHaveBeenCalled();
      expect(mockPrisma.orderItem.create).toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    it('should throw error if cart not found', async () => {
      mockPrisma.order.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        cartService.updateItem('user-1', 'order-1', 'item-1', { quantity: 2 })
      ).rejects.toThrow('Cart not found');
    });

    it('should throw error if item not found in cart', async () => {
      mockPrisma.order.findFirst = jest.fn().mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        status: 'PENDING',
        branchId: 'branch-1',
      });
      mockPrisma.orderItem.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        cartService.updateItem('user-1', 'order-1', 'item-1', { quantity: 2 })
      ).rejects.toThrow('Item not found in cart');
    });

    it('should remove item if quantity is 0', async () => {
      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        status: 'PENDING',
        branchId: 'branch-1',
      };
      const mockItem = {
        id: 'item-1',
        productId: 'product-1',
        quantity: 1,
      };

      mockPrisma.order.findFirst = jest.fn().mockResolvedValue(mockOrder);
      mockPrisma.orderItem.findFirst = jest.fn().mockResolvedValue(mockItem);
      mockPrisma.orderItem.delete = jest.fn().mockResolvedValue(mockItem);
      mockPrisma.orderItem.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.order.update = jest.fn().mockResolvedValue({});
      mockPrisma.order.delete = jest.fn().mockResolvedValue({});

      const result = await cartService.updateItem(
        'user-1',
        'order-1',
        'item-1',
        { quantity: 0 }
      );

      expect(mockPrisma.orderItem.delete).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});

describe('Inventory Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAvailability', () => {
    it('should return true if sufficient stock', async () => {
      mockPrisma.inventory.findFirst = jest.fn().mockResolvedValue({
        id: 'inv-1',
        productId: 'product-1',
        branchId: 'branch-1',
        quantity: 10,
        lowStockThreshold: 5,
      });

      const result = await inventoryService.checkAvailability(
        'product-1',
        'branch-1',
        5
      );

      expect(result).toBe(true);
    });

    it('should return false if insufficient stock', async () => {
      mockPrisma.inventory.findFirst = jest.fn().mockResolvedValue({
        id: 'inv-1',
        productId: 'product-1',
        branchId: 'branch-1',
        quantity: 3,
        lowStockThreshold: 5,
      });

      const result = await inventoryService.checkAvailability(
        'product-1',
        'branch-1',
        5
      );

      expect(result).toBe(false);
    });

    it('should return true if no inventory record (untracked)', async () => {
      mockPrisma.inventory.findFirst = jest.fn().mockResolvedValue(null);

      const result = await inventoryService.checkAvailability(
        'product-1',
        'branch-1',
        100
      );

      expect(result).toBe(true);
    });
  });

  describe('deduct', () => {
    it('should throw error if insufficient stock', async () => {
      mockPrisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.inventory.findFirst = jest.fn().mockResolvedValue({
        id: 'inv-1',
        productId: 'product-1',
        branchId: 'branch-1',
        quantity: 3,
        lowStockThreshold: 5,
      });

      await expect(
        inventoryService.deduct('product-1', 'branch-1', 5, 'order-1')
      ).rejects.toThrow('Insufficient stock');
    });

    it('should deduct inventory successfully', async () => {
      mockPrisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.inventory.findFirst = jest.fn().mockResolvedValue({
        id: 'inv-1',
        productId: 'product-1',
        branchId: 'branch-1',
        quantity: 10,
        lowStockThreshold: 5,
      });
      mockPrisma.inventory.update = jest.fn().mockResolvedValue({
        id: 'inv-1',
        quantity: 5,
      });
      mockPrisma.inventoryLog.create = jest.fn().mockResolvedValue({});
      mockPrisma.product.findUnique = jest.fn().mockResolvedValue({
        id: 'product-1',
        name: 'Test Coffee',
      });

      const result = await inventoryService.deduct(
        'product-1',
        'branch-1',
        5,
        'order-1'
      );

      expect(mockPrisma.inventory.update).toHaveBeenCalled();
      expect(mockPrisma.inventoryLog.create).toHaveBeenCalled();
      expect(result.quantity).toBe(5);
    });
  });
});
