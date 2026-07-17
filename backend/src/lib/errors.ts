import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger.js';

// Base error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    code?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  public errors?: Record<string, string[]>;

  constructor(message: string, errors?: Record<string, string[]>) {
    super(400, message, true, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, true, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, true, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, true, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, true, 'CONFLICT');
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, message, true, 'RATE_LIMITED');
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(500, message, false, 'INTERNAL_ERROR');
  }
}

// Factory functions for creating errors
export const createError = {
  badRequest: (message: string) => new AppError(400, message),
  unauthorized: (message = 'Unauthorized') => new UnauthorizedError(message),
  forbidden: (message = 'Forbidden') => new ForbiddenError(message),
  notFound: (resource = 'Resource') => new NotFoundError(resource),
  conflict: (message: string) => new ConflictError(message),
  tooManyRequests: (message = 'Too many requests') => new TooManyRequestsError(message),
  internal: (message = 'Internal server error') => new InternalError(message),
};

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
  });

  if (err instanceof ZodError) {
    const errors = err.errors.reduce((acc, curr) => {
      const path = curr.path.join('.');
      acc[path] = acc[path] || [];
      acc[path].push(curr.message);
      return acc;
    }, {} as Record<string, string[]>);

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof ValidationError && err.errors && { errors: err.errors }),
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
    },
  });
}
