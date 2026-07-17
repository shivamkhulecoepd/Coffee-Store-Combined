import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../lib/logger.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { emailQueue } from '../../infrastructure/queue/index.js';
import { OtpType } from '@prisma/client';

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '10', 10);
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);
const MAX_ATTEMPTS = 3;

export interface OtpResult {
  success: boolean;
  message: string;
  code?: string;
  expiresAt?: Date;
}

class OtpService {
  /**
   * Generate a random OTP code
   */
  private generateCode(): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < OTP_LENGTH; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    return code;
  }

  /**
   * Generate OTP for a user
   */
  async generateOtp(
    email: string,
    type: OtpType,
    userId?: string
  ): Promise<OtpResult> {
    try {
      // Find user if userId not provided
      if (!userId) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          // Don't reveal if user exists
          return {
            success: true,
            message: 'If an account exists with this email, an OTP has been sent',
          };
        }
        userId = user.id;
      }

      // Invalidate any existing OTPs of this type
      await prisma.otpCode.updateMany({
        where: {
          email,
          type,
          usedAt: null,
        },
        data: {
          usedAt: new Date(), // Mark as used/invalid
        },
      });

      // Generate new OTP
      const code = this.generateCode();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await prisma.otpCode.create({
        data: {
          userId,
          email,
          code,
          type,
          expiresAt,
        },
      });

      // Queue email (in production, send actual email)
      await emailQueue.add('otp', {
        to: email,
        subject: type === 'PASSWORD_RESET' 
          ? 'Password Reset Code - Bean & Brew'
          : 'Email Verification Code - Bean & Brew',
        template: type === 'PASSWORD_RESET' ? 'password-reset-otp' : 'verification-otp',
        data: {
          code,
          expiresIn: OTP_EXPIRY_MINUTES,
        },
      });

      logger.info('OTP generated', { email, type, expiresAt });

      // In development, return the code for testing
      if (process.env.NODE_ENV === 'development') {
        return {
          success: true,
          message: 'OTP sent successfully',
          code, // Only in development!
          expiresAt,
        };
      }

      return {
        success: true,
        message: 'OTP sent successfully',
        expiresAt,
      };
    } catch (error) {
      logger.error('OTP generation failed', { error, email, type });
      throw error;
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(
    email: string,
    code: string,
    type: OtpType
  ): Promise<{ valid: boolean; message: string }> {
    const otp = await prisma.otpCode.findFirst({
      where: {
        email,
        code,
        type,
        usedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otp) {
      throw new ValidationError('Invalid or expired OTP');
    }

    // Check if expired
    if (new Date() > otp.expiresAt) {
      throw new ValidationError('OTP has expired');
    }

    // Check attempts
    if (otp.attempts >= MAX_ATTEMPTS) {
      await prisma.otpCode.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });
      throw new ValidationError('Too many attempts. Please request a new OTP');
    }

    // Increment attempts
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    // Mark as used
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });

    logger.info('OTP verified successfully', { email, type });

    return {
      valid: true,
      message: 'OTP verified successfully',
    };
  }

  /**
   * Resend OTP
   */
  async resendOtp(email: string, type: OtpType): Promise<OtpResult> {
    // Rate limit: don't allow more than 3 OTP requests per 10 minutes
    const recentOtpCount = await prisma.otpCode.count({
      where: {
        email,
        type,
        createdAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000), // Last 10 minutes
        },
      },
    });

    if (recentOtpCount >= 3) {
      throw new ValidationError(
        'Too many OTP requests. Please wait 10 minutes before requesting again'
      );
    }

    return this.generateOtp(email, type);
  }

  /**
   * Clean up expired OTPs (called by worker)
   */
  async cleanupExpiredOtps(): Promise<number> {
    const result = await prisma.otpCode.deleteMany({
      where: {
        OR: [
          // Expired
          { expiresAt: { lt: new Date() } },
          // Used more than 24 hours ago
          {
            usedAt: {
              not: null,
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
    });

    logger.info('Expired OTPs cleaned up', { deletedCount: result.count });
    return result.count;
  }
}

export const otpService = new OtpService();
