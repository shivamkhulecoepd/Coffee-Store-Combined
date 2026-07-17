import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { app } from '../src/app.js';
import request from 'supertest';

// Mock dependencies
jest.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../src/infrastructure/cache/redis.js', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
  rateLimiter: {
    check: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../src/lib/socket.js', () => ({
  emitOrderEvent: jest.fn(),
  emitUserEvent: jest.fn(),
}));

const mockPrisma = require('../src/infrastructure/database/prisma.js').prisma;
const mockCacheService = require('../src/infrastructure/cache/redis.js').cacheService;

describe('Auth API', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          firstName: 'John',
          lastName: 'Doe',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          phone: 'invalid-phone',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'some-token',
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });
});

describe('Health Endpoints', () => {
  it('GET /health should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('GET /ready should return 200', async () => {
    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
  });

  it('GET /live should return 200', async () => {
    const response = await request(app).get('/live');
    expect(response.status).toBe(200);
  });
});

describe('API Version', () => {
  it('should have correct API version header', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['x-api-version']).toBe('1.0.0');
  });
});
