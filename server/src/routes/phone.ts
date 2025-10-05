import express from 'express';
import { telegramBotService } from '../bot/telegramBot';
import { users } from '../data';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Запрос номера телефона через Telegram Bot
 * POST /api/phone/request
 */
router.post('/request', async (req, res) => {
  try {
    const { telegramId, userId } = req.body;

    if (!telegramId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing telegramId or userId'
      });
    }

    // Проверяем, что пользователь существует
    const user = users.get(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Проверяем, что telegramId совпадает
    if (user.telegramId !== telegramId) {
      return res.status(400).json({
        success: false,
        error: 'Telegram ID mismatch'
      });
    }

    // Проверяем статус верификации телефона
    if (user.phoneVerificationStatus === 'VERIFIED') {
      return res.status(200).json({
        success: true,
        message: 'Phone already verified',
        data: { phone: user.phone }
      });
    }

    // Проверяем доступность бота
    if (!telegramBotService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Telegram Bot is not available'
      });
    }

    // Отправляем запрос через бота
    const success = await telegramBotService.requestPhone(telegramId, userId);

    if (success) {
      res.json({
        success: true,
        message: 'Phone request sent to Telegram Bot. Please check your chat with the bot.'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send phone request'
      });
    }

  } catch (error) {
    logger.error('Phone request error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Проверка статуса верификации телефона
 * GET /api/phone/status/:userId
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = users.get(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        phone: user.phone,
        phoneVerificationStatus: user.phoneVerificationStatus,
        isVerified: user.phoneVerificationStatus === 'VERIFIED'
      }
    });

  } catch (error) {
    logger.error('Phone status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Проверка статуса запроса телефона
 * GET /api/phone/request-status/:telegramId
 */
router.get('/request-status/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;

    const request = telegramBotService.getPhoneRequestStatus(telegramId);
    
    res.json({
      success: true,
      data: {
        hasRequest: request !== null,
        request: request ? {
          timestamp: request.timestamp,
          userId: request.userId
        } : null
      }
    });

  } catch (error) {
    logger.error('Phone request status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Отправка уведомления через Telegram Bot
 * POST /api/phone/notify
 */
router.post('/notify', async (req, res) => {
  try {
    const { telegramId, message } = req.body;

    if (!telegramId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing telegramId or message'
      });
    }

    if (!telegramBotService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Telegram Bot is not available'
      });
    }

    const success = await telegramBotService.sendNotification(telegramId, message);

    if (success) {
      res.json({
        success: true,
        message: 'Notification sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send notification'
      });
    }

  } catch (error) {
    logger.error('Phone notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
