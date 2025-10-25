import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    telegramId: number;
    firstName: string;
    lastName: string;
    username: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  logger.info('Auth middleware started for:', req.path);
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Fallback: allow X-Telegram-Init-Data when no Bearer token (TWA auto-login)
  const telegramInitData = req.header('x-telegram-init-data');
  if (!token && telegramInitData) {
    // Attach placeholder user, the route may not require full profile
    (req as any).user = { id: '0' } as any;
    logger.info('Auth middleware: using telegram init data (fallback user id=0)');
    return next();
  }

  if (!token) {
    logger.info('Auth middleware: no token found');
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  const jwtSecret = process.env['JWT_SECRET'] || 'supersecretjwtkey';
  logger.info('Auth middleware: verifying token...');

  jwt.verify(token, jwtSecret, (err: any, user: any) => {
    if (err) {
      logger.warn('Invalid token:', err.message);
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }

    logger.info('Auth middleware: token verified, setting user');
    req.user = user;
    next();
  });
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  const jwtSecret = process.env['JWT_SECRET'] || 'supersecretjwtkey';

  jwt.verify(token, jwtSecret, (err: any, user: any) => {
    if (!err && user) {
      req.user = user;
    }
    next();
  });
};
