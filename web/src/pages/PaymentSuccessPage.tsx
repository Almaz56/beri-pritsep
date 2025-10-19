import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { showTelegramAlert } from '../telegram';
import './PaymentSuccessPage.css';

const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const paymentId = searchParams.get('paymentId');
    const bookingId = searchParams.get('bookingId');
    
    if (paymentId && bookingId) {
      showTelegramAlert('Платеж успешно обработан!');
    } else {
      showTelegramAlert('Платеж завершен успешно!');
    }
  }, [searchParams]);

  const handleContinue = () => {
    navigate('/profile');
  };

  const handleViewBooking = () => {
    const bookingId = searchParams.get('bookingId');
    if (bookingId) {
      navigate(`/bookings`);
    } else {
      navigate('/bookings');
    }
  };

  return (
    <div className="payment-success-page">
      <div className="success-container">
        <div className="success-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#4CAF50"/>
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h1>Платеж успешно обработан!</h1>
        
        <div className="success-message">
          <p>Ваш платеж был успешно обработан.</p>
          <p>Бронирование подтверждено и готово к использованию.</p>
        </div>

        <div className="success-details">
          <div className="detail-item">
            <span className="label">Статус:</span>
            <span className="value success">Оплачено</span>
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

        <div className="success-actions">
          <button
            className="primary-button"
            onClick={handleViewBooking}
          >
            Мои бронирования
          </button>
          
          <button
            className="secondary-button"
            onClick={handleContinue}
          >
            В профиль
          </button>
        </div>

        <div className="success-info">
          <p>Вы получите уведомление о деталях бронирования.</p>
          <p>При возникновении вопросов обратитесь в поддержку.</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
