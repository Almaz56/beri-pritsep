import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { showTelegramAlert, setupTelegramMainButton, hideTelegramMainButton } from '../telegram';
import { getAuthToken } from '../api';
import './PaymentHandler.css';

interface PaymentHandlerProps {
  bookingId: string;
  amount: number;
  paymentType: 'RENTAL' | 'DEPOSIT_HOLD';
  onSuccess?: () => void;
  onError?: (error: string) => void;
  useTelegramMainButton?: boolean;
}

interface PaymentResponse {
  success: boolean;
  data?: {
    paymentId: string;
    paymentUrl?: string;
    paymentURL?: string;
  };
  error?: string;
}

const PaymentHandler: React.FC<PaymentHandlerProps> = ({
  bookingId,
  amount,
  paymentType,
  onSuccess,
  onError,
  useTelegramMainButton = true
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'creating' | 'waiting' | 'processing' | 'completed' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const API_BASE_URL = (import.meta as any).env?.VITE_API_URL ||
    ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8080'
      : 'https://api.beripritsep.ru');

  const createPayment = async (): Promise<PaymentResponse> => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Необходимо авторизоваться');
    }

    const response = await fetch(`${API_BASE_URL}/api/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        bookingId,
        paymentType: paymentType === 'RENTAL' ? 'rental' : 'deposit'
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
      setError(null);
      setPaymentStatus('creating');
      
      const result = await createPayment();
      
      if (result.success && result.data) {
        const url = result.data.paymentUrl || result.data.paymentURL;
        if (!url) {
          throw new Error('Ссылка на оплату не получена');
        }
        setPaymentUrl(url);
        setPaymentStatus('waiting');
        
        // Open payment URL using Telegram API if available, fallback to same-tab navigation
        const tg = (window as any).Telegram?.WebApp;
        try {
          if (tg && typeof tg.openLink === 'function') {
            tg.openLink(url, { try_instant_view: false });
          } else {
            // Same-tab navigation avoids popup blockers
            window.location.href = url;
          }
        } catch {
          // As a last resort attempt a popup
          window.open(url, '_blank');
        }

        setPaymentStatus('processing');

        // Start polling payment status regardless of window handle availability
        const checkPaymentStatus = setInterval(async () => {
          try {
            await checkPaymentResult(result.data!.paymentId);
          } catch (err) {
            console.error('Error checking payment status:', err);
          }
        }, 3000);

        // Timeout after 10 minutes
        setTimeout(() => {
          if (!paymentWindow.closed) {
            paymentWindow.close();
            clearInterval(checkPaymentStatus);
            setError('Время ожидания оплаты истекло');
            setPaymentStatus('failed');
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
      setError(errorMessage);
      setPaymentStatus('failed');
      showTelegramAlert(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentResult = async (paymentId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/payments/${paymentId}/status`, {
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
          setPaymentStatus('completed');
          showTelegramAlert('Платеж успешно обработан!');
          onSuccess?.();
        } else if (status === 'FAILED' || status === 'CANCELLED') {
          setPaymentStatus('failed');
          setError('Платеж не был завершен');
          showTelegramAlert('Платеж не был завершен');
          onError?.('Платеж не был завершен');
        } else {
          // Still processing
          setPaymentStatus('processing');
          setTimeout(() => checkPaymentResult(paymentId), 3000);
        }
      } else {
        throw new Error(result.error || 'Ошибка проверки статуса платежа');
      }
    } catch (error) {
      console.error('Payment status check error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ошибка проверки платежа';
      setError(errorMessage);
      setPaymentStatus('failed');
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

  // Expose Telegram MainButton for mini-app so the user always sees an obvious Pay button
  useEffect(() => {
    // Show when actionable
    if (useTelegramMainButton && !loading && (paymentStatus === 'idle' || paymentStatus === 'failed')) {
      setupTelegramMainButton('Оплатить', handlePayment, {
        color: '#4CAF50',
        textColor: '#ffffff'
      });
    } else {
      hideTelegramMainButton();
    }
    return () => {
      hideTelegramMainButton();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus, loading, useTelegramMainButton]);

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
          disabled={loading || paymentStatus === 'completed'}
        >
          {loading ? 'Обработка...' : 
           paymentStatus === 'completed' ? 'Оплачено' :
           paymentStatus === 'failed' ? 'Повторить' :
           paymentStatus === 'processing' ? 'Обработка платежа...' :
           paymentStatus === 'waiting' ? 'Ожидание оплаты...' :
           'Оплатить'}
        </button>
      </div>

      {paymentStatus !== 'idle' && (
        <div className="payment-status">
          <div className={`status-indicator ${paymentStatus}`}>
            {paymentStatus === 'creating' && '🔄 Создание платежа...'}
            {paymentStatus === 'waiting' && '⏳ Ожидание оплаты...'}
            {paymentStatus === 'processing' && '🔄 Обработка платежа...'}
            {paymentStatus === 'completed' && '✅ Платеж успешно обработан!'}
            {paymentStatus === 'failed' && '❌ Ошибка платежа'}
          </div>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      )}

      {paymentUrl && (
        <div className="payment-status">
          <p>Окно оплаты открыто. Завершите платеж в новом окне.</p>
        </div>
      )}
    </div>
  );
};

export default PaymentHandler;
