import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { showTelegramAlert } from '../telegram';
import { getAuthToken } from '../api';
import './PaymentHandler.css';

interface PaymentHandlerProps {
  bookingId: string;
  amount: number;
  paymentType: 'RENTAL' | 'DEPOSIT_HOLD';
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface PaymentResponse {
  success: boolean;
  data?: {
    paymentId: string;
    paymentUrl: string;
  };
  error?: string;
}

const PaymentHandler: React.FC<PaymentHandlerProps> = ({
  bookingId,
  amount,
  paymentType,
  onSuccess,
  onError
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 
    (window.location.hostname === 'app.beripritsep.ru' 
      ? 'https://api.beripritsep.ru/api' 
      : 'http://localhost:8080/api');

  const createPayment = async (): Promise<PaymentResponse> => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Необходимо авторизоваться');
    }

    const response = await fetch(`${API_BASE_URL}/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        bookingId,
        amount,
        type: paymentType
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  };

  const handlePayment = async () => {
    try {
      setLoading(true);
      
      const result = await createPayment();
      
      if (result.success && result.data) {
        setPaymentUrl(result.data.paymentUrl);
        
        // Open payment URL in new window
        const paymentWindow = window.open(
          result.data.paymentUrl,
          'payment',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        if (!paymentWindow) {
          throw new Error('Не удалось открыть окно оплаты. Проверьте блокировщик всплывающих окон.');
        }

        // Monitor payment window
        const checkPaymentStatus = setInterval(async () => {
          try {
            if (paymentWindow.closed) {
              clearInterval(checkPaymentStatus);
              await checkPaymentResult(result.data!.paymentId);
            }
          } catch (error) {
            console.error('Error checking payment status:', error);
          }
        }, 2000);

        // Timeout after 10 minutes
        setTimeout(() => {
          if (!paymentWindow.closed) {
            paymentWindow.close();
            clearInterval(checkPaymentStatus);
            showTelegramAlert('Время ожидания оплаты истекло');
            onError?.('Время ожидания оплаты истекло');
          }
        }, 600000);

      } else {
        throw new Error(result.error || 'Ошибка создания платежа');
      }
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ошибка обработки платежа';
      showTelegramAlert(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentResult = async (paymentId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const status = result.data.status;
        
        if (status === 'COMPLETED') {
          showTelegramAlert('Платеж успешно обработан!');
          onSuccess?.();
        } else if (status === 'FAILED' || status === 'CANCELLED') {
          showTelegramAlert('Платеж не был завершен');
          onError?.('Платеж не был завершен');
        } else {
          // Still processing
          setTimeout(() => checkPaymentResult(paymentId), 3000);
        }
      } else {
        throw new Error(result.error || 'Ошибка проверки статуса платежа');
      }
    } catch (error) {
      console.error('Payment status check error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ошибка проверки платежа';
      showTelegramAlert(errorMessage);
      onError?.(errorMessage);
    }
  };

  const getPaymentTypeText = () => {
    switch (paymentType) {
      case 'RENTAL':
        return 'Оплата аренды';
      case 'DEPOSIT_HOLD':
        return 'Залог (HOLD)';
      default:
        return 'Платеж';
    }
  };

  const getPaymentDescription = () => {
    switch (paymentType) {
      case 'RENTAL':
        return 'Оплата аренды прицепа';
      case 'DEPOSIT_HOLD':
        return 'Залог будет заблокирован на карте и возвращен после возврата прицепа';
      default:
        return '';
    }
  };

  return (
    <div className="payment-handler">
      <div className="payment-info">
        <h3>{getPaymentTypeText()}</h3>
        <p className="payment-description">{getPaymentDescription()}</p>
        <div className="payment-amount">
          <span className="amount-label">Сумма:</span>
          <span className="amount-value">{amount}₽</span>
        </div>
      </div>

      <div className="payment-actions">
        <button
          className="payment-button"
          onClick={handlePayment}
          disabled={loading}
        >
          {loading ? 'Обработка...' : 'Оплатить'}
        </button>
      </div>

      {paymentUrl && (
        <div className="payment-status">
          <p>Окно оплаты открыто. Завершите платеж в новом окне.</p>
        </div>
      )}
    </div>
  );
};

export default PaymentHandler;
