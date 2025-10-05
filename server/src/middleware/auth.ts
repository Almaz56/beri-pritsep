import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    telegramId: number;
    firstName: string;
    lastName: string;
    username: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  const jwtSecret = process.env['JWT_SECRET'] || 'supersecretjwtkey';

  jwt.verify(token, jwtSecret, (err: any, user: any) => {
    if (err) {
      logger.warn('Invalid token:', err.message);
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }

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
