import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { telegramService } from './telegramService';
import { CustomError } from '../middleware/errorHandler';
import { TelegramUserData } from '../types';

export interface AuthResult {
  user: {
    id: number;
    telegramId: number;
    firstName: string;
    lastName?: string;
    username?: string;
    phoneNumber?: string;
    verificationStatus: string;
  };
  tokens: {
    accessToken: string;
  };
}

export class AuthService {
  /**
   * Process Telegram WebApp authentication
   */
  async authenticateWithTelegram(initData: string): Promise<AuthResult> {
    // Verify Telegram initData
    const userData = telegramService.extractUserData(initData);
    if (!userData) {
      throw new CustomError('Invalid Telegram authentication data', 401);
    }

    return this.processUserAuth(userData);
  }

  /**
   * Process user authentication (create or update user)
   */
  private async processUserAuth(telegramData: TelegramUserData): Promise<AuthResult> {
    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramData.id) }
    });

    // Create new user if doesn't exist
    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: BigInt(telegramData.id),
          firstName: telegramData.first_name,
          lastName: telegramData.last_name || null,
          username: telegramData.username || null,
          verificationStatus: 'PENDING',
        }
      });
    } else {
      // Update existing user data
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: telegramData.first_name,
          lastName: telegramData.last_name || null,
          username: telegramData.username || null,
        }
      });
    }

    // Generate JWT token
    const accessToken = this.generateAccessToken(user.id);

    return {
      user: {
        id: user.id,
        telegramId: Number(user.telegramId),
        firstName: user.firstName,
        lastName: user.lastName || undefined,
        username: user.username || undefined,
        phoneNumber: user.phoneNumber || undefined,
        verificationStatus: user.verificationStatus,
      },
      tokens: {
        accessToken,
      }
    };
  }

  /**
   * Update user phone number
   */
  async updatePhoneNumber(
    userId: number, 
    phoneNumber: string
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { phoneNumber }
    });
  }

  /**
   * Generate JWT access token
   */
  private generateAccessToken(userId: number): string {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { userId: number } | null {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      return { userId: decoded.userId };
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh user token
   */
  async refreshToken(userId: number): Promise<{ accessToken: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, createdAt: true }
    });

    if (!user) {
      throw new CustomError('User not found', 401);
    }

    const accessToken = this.generateAccessToken(userId);

    return { accessToken };
  }

  /**
   * Send phone verification request via Telegram
   */
  async requestPhoneVerification(userId: number): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, firstName: true }
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    await telegramService.requestContact(
      Number(user.telegramId),
      `Привет, ${user.firstName}! Нам нужен ваш номер телефона для подтверждения бронирования.`
    );
  }
}

export const authService = new AuthService();
