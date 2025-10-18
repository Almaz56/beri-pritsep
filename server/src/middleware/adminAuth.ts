import { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/adminService';
import { AdminRole } from '@prisma/client';

export interface AdminRequest extends Request {
  admin?: {
    id: number;
    email: string;
    role: AdminRole;
  };
}

export const authenticateAdmin = (req: AdminRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Admin access token required'
    });
  }

  const payload = adminService.verifyToken(token);
  if (!payload) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired admin token'
    });
  }

  req.admin = {
    id: payload.adminId,
    email: payload.email,
    role: payload.role
  };

  next();
};

export const requireRole = (requiredRole: AdminRole) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required'
      });
    }

    const roleHierarchy = {
      [AdminRole.MODERATOR]: 1,
      [AdminRole.ADMIN]: 2,
      [AdminRole.SUPER_ADMIN]: 3
    };

    const userRoleLevel = roleHierarchy[req.admin.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

export const requireSuperAdmin = requireRole(AdminRole.SUPER_ADMIN);
export const requireAdmin = requireRole(AdminRole.ADMIN);
export const requireModerator = requireRole(AdminRole.MODERATOR);
