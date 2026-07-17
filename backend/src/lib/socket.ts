import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRequire } from 'module';
import { logger } from './logger.js';
import { verifyAccessToken } from '../domain/services/auth.service.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Redis = require('ioredis');

type RedisClient = InstanceType<typeof Redis>;

let io: Server;

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  role?: string;
  branchId?: string;
  sessionId?: string;
}

// Redis clients for adapter
let pubClient: RedisClient;
let subClient: RedisClient;

export function initializeSocketIO(httpServer: HttpServer): Server {
  const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;

  pubClient = new Redis(redisUrl);
  subClient = new Redis(redisUrl);

  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      logger.info('Socket.IO Redis adapter connected');
    })
    .catch((err) => {
      logger.error('Socket.IO Redis adapter connection failed', { error: err });
    });

  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    adapter: createAdapter(pubClient, subClient),
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next();
      }

      try {
        const payload = verifyAccessToken(token);
        socket.userId = payload.userId;
        socket.role = payload.role;
        socket.branchId = payload.branchId;
        socket.sessionId = payload.sessionId;
      } catch (err) {
        logger.warn('Socket auth failed', { error: err });
      }

      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('Client connected', { socketId: socket.id });

    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    socket.on('join:branch', (branchId: string) => {
      if (['ADMIN', 'MANAGER', 'BARISTA'].includes(socket.role || '')) {
        socket.join(`branch:${branchId}:ops`);
      }
    });

    socket.on('join:order', (orderId: string) => {
      socket.join(`order:${orderId}`);
    });

    socket.on('leave:order', (orderId: string) => {
      socket.leave(`order:${orderId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected', { socketId: socket.id, reason });
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

export const emitToUser = (userId: string, event: string, data: unknown): void => {
  getIO().to(`user:${userId}`).emit(event, data);
};

export const emitOrderEvent = emitToUser;

export const emitToOrder = (orderId: string, event: string, data: unknown): void => {
  getIO().to(`order:${orderId}`).emit(event, data);
};

export const emitToBranch = (branchId: string, event: string, data: unknown): void => {
  getIO().to(`branch:${branchId}:ops`).emit(event, data);
};

export const emitToNamespace = (namespace: string, event: string, data: unknown): void => {
  getIO().of(namespace).emit(event, data);
};

export const broadcast = (namespace: string, event: string, data: unknown): void => {
  getIO().of(namespace).emit(event, data);
};

export const SOCKET_EVENTS = {
  ORDER_NEW: 'order:new',
  ORDER_UPDATE: 'order:update',
  ORDER_READY: 'order:ready',
  TABLE_SYNC: 'table:sync',
  STOCK_ALERT: 'stock:alert',
  NOTIFICATION: 'notification',
} as const;
