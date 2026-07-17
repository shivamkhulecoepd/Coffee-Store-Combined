import { createServer } from 'http';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/prisma.js';
import { connectRedis, disconnectRedis } from './infrastructure/cache/redis.js';
import { initializeSocketIO } from './lib/socket.js';
import { validateEnvironment } from './lib/env.js';

const PORT = parseInt(process.env.PORT || '4000', 10);

async function bootstrap(): Promise<void> {
  try {
    // Validate environment variables
    validateEnvironment();

    logger.info('Starting Bean & Brew OS Backend...');

    // Connect to PostgreSQL via Prisma
    await connectDatabase();
    logger.info('Database connected successfully');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected successfully');

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.IO
    initializeSocketIO(httpServer);
    logger.info('Socket.IO initialized');

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      httpServer.close(async () => {
        logger.info('HTTP server closed');

        await disconnectDatabase();
        logger.info('Database disconnected');

        await disconnectRedis();
        logger.info('Redis disconnected');

        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

bootstrap();
