import { Queue, Worker, Job } from 'bullmq';
import { createRequire } from 'module';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { emitToUser, emitToBranch } from '../../lib/socket.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`, {
  maxRetriesPerRequest: null,
});

export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  NOTIFICATION: 'notification-queue',
  INVOICE: 'invoice-queue',
  INVENTORY_ALERT: 'inventory-alert-queue',
  OTP_CLEANUP: 'otp-cleanup-queue',
} as const;

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, { connection });
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, { connection });
export const invoiceQueue = new Queue(QUEUE_NAMES.INVOICE, { connection });
export const inventoryAlertQueue = new Queue(QUEUE_NAMES.INVENTORY_ALERT, { connection });
export const otpCleanupQueue = new Queue(QUEUE_NAMES.OTP_CLEANUP, { connection });

async function handleEmailJob(job: Job): Promise<void> {
  const { to, template, data } = job.data;
  logger.info('Processing email', { to, template });
}

async function handleInvoiceJob(job: Job): Promise<void> {
  const { orderId } = job.data;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });
  if (order) {
    emitToUser(order.userId, 'INVOICE_GENERATED', { orderId });
  }
}

async function handleInventoryAlertJob(job: Job): Promise<void> {
  const { branchId, itemName, currentQty } = job.data;
  emitToBranch(branchId, 'STOCK_ALERT', { itemName, currentQty });
}

async function handleOtpCleanupJob(): Promise<void> {
  await prisma.otpCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export function createEmailWorker() {
  return new Worker(QUEUE_NAMES.EMAIL, async (job) => {
    await handleEmailJob(job);
    return { success: true };
  }, { connection });
}

export function createInvoiceWorker() {
  return new Worker(QUEUE_NAMES.INVOICE, async (job) => {
    await handleInvoiceJob(job);
    return { success: true };
  }, { connection });
}

export function createInventoryAlertWorker() {
  return new Worker(QUEUE_NAMES.INVENTORY_ALERT, async (job) => {
    await handleInventoryAlertJob(job);
    return { success: true };
  }, { connection });
}

export function createOtpCleanupWorker() {
  return new Worker(QUEUE_NAMES.OTP_CLEANUP, async () => {
    await handleOtpCleanupJob();
    return { success: true };
  }, { connection });
}

const workers: Worker[] = [];

export async function initializeWorkers(): Promise<void> {
  workers.push(createEmailWorker());
  workers.push(createInvoiceWorker());
  workers.push(createInventoryAlertWorker());
  workers.push(createOtpCleanupWorker());
  
  await otpCleanupQueue.add('cleanup', {}, { repeat: { every: 60 * 60 * 1000 } });
  logger.info(`Initialized ${workers.length} workers`);
}

export async function shutdownWorkers(): Promise<void> {
  for (const worker of workers) {
    await worker.close();
  }
  await connection.quit();
}
