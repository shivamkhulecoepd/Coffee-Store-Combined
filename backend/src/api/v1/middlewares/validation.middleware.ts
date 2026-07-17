import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../../../lib/errors.js';

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        const errors = result.error.errors.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = acc[path] || [];
          acc[path].push(err.message);
          return acc;
        }, {} as Record<string, string[]>);
        
        throw new ValidationError('Validation failed', errors);
      }
      
      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.query);
      
      if (!result.success) {
        const errors = result.error.errors.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = acc[path] || [];
          acc[path].push(err.message);
          return acc;
        }, {} as Record<string, string[]>);
        
        throw new ValidationError('Invalid query parameters', errors);
      }
      
      req.query = result.data as any;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate request params against a Zod schema
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.params);
      
      if (!result.success) {
        const errors = result.error.errors.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = acc[path] || [];
          acc[path].push(err.message);
          return acc;
        }, {} as Record<string, string[]>);
        
        throw new ValidationError('Invalid URL parameters', errors);
      }
      
      req.params = result.data as any;
      next();
    } catch (error) {
      next(error);
    }
  };
}
