import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  profile: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  session: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    delete: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  otpCode: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('../../src/infrastructure/database/prisma.js', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../src/lib/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/lib/jwt.js', () => ({
  jwtService: {
    generateAccessToken: jest.fn().mockReturnValue('mock_access_token'),
    generateRefreshToken: jest.fn().mockReturnValue('mock_refresh_token'),
    verifyToken: jest.fn().mockReturnValue({ userId: 'user-1' }),
  },
}));

jest.mock('../../src/infrastructure/cache/redis.js', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
  sessionStore: {
    create: jest.fn(),
    delete: jest.fn(),
  },
  tokenBlacklist: {
    blacklist: jest.fn(),
  },
}));

jest.mock('../../src/infrastructure/queue/index.js', () => ({
  emailQueue: {
    add: jest.fn(),
  },
}));

import { authService } from '../../src/domain/services/auth.service.js';

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should reject duplicate email', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      });

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should reject duplicate phone', async () => {
      mockPrisma.user.findUnique = jest.fn()
        .mockResolvedValueOnce(null) // Email check
        .mockResolvedValueOnce({
          id: 'existing-user',
          phone: '+1234567890',
        }); // Phone check

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
        })
      ).rejects.toThrow('Phone number already registered');
    });

    it('should create user successfully', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.user.create = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'CUSTOMER',
        isActive: true,
      });
      mockPrisma.profile.create = jest.fn().mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        loyaltyPoints: 0,
      });
      mockPrisma.session.create = jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
      });
      mockPrisma.auditLog.create = jest.fn().mockResolvedValue({});

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBe('mock_access_token');
    });
  });

  describe('login', () => {
    it('should reject invalid email', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject inactive user', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        isActive: false,
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Account is deactivated');
    });

    it('should login successfully with correct credentials', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        role: 'CUSTOMER',
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      mockPrisma.user.update = jest.fn().mockResolvedValue({});
      mockPrisma.session.create = jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
      });
      mockPrisma.auditLog.create = jest.fn().mockResolvedValue({});

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
    });
  });

  describe('refreshToken', () => {
    it('should reject invalid refresh token', async () => {
      const mockJwt = require('../../src/lib/jwt.js');
      mockJwt.jwtService.verifyToken = jest.fn().mockReturnValue(null);

      await expect(
        authService.refreshToken('invalid_refresh_token')
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should reject blacklisted token', async () => {
      const mockCache = require('../../src/infrastructure/cache/redis.js');
      mockCache.tokenBlacklist.blacklist = jest.fn().mockResolvedValue(true);

      const mockJwt = require('../../src/lib/jwt.js');
      mockJwt.jwtService.verifyToken = jest.fn().mockReturnValue({
        userId: 'user-1',
        tokenId: 'token-1',
        type: 'refresh',
      });

      await expect(
        authService.refreshToken('blacklisted_token')
      ).rejects.toThrow('Token has been revoked');
    });

    it('should refresh token successfully', async () => {
      mockPrisma.session.findMany = jest.fn().mockResolvedValue([
        { id: 'session-1', isValid: true },
      ]);
      mockPrisma.session.update = jest.fn().mockResolvedValue({});
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'CUSTOMER',
        isActive: true,
      });

      const result = await authService.refreshToken('valid_refresh_token');

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate OTP for existing user', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      mockPrisma.otpCode.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.otpCode.create = jest.fn().mockResolvedValue({
        id: 'otp-1',
        code: '123456',
      });
      mockPrisma.auditLog.create = jest.fn().mockResolvedValue({});

      const result = await authService.requestPasswordReset('test@example.com');

      expect(result).toBeDefined();
      expect(result.message).toBe('OTP sent successfully');
    });

    it('should not reveal if email exists', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null);

      const result = await authService.requestPasswordReset('nonexistent@example.com');

      expect(result.message).toBe('OTP sent successfully');
      // In production, email existence should not be revealed
    });
  });

  describe('resetPassword', () => {
    it('should reject invalid OTP', async () => {
      mockPrisma.otpCode.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        authService.resetPassword({
          email: 'test@example.com',
          otp: '123456',
          newPassword: 'newpassword123',
        })
      ).rejects.toThrow('Invalid or expired OTP');
    });

    it('should reject expired OTP', async () => {
      const expiredDate = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      mockPrisma.otpCode.findFirst = jest.fn().mockResolvedValue({
        id: 'otp-1',
        code: '123456',
        expiresAt: expiredDate,
        isUsed: false,
      });

      await expect(
        authService.resetPassword({
          email: 'test@example.com',
          otp: '123456',
          newPassword: 'newpassword123',
        })
      ).rejects.toThrow('Invalid or expired OTP');
    });

    it('should reset password successfully', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000);
      mockPrisma.otpCode.findFirst = jest.fn().mockResolvedValue({
        id: 'otp-1',
        code: '123456',
        expiresAt: futureDate,
        isUsed: false,
      });
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      mockPrisma.user.update = jest.fn().mockResolvedValue({});
      mockPrisma.otpCode.update = jest.fn().mockResolvedValue({});
      mockPrisma.session.deleteMany = jest.fn().mockResolvedValue({});
      mockPrisma.auditLog.create = jest.fn().mockResolvedValue({});

      const result = await authService.resetPassword({
        email: 'test@example.com',
        otp: '123456',
        newPassword: 'newpassword123',
      });

      expect(result).toBeDefined();
      expect(result.message).toBe('Password reset successfully');
    });
  });
});
