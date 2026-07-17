import { Request, Response, NextFunction } from 'express';
import { authService } from '../../../domain/services/auth.service.js';
import { otpService } from '../../../domain/services/otp.service.js';
import { UnauthorizedError, ConflictError } from '../../../lib/errors.js';
import { OtpType } from '@prisma/client';

export class AuthController {
  /**
   * POST /auth/register
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName, phone, role } = req.body;

      const result = await authService.register(
        email,
        password,
        firstName,
        lastName,
        phone,
        role
      );

      // Send welcome email
      const { emailQueue } = await import('../../../infrastructure/queue/index.js');
      await emailQueue.add('welcome', {
        to: email,
        data: { firstName },
      });

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          profile: {
            id: result.profile.id,
            firstName: result.profile.firstName,
            lastName: result.profile.lastName,
            phone: result.profile.phone,
            loyaltyPoints: result.profile.loyaltyPoints,
            tier: result.profile.tier,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, deviceInfo } = req.body;

      const result = await authService.login(email, password, deviceInfo);

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        data: {
          user: result.user,
          profile: {
            id: result.profile.id,
            firstName: result.profile.firstName,
            lastName: result.profile.lastName,
            phone: result.profile.phone,
            loyaltyPoints: result.profile.loyaltyPoints,
            tier: result.profile.tier,
          },
          tokens: {
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
            expiresIn: result.tokens.expiresIn,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get refresh token from cookie or body
      const refreshToken =
        req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshToken) {
        throw new UnauthorizedError('Refresh token required');
      }

      const tokens = await authService.refreshTokens(refreshToken);

      // Set new refresh token as cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken;
      const accessToken = req.headers.authorization?.split(' ')[1];

      if (refreshToken && accessToken) {
        await authService.logout(refreshToken, accessToken);
      }

      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      const result = await otpService.generateOtp(email, 'PASSWORD_RESET');

      res.json({
        success: result.success,
        message: result.message,
        ...(result.expiresAt && { expiresAt: result.expiresAt }),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/verify-otp
   */
  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code, type, newPassword } = req.body as {
        email: string;
        code: string;
        type: 'VERIFICATION' | 'PASSWORD_RESET';
        newPassword?: string;
      };

      const otpType = type as OtpType;
      
      // Verify OTP
      const result = await otpService.verifyOtp(email, code, otpType);

      if (!result.valid) {
        throw new UnauthorizedError(result.message);
      }

      // If this is a password reset, update the password
      if (otpType === 'PASSWORD_RESET' && newPassword) {
        await authService.resetPassword(email, newPassword);
      }

      res.json({
        success: true,
        message: 'OTP verified successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/me
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getUserById(req.user!.userId);

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/resend-otp
   */
  async resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, type } = req.body as {
        email: string;
        type: 'VERIFICATION' | 'PASSWORD_RESET';
      };

      const result = await otpService.resendOtp(email, type as OtpType);

      res.json({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}
