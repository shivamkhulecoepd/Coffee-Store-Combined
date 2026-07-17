import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../middlewares/validation.middleware.js';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().optional(),
  role: z.enum(['CUSTOMER', 'BARISTA']).default('CUSTOMER'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceInfo: z.object({
    name: z.string().optional(),
    type: z.string().optional(),
  }).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  type: z.enum(['VERIFICATION', 'PASSWORD_RESET']),
  newPassword: z.string().min(8).optional(),
});

const resendOtpSchema = z.object({
  email: z.string().email(),
  type: z.enum(['VERIFICATION', 'PASSWORD_RESET']),
});

const controller = new AuthController();

// POST /auth/register
router.post(
  '/register',
  validateBody(registerSchema),
  (req: Request, res: Response, next: NextFunction) =>
    controller.register(req, res, next)
);

// POST /auth/login
router.post(
  '/login',
  validateBody(loginSchema),
  (req: Request, res: Response, next: NextFunction) =>
    controller.login(req, res, next)
);

// POST /auth/refresh
router.post(
  '/refresh',
  validateBody(refreshSchema),
  (req: Request, res: Response, next: NextFunction) =>
    controller.refresh(req, res, next)
);

// POST /auth/logout
router.post(
  '/logout',
  authenticate,
  (req: Request, res: Response, next: NextFunction) =>
    controller.logout(req, res, next)
);

// POST /auth/forgot-password
router.post(
  '/forgot-password',
  validateBody(forgotPasswordSchema),
  (req: Request, res: Response, next: NextFunction) =>
    controller.forgotPassword(req, res, next)
);

// POST /auth/verify-otp
router.post(
  '/verify-otp',
  validateBody(verifyOtpSchema),
  (req: Request, res: Response, next: NextFunction) =>
    controller.verifyOtp(req, res, next)
);

// POST /auth/resend-otp
router.post(
  '/resend-otp',
  validateBody(resendOtpSchema),
  (req: Request, res: Response, next: NextFunction) =>
    controller.resendOtp(req, res, next)
);

// GET /auth/me
router.get(
  '/me',
  authenticate,
  (req: Request, res: Response, next: NextFunction) =>
    controller.me(req, res, next)
);

export { router as authRouter };
