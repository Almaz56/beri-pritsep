import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { showTelegramAlert } from '../telegram';
import './PaymentFailedPage.css';

const PaymentFailedPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      showTelegramAlert(`Ошибка платежа: ${error}`);
    } else {
      showTelegramAlert('Платеж не был завершен');
    }
  }, [searchParams]);

  const handleRetry = () => {
    const bookingId = searchParams.get('bookingId');
    if (bookingId) {
      navigate(`/bookings`);
    } else {
      navigate('/bookings');
    }
  };

  const handleSupport = () => {
    navigate('/support');
  };

  const handleHome = () => {
    navigate('/');
  };

  const getErrorMessage = () => {
    const error = searchParams.get('error');
    switch (error) {
      case 'CANCELLED':
        return 'Платеж был отменен пользователем';
      case 'REJECTED':
        return 'Платеж был отклонен банком';
      case 'TIMEOUT':
        return 'Время ожидания платежа истекло';
      case 'NETWORK_ERROR':
        return 'Ошибка сети при обработке платежа';
      default:
        return 'Произошла ошибка при обработке платежа';
    }
  };

  return (
    <div className="payment-failed-page">
      <div className="failed-container">
        <div className="failed-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#f44336"/>
            <path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h1>Платеж не обработан</h1>
        
        <div className="failed-message">
          <p>{getErrorMessage()}</p>
          <p>Попробуйте еще раз или обратитесь в поддержку.</p>
        </div>

        <div className="failed-details">
          <div className="detail-item">
            <span className="label">Статус:</span>
            <span className="value failed">Не оплачено</span>
          </div>
          
          {searchParams.get('paymentId') && (
            <div className="detail-item">
              <span className="label">ID платежа:</span>
              <span className="value">{searchParams.get('paymentId')}</span>
            </div>
          )}
          
          {searchParams.get('bookingId') && (
            <div className="detail-item">
              <span className="label">ID бронирования:</span>
              <span className="value">{searchParams.get('bookingId')}</span>
            </div>
          )}
        </div>

        <div className="failed-actions">
          <button
            className="retry-button"
            onClick={handleRetry}
          >
            Попробовать снова
          </button>
          
          <button
            className="support-button"
            onClick={handleSupport}
          >
            Связаться с поддержкой
          </button>
          
          <button
            className="home-button"
            onClick={handleHome}
          >
            На главную
          </button>
        </div>

        <div className="failed-info">
          <h3>Возможные причины:</h3>
          <ul>
            <li>Недостаточно средств на карте</li>
            <li>Карта заблокирована банком</li>
            <li>Превышен лимит операций</li>
            <li>Технические проблемы с банком</li>
          </ul>
          
          <div className="support-note">
            <p>Если проблема повторяется, обратитесь в поддержку или попробуйте другую карту.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailedPage;
