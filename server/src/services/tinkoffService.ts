import crypto from 'crypto';
import logger from '../utils/logger';

export interface TinkoffPaymentRequest {
  OrderId: string;
  Amount: number;
  Description: string;
  CustomerKey: string;
  Recurrent?: 'Y';
  PayType?: 'O' | 'T';
  Language?: 'ru' | 'en';
  NotificationURL?: string;
  SuccessURL?: string;
  FailURL?: string;
  DATA?: Record<string, string>;
}

export interface TinkoffPaymentResponse {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  Details?: string;
  TerminalKey?: string;
  Status?: string;
  PaymentId?: string;
  OrderId?: string;
  Amount?: number;
  PaymentURL?: string;
}

export interface TinkoffHoldRequest {
  OrderId: string;
  Amount: number;
  Description: string;
  CustomerKey: string;
  Recurrent?: 'Y';
  PayType?: 'O' | 'T';
  Language?: 'ru' | 'en';
  NotificationURL?: string;
  SuccessURL?: string;
  FailURL?: string;
  DATA?: Record<string, string>;
}

export interface TinkoffHoldResponse {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  Details?: string;
  TerminalKey?: string;
  Status?: string;
  PaymentId?: string;
  OrderId?: string;
  Amount?: number;
  PaymentURL?: string;
}

export interface TinkoffWebhookData {
  TerminalKey: string;
  Status: string;
  PaymentId: string;
  OrderId: string;
  Amount: number;
  RebillId?: string;
  CardId?: string;
  Pan?: string;
  ExpDate?: string;
  Token: string;
}

class TinkoffService {
  private terminalKey: string;
  private secretKey: string;
  private baseURL: string;
  private isSandbox: boolean;
  private forceMock: boolean;

  constructor() {
    this.terminalKey = process.env['TINKOFF_TERMINAL_KEY'] || '';
    this.secretKey = process.env['TINKOFF_SECRET_KEY'] || '';
    this.isSandbox = process.env['TINKOFF_SANDBOX'] === 'true';
    this.forceMock = process.env['TINKOFF_FORCE_MOCK'] === 'true';
    this.baseURL = this.isSandbox 
      ? 'https://rest-api-test.tinkoff.ru/v2'
      : 'https://securepay.tinkoff.ru/v2';
    
    if (!this.terminalKey || !this.secretKey || this.forceMock) {
      logger.warn('Tinkoff credentials not configured, using mock mode');
    }
  }

