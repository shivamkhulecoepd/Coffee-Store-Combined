import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../infrastructure/database/prisma.js';
import {
  SessionStore,
  TokenBlacklist,
  CacheService,
} from '../../infrastructure/cache/redis.js';
import {
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { UserRole, Profile } from '@prisma/client';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'development-access-secret-key-min-32-chars';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'development-refresh-secret-key-min-32-chars';
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  branchId?: string;
  sessionId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const sessionStore = new SessionStore();
const tokenBlacklist = new TokenBlacklist();
const cache = new CacheService('auth:');

export class AuthService {
  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phone?: string,
    role: UserRole = 'CUSTOMER'
  ): Promise<{ user: { id: string; email: string; role: UserRole }; profile: Profile }> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Check phone uniqueness if provided
    if (phone) {
      const existingPhone = await prisma.profile.findUnique({
        where: { phone },
      });

      if (existingPhone) {
        throw new ConflictError('Phone number already registered');
      }
    }

    // Hash password
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Create user with profile in transaction
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        profile: {
          create: {
            firstName,
            lastName,
            phone,
            preferences: {},
          },
        },
      },
      include: { profile: true },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          email,
          role,
        },
      },
    });

    logger.info('User registered', { userId: user.id, email, role });

    return { user, profile: user.profile! };
  }

  /**
   * Login user
   */
  async login(
    email: string,
    password: string,
    deviceInfo?: { name?: string; type?: string }
  ): Promise<{
    user: { id: string; email: string; role: UserRole };
    profile: Profile;
    tokens: AuthTokens;
  }> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    const isValidPassword = await argon2.verify(user.passwordHash, password);

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role, user.branchId);

    // Store session
    await sessionStore.set(tokens.refreshToken, user.id, {
      email: user.email,
      role: user.role,
      deviceInfo,
      userAgent: deviceInfo?.name,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          deviceInfo,
        },
      },
    });

    logger.info('User logged in', { userId: user.id, email });

    return {
      user: { id: user.id, email: user.email, role: user.role },
      profile: user.profile!,
      tokens,
    };
  }

  /**
   * Generate access and refresh tokens
   */
  async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
    branchId?: string | null
  ): Promise<AuthTokens> {
    const sessionId = uuidv4();

    const accessToken = jwt.sign(
      { userId, email, role, branchId, sessionId },
      JWT_ACCESS_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId, sessionId, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY } as jwt.SignOptions
    );

    // Parse expiry for response
    const expiresIn = ACCESS_TOKEN_EXPIRY.includes('m')
      ? parseInt(ACCESS_TOKEN_EXPIRY) * 60
      : parseInt(ACCESS_TOKEN_EXPIRY) * 60 * 60;

    return { accessToken, refreshToken, expiresIn };
  }

  /**
   * Refresh access token
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as {
        userId: string;
        sessionId: string;
        type: string;
      };

      if (payload.type !== 'refresh') {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Check if token is blacklisted
      const isBlacklisted = await tokenBlacklist.isBlacklisted(refreshToken);
      if (isBlacklisted) {
        throw new UnauthorizedError('Token has been revoked');
      }

      // Check if session exists
      const session = await sessionStore.get(refreshToken);
      if (!session) {
        throw new UnauthorizedError('Session expired or invalid');
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedError('User not found or inactive');
      }

      // Blacklist old refresh token
      const tokenExp = jwt.decode(refreshToken) as { exp: number };
      const ttl = tokenExp.exp - Math.floor(Date.now() / 1000);
      await tokenBlacklist.add(refreshToken, ttl);

      // Generate new tokens
      const tokens = await this.generateTokens(user.id, user.email, user.role, user.branchId);

      // Store new session
      await sessionStore.set(tokens.refreshToken, user.id, session);

      return tokens;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(refreshToken: string, accessToken: string): Promise<void> {
    try {
      // Decode access token to get expiry
      const decoded = jwt.decode(accessToken) as { exp: number };
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);

      if (ttl > 0) {
        await tokenBlacklist.add(accessToken, ttl);
      }

      // Blacklist refresh token
      const refreshDecoded = jwt.decode(refreshToken) as { exp: number };
      const refreshTtl = refreshDecoded.exp - Math.floor(Date.now() / 1000);

      if (refreshTtl > 0) {
        await tokenBlacklist.add(refreshToken, refreshTtl);
      }

      // Delete session
      await sessionStore.delete(refreshToken);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'USER_LOGOUT',
          entityType: 'User',
          entityId: 'unknown',
          metadata: {
            reason: 'user_logout',
          },
        },
      });

      logger.info('User logged out');
    } catch (error) {
      logger.error('Logout error', { error });
    }
  }

  /**
   * Reset password (after OTP verification)
   */
  async resetPassword(email: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Hash new password
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'User',
        entityId: user.id,
      },
    });

    logger.info('Password reset completed', { userId: user.id });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const cached = await cache.get<{ id: string; email: string; role: UserRole }>(
      `user:${userId}`
    );

    if (cached) {
      return cached;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, branchId: true, profile: true },
    });

    if (user) {
      await cache.set(`user:${userId}`, user, 300); // 5 min cache
    }

    return user;
  }

  /**
   * Update user password (with current password verification)
   */
  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Verify current password
    const isValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    logger.info('Password updated', { userId });
  }
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET) as TokenPayload;
    return payload;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export const authService = new AuthService();
