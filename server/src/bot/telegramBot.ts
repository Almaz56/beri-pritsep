import TelegramBot from 'node-telegram-bot-api';
import logger from '../utils/logger';
import { users } from '../data';

interface PhoneRequest {
  telegramId: string;
  userId: string;
  timestamp: Date;
}

class TelegramBotService {
  private bot: TelegramBot | null = null;
  private phoneRequests = new Map<string, PhoneRequest>();
  private botToken: string;

  constructor() {
    this.botToken = process.env['BOT_TOKEN'] || '';
    if (!this.botToken) {
      logger.warn('BOT_TOKEN not provided. Telegram Bot will not be initialized.');
      return;
    }
    this.initializeBot();
  }

  private initializeBot(): void {
    try {
      this.bot = new TelegramBot(this.botToken, { polling: true });
      this.setupHandlers();
      logger.info('Telegram Bot initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Telegram Bot:', error);
    }
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    // Команда /start
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString();
      
      if (!telegramId) {
        this.bot?.sendMessage(chatId, 'Ошибка: не удалось определить ваш Telegram ID');
        return;
      }

      const user = Array.from(users.values()).find(u => u.telegramId === parseInt(telegramId));
      
      if (user) {
        this.bot?.sendMessage(chatId, 
          `Добро пожаловать в "Бери прицеп"!\n\n` +
          `Ваш профиль: ${user.firstName} ${user.lastName || ''}\n` +
          `Статус верификации: ${user.verificationStatus}\n\n` +
          `Этот бот работает автоматически с Mini App.\n` +
          `Для подтверждения номера телефона используйте Mini App.\n\n` +
          `Используйте /help для получения помощи.`
        );
      } else {
        this.bot?.sendMessage(chatId, 
          'Добро пожаловать в "Бери прицеп"!\n\n' +
          'Для начала работы откройте Mini App и пройдите авторизацию.\n\n' +
          'Используйте /help для получения помощи.'
        );
      }
    });

    // Команда /help
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      this.bot?.sendMessage(chatId, 
        '🤖 Помощь по боту "Бери прицеп"\n\n' +
        'Этот бот работает автоматически с Mini App.\n\n' +
        'Для подтверждения номера телефона:\n' +
        '1. Откройте Mini App\n' +
        '2. Перейдите в профиль\n' +
        '3. Нажмите "Подтвердить номер"\n' +
        '4. Следуйте инструкциям в этом чате\n\n' +
        'Если у вас есть вопросы, обратитесь в поддержку через Mini App.'
      );
    });

    // Обработка контактов
    this.bot.on('contact', (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString();
      const contact = msg.contact;

      if (!telegramId || !contact) {
        this.bot?.sendMessage(chatId, 'Ошибка: не удалось получить контакт');
        return;
      }

      // Проверяем, что контакт принадлежит пользователю
      if (contact.user_id?.toString() !== telegramId) {
        this.bot?.sendMessage(chatId, 
          'Ошибка: контакт должен принадлежать вам. Пожалуйста, отправьте свой номер телефона.'
        );
        return;
      }

      // Обновляем номер телефона пользователя
      this.updateUserPhone(telegramId, contact.phone_number)
        .then(() => {
          this.bot?.sendMessage(chatId, 
            `✅ Номер телефона успешно подтвержден!\n\n` +
            `Номер: ${contact.phone_number}\n\n` +
            `Теперь вы можете вернуться в Mini App и продолжить работу.`
          );
        })
        .catch((error) => {
          logger.error('Error updating user phone:', error);
          this.bot?.sendMessage(chatId, 
            'Ошибка при обновлении номера телефона. Попробуйте еще раз или обратитесь в поддержку.'
          );
        });
    });

    // Обработка ошибок
    this.bot.on('error', (error) => {
      logger.error('Telegram Bot error:', error);
    });

    // Обработка polling ошибок
    this.bot.on('polling_error', (error) => {
      logger.error('Telegram Bot polling error:', error);
    });
  }

  /**
   * Запрос номера телефона от пользователя
   */
  async requestPhone(telegramId: string, userId: string): Promise<boolean> {
    if (!this.bot) {
      logger.error('Telegram Bot not initialized');
      return false;
    }

    try {
      // Сохраняем запрос
      this.phoneRequests.set(telegramId, {
        telegramId,
        userId,
        timestamp: new Date()
      });

      // Отправляем сообщение пользователю
      await this.bot.sendMessage(telegramId, 
        '🔐 Подтверждение номера телефона\n\n' +
        'Вы запросили подтверждение номера телефона в Mini App.\n\n' +
        'Для завершения процесса нажмите кнопку ниже:',
        {
          reply_markup: {
            keyboard: [[{
              text: '📱 Отправить номер телефона',
              request_contact: true
            }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );

      logger.info(`Phone request sent to user ${telegramId}`);
      return true;
    } catch (error) {
      logger.error('Error sending phone request:', error);
      return false;
    }
  }

  /**
   * Обновление номера телефона пользователя
   */
  private async updateUserPhone(telegramId: string, phone: string): Promise<void> {
    const user = Array.from(users.values()).find(u => u.telegramId === parseInt(telegramId));
    
    if (!user) {
      throw new Error(`User with telegramId ${telegramId} not found`);
    }

    // Обновляем данные пользователя
    user.phone = phone;
    user.phoneVerificationStatus = 'VERIFIED';
    user.updatedAt = new Date();

    // Удаляем запрос
    this.phoneRequests.delete(telegramId);

    logger.info(`Phone updated for user ${user.id}: ${phone}`);
  }

  /**
   * Проверка статуса запроса телефона
   */
  getPhoneRequestStatus(telegramId: string): PhoneRequest | null {
    return this.phoneRequests.get(telegramId) || null;
  }

  /**
   * Отправка уведомления пользователю
   */
  async sendNotification(telegramId: string, message: string): Promise<boolean> {
    if (!this.bot) {
      logger.error('Telegram Bot not initialized');
      return false;
    }

    try {
      await this.bot.sendMessage(telegramId, message);
      logger.info(`Notification sent to user ${telegramId}`);
      return true;
    } catch (error) {
      logger.error('Error sending notification:', error);
      return false;
    }
  }

  /**
   * Проверка доступности бота
   */
  isAvailable(): boolean {
    return this.bot !== null;
  }

  /**
   * Остановка бота
   */
  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot = null;
      logger.info('Telegram Bot stopped');
    }
  }
}

export const telegramBotService = new TelegramBotService();
