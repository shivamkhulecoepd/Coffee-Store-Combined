import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../../../lib/errors.js';
import { verifyAccessToken, TokenPayload } from '../../../domain/services/auth.service.js';
import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Invalid token format');
    }
    const payload = verifyAccessToken(token);

    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}

export function authorizeMinRole(minRole: UserRole) {
  const roleHierarchy: Record<UserRole, number> = {
    SUPER_ADMIN: 5,
    ADMIN: 4,
    MANAGER: 3,
    BARISTA: 2,
    CUSTOMER: 1,
  };

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRoleLevel = roleHierarchy[req.user.role as UserRole] || 0;
    const minRoleLevel = roleHierarchy[minRole] || 0;

    if (userRoleLevel < minRoleLevel) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}

export function authorizeBranch(branchIdParam = 'branchId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // SUPER_ADMIN and ADMIN bypass branch restrictions
    if (['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      return next();
    }

    // Check if user's branch matches the requested branch
    const requestedBranchId = req.params[branchIdParam] || req.body.branchId;

    if (requestedBranchId && req.user.branchId && requestedBranchId !== req.user.branchId) {
      return next(new ForbiddenError('Access to this branch is not allowed'));
    }

    next();
  };
}
