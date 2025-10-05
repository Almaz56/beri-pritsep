import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { authService } from '../services/authService';
import { telegramService } from '../services/telegramService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { CustomError } from '../middleware/errorHandler';

const router = Router();

/**
 * POST /api/auth/telegram
 * Authenticate with Telegram WebApp initData
 */
router.post('/telegram', asyncHandler(async (req, res) => {
  const { initData } = req.body;

  if (!initData) {
    throw new CustomError('Telegram initData is required', 400);
  }

  const result = await authService.authenticateWithTelegram(initData);

  res.json({
    success: true,
    data: result,
    message: 'Authentication successful'
  });
}));

/**
 * POST /api/auth/phone
 * Update user phone number
 */
router.post('/phone', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { phoneNumber } = req.body;
  const userId = req.user!.id;

  if (!phoneNumber) {
    throw new CustomError('Phone number is required', 400);
  }

  // Basic phone number validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phoneNumber)) {
    throw new CustomError('Invalid phone number format', 400);
  }

  await authService.updatePhoneNumber(userId, phoneNumber);

  res.json({
    success: true,
    message: 'Phone number updated successfully'
  });
}));

/**
 * POST /api/auth/request-phone
 * Request phone verification via Telegram bot
 */
router.post('/request-phone', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  await authService.requestPhoneVerification(userId);

  res.json({
    success: true,
    message: 'Phone verification request sent to Telegram'
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  const tokens = await authService.refreshToken(userId);

  res.json({
    success: true,
    data: tokens,
    message: 'Token refreshed successfully'
  });
}));

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      telegramId: true,
      firstName: true,
      lastName: true,
      username: true,
      phoneNumber: true,
      verificationStatus: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user) {
    throw new CustomError('User not found', 404);
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      telegramId: Number(user.telegramId),
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      phoneNumber: user.phoneNumber,
      verificationStatus: user.verificationStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  });
}));

/**
 * POST /api/auth/logout
 * Logout user (if needed for future implementations)
 */
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  // For JWT tokens, logout is mostly handled client-side
  // In future implementations, we could maintain a blacklist
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

export default router;
