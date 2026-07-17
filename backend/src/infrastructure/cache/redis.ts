import { createRequire } from 'module';
import { logger } from '../../lib/logger.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Redis = require('ioredis');

type RedisClient = InstanceType<typeof Redis>;

const globalForRedis = globalThis as unknown as {
  redis: RedisClient | undefined;
};

function createRedisClient(): RedisClient {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (error: Error) => logger.error('Redis error', { error: error.message }));
redis.on('close', () => logger.warn('Redis connection closed'));

export async function connectRedis(): Promise<void> {
  try {
    await redis.ping();
    logger.info('Redis ping successful');
  } catch (error) {
    logger.error('Failed to connect to Redis', { error });
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis disconnected');
  } catch (error) {
    logger.error('Error disconnecting from Redis', { error });
    throw error;
  }
}

export class CacheService {
  private prefix: string;

  constructor(prefix = 'bb:') {
    this.prefix = prefix;
  }

  private key(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(this.key(key));
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(this.key(key), ttlSeconds, data);
    } else {
      await redis.set(this.key(key), data);
    }
  }

  async del(key: string): Promise<void> {
    await redis.del(this.key(key));
  }

  async exists(key: string): Promise<boolean> {
    return (await redis.exists(this.key(key))) === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    return redis.keys(`${this.prefix}${pattern}`);
  }

  async flushPattern(pattern: string): Promise<void> {
    const keys = await this.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

export class RateLimiter {
  constructor(private windowMs = 900000, private maxRequests = 100) {}

  async isAllowed(identifier: string): Promise<{ allowed: boolean; remaining: number; reset: number }> {
    const now = Date.now();
    const windowKey = `ratelimit:window:${identifier}`;

    await redis.zremrangebyscore(windowKey, 0, now - this.windowMs);
    const count = await redis.zcard(windowKey);

    if (count >= this.maxRequests) {
      const oldestEntry = await redis.zrange(windowKey, 0, 0, 'WITHSCORES');
      const reset = oldestEntry.length > 1 ? parseInt(oldestEntry[1] || '0') + this.windowMs : now + this.windowMs;
      return { allowed: false, remaining: 0, reset };
    }

    await redis.zadd(windowKey, now, `${now}:${Math.random()}`);
    await redis.expire(windowKey, Math.ceil(this.windowMs / 1000));

    return { allowed: true, remaining: this.maxRequests - count - 1, reset: now + this.windowMs };
  }
}

export class SessionStore {
  private prefix = 'session:';
  private ttl = 7 * 24 * 60 * 60;

  async set(token: string, userId: string, data: Record<string, unknown> = {}): Promise<void> {
    await redis.setex(`${this.prefix}${token}`, this.ttl, JSON.stringify({ userId, ...data, createdAt: Date.now() }));
  }

  async get(token: string): Promise<Record<string, unknown> | null> {
    const data = await redis.get(`${this.prefix}${token}`);
    return data ? JSON.parse(data) : null;
  }

  async delete(token: string): Promise<void> {
    await redis.del(`${this.prefix}${token}`);
  }

  async exists(token: string): Promise<boolean> {
    return (await redis.exists(`${this.prefix}${token}`)) === 1;
  }

  async extend(token: string): Promise<void> {
    await redis.expire(`${this.prefix}${token}`, this.ttl);
  }
}

export class TokenBlacklist {
  private prefix = 'blacklist:';

  async add(token: string, expiresInSeconds: number): Promise<void> {
    await redis.setex(`${this.prefix}${token}`, expiresInSeconds, '1');
  }

  async isBlacklisted(token: string): Promise<boolean> {
    return (await redis.exists(`${this.prefix}${token}`)) === 1;
  }
}

export const cacheService = new CacheService('bb:');
export const rateLimiter = new RateLimiter();
export const sessionStore = new SessionStore();
export const tokenBlacklist = new TokenBlacklist();