  /**
   * Generate token for Tinkoff API request
   */
  private generateToken(data: Record<string, any>): string {
    // Алгоритм Tinkoff:
    // 1) Удалить Token
    // 2) Добавить Password=SecretKey в набор параметров
    // 3) Отсортировать ключи по алфавиту
    // 4) Сконкатенировать ТОЛЬКО значения (без ключей), игнорируя объекты/массивы
    // 5) SHA256 от полученной строки
    const params: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === 'Token') continue;
      if (v === undefined || v === null || v === '') continue;
      params[k] = v;
    }
    // Важный момент: секрет добавляется как параметр Password
    params['Password'] = this.secretKey;

    const orderedKeys = Object.keys(params).sort();
    const concatenated = orderedKeys
      .map(k => {
        const v = params[k];
        return typeof v === 'object' ? '' : String(v);
      })
      .join('');

    return crypto.createHash('sha256').update(concatenated).digest('hex');
  }

  /**
   * Verify webhook token
   */
  public verifyWebhookToken(data: TinkoffWebhookData): boolean {
    const { Token, ...dataWithoutToken } = data;
    const calculatedToken = this.generateToken(dataWithoutToken);
    return calculatedToken === Token;
  }

  /**
   * Create payment for rental
   */
  public async createPayment(request: TinkoffPaymentRequest): Promise<TinkoffPaymentResponse> {
    if (!this.terminalKey || !this.secretKey || this.forceMock) {
      return this.createMockPayment(request);
    }

    try {
      const requestData = {
        TerminalKey: this.terminalKey,
        Amount: request.Amount,
        OrderId: request.OrderId,
        Description: request.Description,
        CustomerKey: request.CustomerKey,
        ...request
      };

      const token = this.generateToken(requestData);
      (requestData as any).Token = token;

      const response = await fetch(`${this.baseURL}/Init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'BeriPritsepServer/1.0 (+https://api.beripritsep.ru)'
        },
        body: JSON.stringify(requestData),
      });

      const raw = await response.text();
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch { parsed = { Success: false, Message: `Bad JSON: ${raw}` }; }
      if (!response.ok) {
        logger.error('Tinkoff Init HTTP error:', response.status, raw);
      } else {
        logger.info('Tinkoff payment created:', parsed);
      }
      return parsed as TinkoffPaymentResponse;

    } catch (error) {
      logger.error('Tinkoff payment creation error:', error);
      return { Success: false, ErrorCode: 'NETWORK_ERROR', Message: 'Network error occurred' };
    }
  }

  /**
   * Create HOLD for deposit
   */
  public async createHold(request: TinkoffHoldRequest): Promise<TinkoffHoldResponse> {
    if (!this.terminalKey || !this.secretKey || this.forceMock) {
      return this.createMockHold(request);
    }

    try {
      const requestData = {
        TerminalKey: this.terminalKey,
        Amount: request.Amount,
        OrderId: request.OrderId,
        Description: request.Description,
        CustomerKey: request.CustomerKey,
        PayType: 'T', // HOLD (two-stage payment)
        ...request
      };

      const token = this.generateToken(requestData);
      (requestData as any).Token = token;

      const response = await fetch(`${this.baseURL}/Init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'BeriPritsepServer/1.0 (+https://api.beripritsep.ru)'
        },
        body: JSON.stringify(requestData),
      });

      const raw = await response.text();
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch { parsed = { Success: false, Message: `Bad JSON: ${raw}` }; }
      if (!response.ok) {
        logger.error('Tinkoff Hold Init HTTP error:', response.status, raw);
      } else {
        logger.info('Tinkoff hold created:', parsed);
      }
      return parsed as TinkoffPaymentResponse;

    } catch (error) {
      logger.error('Tinkoff hold creation error:', error);
      return { Success: false, ErrorCode: 'NETWORK_ERROR', Message: 'Network error occurred' };
    }
  }

  /**
   * Release HOLD (confirm payment)
   */
  public async releaseHold(paymentId: string, amount: number): Promise<TinkoffPaymentResponse> {
    if (!this.terminalKey || !this.secretKey || this.forceMock) {
      return this.createMockReleaseHold(paymentId, amount);
    }

    try {
      const requestData = {
        TerminalKey: this.terminalKey,
        PaymentId: paymentId,
        Amount: amount
      };

      const token = this.generateToken(requestData);
      (requestData as any).Token = token;

      const response = await fetch(`${this.baseURL}/Confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      logger.info('Tinkoff hold released:', result);
      return result as TinkoffPaymentResponse;

    } catch (error) {
      logger.error('Tinkoff hold release error:', error);
      return { Success: false, ErrorCode: 'NETWORK_ERROR', Message: 'Network error occurred' };
    }
  }

  /**
   * Cancel HOLD
   */
  public async cancelHold(paymentId: string): Promise<TinkoffPaymentResponse> {
    if (!this.terminalKey || !this.secretKey || this.forceMock) {
      return this.createMockCancelHold(paymentId);
    }

    try {
      const requestData = {
        TerminalKey: this.terminalKey,
        PaymentId: paymentId
      };

      const token = this.generateToken(requestData);
      (requestData as any).Token = token;

      const response = await fetch(`${this.baseURL}/Cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      logger.info('Tinkoff hold cancelled:', result);
      return result as TinkoffPaymentResponse;

    } catch (error) {
      logger.error('Tinkoff hold cancellation error:', error);
      return { Success: false, ErrorCode: 'NETWORK_ERROR', Message: 'Network error occurred' };
    }
  }

  /**
   * Confirm HOLD (retain deposit)
   */
  public async confirmHold(paymentId: string): Promise<TinkoffPaymentResponse> {
    if (!this.terminalKey || !this.secretKey || this.forceMock) {
      return this.createMockConfirmHold(paymentId);
    }

    try {
      const requestData = {
        TerminalKey: this.terminalKey,
        PaymentId: paymentId
      };

      const token = this.generateToken(requestData);
      (requestData as any).Token = token;

      const response = await fetch(`${this.baseURL}/Confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      logger.info('Tinkoff hold confirmed:', result);
      return result as TinkoffPaymentResponse;

    } catch (error) {
      logger.error('Tinkoff hold confirmation error:', error);
      return { Success: false, ErrorCode: 'NETWORK_ERROR', Message: 'Network error occurred' };
    }
  }

  /**
   * Get payment status
   */
  public async getPaymentStatus(paymentId: string): Promise<TinkoffPaymentResponse> {
    if (!this.terminalKey || !this.secretKey || this.forceMock) {
      return this.createMockPaymentStatus(paymentId);
    }

    try {
      const requestData = {
        TerminalKey: this.terminalKey,
        PaymentId: paymentId
      };

      const token = this.generateToken(requestData);
      (requestData as any).Token = token;

      const response = await fetch(`${this.baseURL}/GetState`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      logger.info('Tinkoff payment status:', result);
      return result as TinkoffPaymentResponse;

    } catch (error) {
      logger.error('Tinkoff payment status error:', error);
      return {
        Success: false,
        ErrorCode: 'NETWORK_ERROR',
        Message: 'Network error occurred'
      };
    }
  }

  // Mock methods for development
  private createMockPayment(request: TinkoffPaymentRequest): TinkoffPaymentResponse {
    logger.info('Creating mock payment:', request);
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';
    const pid = `mock_payment_${Date.now()}`;
    return {
      Success: true,
      TerminalKey: 'mock-terminal',
      Status: 'NEW',
      PaymentId: pid,
      OrderId: request.OrderId,
      Amount: request.Amount,
      // Используем внутренний URL фронтенда, чтобы не блокировалось в Telegram
      PaymentURL: `${frontendUrl}/payment/mock?paymentId=${pid}`
    };
  }

  private createMockHold(request: TinkoffHoldRequest): TinkoffHoldResponse {
    logger.info('Creating mock hold:', request);
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';
    const pid = `mock_hold_${Date.now()}`;
    return {
      Success: true,
      TerminalKey: 'mock-terminal',
      Status: 'NEW',
      PaymentId: pid,
      OrderId: request.OrderId,
      Amount: request.Amount,
      PaymentURL: `${frontendUrl}/payment/mock?paymentId=${pid}`
    };
  }

  private createMockReleaseHold(paymentId: string, amount: number): TinkoffPaymentResponse {
    logger.info('Releasing mock hold:', { paymentId, amount });
    return {
      Success: true,
      TerminalKey: 'mock-terminal',
      Status: 'CONFIRMED',
      PaymentId: paymentId,
      Amount: amount
    };
  }

  private createMockCancelHold(paymentId: string): TinkoffPaymentResponse {
    logger.info('Cancelling mock hold:', paymentId);
    return {
      Success: true,
      TerminalKey: 'mock-terminal',
      Status: 'CANCELLED',
      PaymentId: paymentId
    };
  }

  private createMockConfirmHold(paymentId: string): TinkoffPaymentResponse {
    logger.info('Confirming mock hold:', paymentId);
    return {
      Success: true,
      TerminalKey: 'mock-terminal',
      Status: 'CONFIRMED',
      PaymentId: paymentId
    };
  }

  private createMockPaymentStatus(paymentId: string): TinkoffPaymentResponse {
    logger.info('Getting mock payment status:', paymentId);
    return {
      Success: true,
      TerminalKey: 'mock-terminal',
      Status: 'CONFIRMED',
      PaymentId: paymentId,
      Amount: 1000
    };
  }
}

export const tinkoffService = new TinkoffService();
