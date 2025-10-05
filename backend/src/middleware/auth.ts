import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { CustomError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    telegramId: number;
    verificationStatus: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new CustomError('Access token required', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        telegramId: true,
        verificationStatus: true,
        createdAt: true,
      }
    });

    if (!user) {
      throw new CustomError('User not found', 401);
    }

    req.user = {
      id: user.id,
      telegramId: Number(user.telegramId),
      verificationStatus: user.verificationStatus,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  if (req.user.verificationStatus !== 'VERIFIED') {
    throw new CustomError('Account verification required', 403);
  }

  next();
};

export const requirePhoneVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  // Additional check for phone verification if needed
  next();
};
