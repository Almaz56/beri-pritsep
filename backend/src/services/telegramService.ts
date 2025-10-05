import crypto from 'crypto';
import axios from 'axios';

interface TelegramInitData {
  query_id: string;
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  auth_date: number;
  hash: string;
}

interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export class TelegramService {
  private botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  /**
   * Verify Telegram WebApp initData authenticity using HMAC
   */
  verifyInitData(initData: string): boolean {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      urlParams.delete('hash');

      // Sort parameters alphabetically
      const dataCheckString = Array.from(urlParams.keys())
        .sort()
        .map(key => `${key}=${urlParams.get(key)}`)
        .join('\n');

      // Create secret key from bot token
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(this.botToken)
        .digest();

      // Calculate expected hash
      const expectedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      return hash === expectedHash;
    } catch (error) {
      console.error('Error verifying Telegram initData:', error);
      return false;
    }
  }

  /**
   * Parse Telegram WebApp initData
   */
  parseInitData(initData: string): TelegramInitData | null {
    if (!this.verifyInitData(initData)) {
      return null;
    }

    try {
      const urlParams = new URLSearchParams(initData);
      const userParam = urlParams.get('user');
      
      const data: TelegramInitData = {
        query_id: urlParams.get('query_id') || '',
        user: userParam ? JSON.parse(userParam) : undefined,
        auth_date: parseInt(urlParams.get('auth_date') || '0'),
        hash: urlParams.get('hash') || '',
      };

      return data;
    } catch (error) {
      console.error('Error parsing Telegram initData:', error);
      return null;
    }
  }

  /**
   * Get user data from Telegram initData
   */
  extractUserData(initData: string): TelegramUserData | null {
    const parsedData = this.parseInitData(initData);
    return parsedData?.user || null;
  }

  /**
   * Send message via Telegram Bot API
   */
  async sendMessage(chatId: number, text: string, options?: any): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      
      const response = await axios.post(url, {
        chat_id: chatId,
        text,
        ...options,
        parse_mode: 'HTML',
      });

      return response.data.ok === true;
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      return false;
    }
  }

  /**
   * Send contact request notification
   */
  async requestContact(chatId: number, message: string): Promise<boolean> {
    return this.sendMessage(chatId, `📱 ${message}\n\nНажмите кнопку ниже для отправки номера телефона:`, {
      reply_markup: {
        keyboard: [
          [{
            text: '📲 Отправить номер телефона',
            request_contact: true
          }]
        ],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  }

  /**
   * Send verification status notification
   */
  async sendVerificationStatus(
    chatId: number, 
    status: 'VERIFIED' | 'REJECTED', 
    message?: string
  ): Promise<boolean> {
    const emoji = status === 'VERIFIED' ? '✅' : '❌';
    const defaultMessage = status === 'VERIFIED' 
      ? 'Ваши документы проверены и одобрены!' 
      : 'В документах найдены несоответствия. Проверьте их и попробуйте снова.';

    return this.sendMessage(chatId, `${emoji} ${message || defaultMessage}`);
  }

  /**
   * Send booking confirmation
   */
  async sendBookingConfirmation(
    chatId: number,
    bookingDetails: {
      trailerName: string;
      startTime: string;
      endTime: string;
      amount: number;
      depositAmount: number;
    }
  ): Promise<boolean> {
    const message = `
🚛 <b>Бронирование подтверждено!</b>

Прицеп: <b>${bookingDetails.trailerName}</b>
Период: ${bookingDetails.startTime} - ${bookingDetails.endTime}
Сумма аренды: <b>${bookingDetails.amount}₽</b>
Залог: <b>${bookingDetails.depositAmount}₽</b>

Ваш заказ принят в обработку!
    `;

    return this.sendMessage(chatId, message);
  }
}

// Export singleton instance
export const telegramService = new TelegramService(
  process.env.TELEGRAM_BOT_TOKEN || ''
);
