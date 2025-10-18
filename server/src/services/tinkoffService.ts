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

  constructor() {
    this.terminalKey = process.env['TINKOFF_TERMINAL_KEY'] || '';
    this.secretKey = process.env['TINKOFF_SECRET_KEY'] || '';
    this.isSandbox = process.env['TINKOFF_SANDBOX'] === 'true';
    this.baseURL = this.isSandbox 
      ? 'https://rest-api-test.tinkoff.ru/v2'
      : 'https://securepay.tinkoff.ru/v2';
    
    if (!this.terminalKey || !this.secretKey) {
      logger.warn('Tinkoff credentials not configured, using mock mode');
    }
  }

  /**
   * Generate token for Tinkoff API request
   */
  private generateToken(data: Record<string, any>): string {
    const sortedData = Object.keys(data)
      .sort()
      .reduce((result, key) => {
        result[key] = data[key];
        return result as TinkoffPaymentResponse;
      }, {} as Record<string, any>);

    const dataString = Object.entries(sortedData)
      .map(([key, value]) => `${key}=${value}`)
      .join('');

    return crypto
      .createHash('sha256')
      .update(dataString + this.secretKey)
      .digest('hex');
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
    if (!this.terminalKey || !this.secretKey) {
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
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      logger.info('Tinkoff payment created:', result);
      return result as TinkoffPaymentResponse;

    } catch (error) {
      logger.error('Tinkoff payment creation error:', error);
      return {
        Success: false,
        ErrorCode: 'NETWORK_ERROR',
        Message: 'Network error occurred'
      };
    }
  }

  /**
   * Create HOLD for deposit
   */
  public async createHold(request: TinkoffHoldRequest): Promise<TinkoffHoldResponse> {
    if (!this.terminalKey || !this.secretKey) {
      return this.createMockHold(request);
    }

    try {
      const requestData = {
        TerminalKey: this.terminalKey,
        Amount: request.Amount,
        OrderId: request.OrderId,
        Description: request.Description,
        CustomerKey: request.CustomerKey,
        PayType: 'H', // HOLD type
        ...request
      };

      const token = this.generateToken(requestData);
      (requestData as any).Token = token;

      const response = await fetch(`${this.baseURL}/Init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      logger.info('Tinkoff hold created:', result);
      return result as TinkoffPaymentResponse;

    } catch (error) {
      logger.error('Tinkoff hold creation error:', error);
      return {
        Success: false,
        ErrorCode: 'NETWORK_ERROR',
        Message: 'Network error occurred'
      };
    }
  }

  /**
   * Release HOLD (confirm payment)
   */
  public async releaseHold(paymentId: string, amount: number): Promise<TinkoffPaymentResponse> {
    if (!this.terminalKey || !this.secretKey) {
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
      return {
        Success: false,
        ErrorCode: 'NETWORK_ERROR',
        Message: 'Network error occurred'
      };
    }
  }

  /**
   * Cancel HOLD
   */
  public async cancelHold(paymentId: string): Promise<TinkoffPaymentResponse> {
    if (!this.terminalKey || !this.secretKey) {
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
      return {
        Success: false,
        ErrorCode: 'NETWORK_ERROR',
        Message: 'Network error occurred'
      };
    }
  }

  /**
   * Confirm HOLD (retain deposit)
   */
  public async confirmHold(paymentId: string): Promise<TinkoffPaymentResponse> {
    if (!this.terminalKey || !this.secretKey) {
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
      return {
        Success: false,
        ErrorCode: 'NETWORK_ERROR',
        Message: 'Network error occurred'
      };
    }
  }

  /**
   * Get payment status
   */
  public async getPaymentStatus(paymentId: string): Promise<TinkoffPaymentResponse> {
    if (!this.terminalKey || !this.secretKey) {
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
    return {
      Success: true,
      TerminalKey: 'mock-terminal',
      Status: 'NEW',
      PaymentId: `mock_payment_${Date.now()}`,
      OrderId: request.OrderId,
      Amount: request.Amount,
      PaymentURL: `https://mock-payment.tinkoff.ru/pay?paymentId=mock_payment_${Date.now()}`
    };
  }

  private createMockHold(request: TinkoffHoldRequest): TinkoffHoldResponse {
    logger.info('Creating mock hold:', request);
    return {
      Success: true,
      TerminalKey: 'mock-terminal',
      Status: 'NEW',
      PaymentId: `mock_hold_${Date.now()}`,
      OrderId: request.OrderId,
      Amount: request.Amount,
      PaymentURL: `https://mock-payment.tinkoff.ru/hold?paymentId=mock_hold_${Date.now()}`
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
