import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../../lib/logger.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Prisma connected to database');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Prisma disconnected from database');
  } catch (error) {
    logger.error('Error disconnecting from database', { error });
    throw error;
  }
}

// Repository base class with common CRUD operations
export abstract class BaseRepository<T> {
  protected model: unknown;

  async findById(id: string): Promise<T | null> {
    return (this.model as { findUnique: Function }).findUnique({
      where: { id },
    }) as Promise<T | null>;
  }

  async findMany(args?: unknown): Promise<T[]> {
    return (this.model as { findMany: Function }).findMany(args) as Promise<T[]>;
  }

  async create(data: unknown): Promise<T> {
    return (this.model as { create: Function }).create({ data }) as Promise<T>;
  }

  async update(id: string, data: unknown): Promise<T> {
    return (this.model as { update: Function }).update({
      where: { id },
      data,
    }) as Promise<T>;
  }

  async delete(id: string): Promise<T> {
    return (this.model as { delete: Function }).delete({
      where: { id },
    }) as Promise<T>;
  }

  async softDelete(id: string): Promise<T> {
    return (this.model as { update: Function }).update({
      where: { id },
      data: { deletedAt: new Date() },
    }) as Promise<T>;
  }
}

// Re-export Prisma types for convenience
export { Prisma };
