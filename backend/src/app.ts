import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { v1Router } from './api/v1/routes/index.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { logger } from './lib/logger.js';

const API_VERSION = '1.0.0';

export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000','http://localhost:5173','http://localhost:5555'],
    credentials: true,
  }));

  // Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Compression
  app.use(compression());

  // Logging
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));

  // Health check (before routes)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get('/ready', async (_req: Request, res: Response) => {
    try {
      // Check database connection
      const { prisma } = await import('./infrastructure/database/prisma.js');
      await prisma.$queryRaw`SELECT 1`;

      // Check Redis connection
      const { redis } = await import('./infrastructure/cache/redis.js');
      await redis.ping();

      res.json({
        status: 'ready',
        checks: {
          database: 'ok',
          redis: 'ok',
        },
      });
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/live', (_req: Request, res: Response) => {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  // API versioning header for all routes
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-API-Version', API_VERSION);
    next();
  });

  // API routes
  app.use('/api/v1', v1Router);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Export API version for use in other files
export { API_VERSION };
