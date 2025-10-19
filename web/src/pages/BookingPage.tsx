import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingsApi, type Trailer, type BookingRequest } from '../api';
import { showTelegramAlert, setupTelegramMainButton, hideTelegramMainButton } from '../telegram';
import { getAuthToken } from '../api';
import PaymentHandler from '../components/PaymentHandler';
import './BookingPage.css';

interface BookingState {
  trailer: Trailer;
  bookingData: {
    rentalType: 'HOURLY' | 'DAILY';
    startDate: string;
    startTime: string;
    duration: number;
    pickup: boolean;
  };
  quote: any;
}

const BookingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<'booking' | 'rental' | 'deposit'>('booking');
  
  const state = location.state as BookingState;

  useEffect(() => {
    console.log('BookingPage state:', state);
    if (!state || !state.trailer || !state.bookingData || !state.quote) {
      console.error('Missing state data:', { state, trailer: state?.trailer, bookingData: state?.bookingData, quote: state?.quote });
      showTelegramAlert('Ошибка: данные бронирования не найдены');
      navigate('/');
      return;
    }

    // Setup Telegram Main Button based on payment step
    if (paymentStep === 'booking') {
      setupTelegramMainButton('Создать бронирование', handleConfirmBooking, {
        color: '#4CAF50',
        textColor: '#ffffff'
      });
    } else {
      hideTelegramMainButton();
    }

    return () => {
      hideTelegramMainButton();
    };
  }, [state, navigate, paymentStep]);

  const handleConfirmBooking = async () => {
    if (!state) return;

    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      console.log('Booking token:', token);
      if (!token) {
        showTelegramAlert('Ошибка: необходимо авторизоваться');
        navigate('/profile');
        return;
      }

      const startDateTime = new Date(`${state.bookingData.startDate}T${state.bookingData.startTime}`);
      const endDateTime = new Date(startDateTime);
      
      if (state.bookingData.rentalType === 'HOURLY') {
        endDateTime.setHours(endDateTime.getHours() + state.bookingData.duration);
      } else {
        endDateTime.setDate(endDateTime.getDate() + state.bookingData.duration);
      }

      const bookingRequest: BookingRequest = {
        trailerId: state.trailer.id,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        rentalType: state.bookingData.rentalType,
        additionalServices: {
          pickup: state.bookingData.pickup
        }
      };

      console.log('Creating booking:', bookingRequest);

      const response = await bookingsApi.createBooking(bookingRequest, token);
      
      if (response.success && response.data) {
        setBookingId(response.data.id);
        setPaymentStep('rental');
        showTelegramAlert('Бронирование создано! Теперь нужно оплатить аренду.');
      } else {
        setError(response.error || 'Ошибка создания бронирования');
        showTelegramAlert(response.error || 'Ошибка создания бронирования');
      }
    } catch (err) {
      console.error('Booking creation error:', err);
      setError('Ошибка создания бронирования');
      showTelegramAlert('Ошибка создания бронирования');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const handleRentalPaymentSuccess = () => {
    setPaymentStep('deposit');
    showTelegramAlert('Аренда оплачена! Теперь нужно заблокировать залог.');
  };

  const handleRentalPaymentError = (error: string) => {
    setError(error);
  };

  const handleDepositPaymentSuccess = () => {
    showTelegramAlert('Все платежи завершены! Бронирование готово к использованию.');
    navigate('/profile');
  };

  const handleDepositPaymentError = (error: string) => {
    setError(error);
  };

  if (!state) {
    return (
      <div className="booking-page">
        <div className="error-container">
          <h2>Ошибка</h2>
          <p>Данные бронирования не найдены</p>
        <button
          className="cancel-button"
          onClick={() => navigate(-1)}
          disabled={loading}
        >
          Отмена
        </button>
        </div>
      </div>
    );
  }

  const formatDateTime = (date: string, time: string) => {
    const dateObj = new Date(`${date}T${time}`);
    return dateObj.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEndDateTime = () => {
    const startDateTime = new Date(`${state.bookingData.startDate}T${state.bookingData.startTime}`);
    const endDateTime = new Date(startDateTime);
    
    if (state.bookingData.rentalType === 'HOURLY') {
      endDateTime.setHours(endDateTime.getHours() + state.bookingData.duration);
    } else {
      endDateTime.setDate(endDateTime.getDate() + state.bookingData.duration);
    }
    
    return endDateTime.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="booking-page">
      <div className="booking-header">
        <h1>Подтверждение бронирования</h1>
      </div>

      <div className="booking-content">
        {/* Trailer Info */}
        <div className="booking-section">
          <h2>Прицеп</h2>
          <div className="trailer-summary">
            <div className="trailer-image">
              {state.trailer.photos.length > 0 && (
                <img src={state.trailer.photos[0]} alt={state.trailer.name} />
              )}
            </div>
            <div className="trailer-details">
              <h3>{state.trailer.name}</h3>
              <p>{state.trailer.description}</p>
              <div className="trailer-specs">
                <span>Грузоподъемность: {state.trailer.capacity} кг</span>
                <span>Особенности: {state.trailer.features.length > 0 ? state.trailer.features.join(', ') : 'Нет'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="booking-section">
          <h2>Детали бронирования</h2>
          <div className="booking-details">
            <div className="detail-item">
              <span className="label">Тип аренды:</span>
              <span className="value">
                {state.bookingData.rentalType === 'HOURLY' ? 'Почасовая' : 'Посуточная'}
              </span>
            </div>
            
            <div className="detail-item">
              <span className="label">Начало:</span>
              <span className="value">
                {formatDateTime(state.bookingData.startDate, state.bookingData.startTime)}
              </span>
            </div>
            
            <div className="detail-item">
              <span className="label">Окончание:</span>
              <span className="value">{getEndDateTime()}</span>
            </div>
            
            <div className="detail-item">
              <span className="label">Продолжительность:</span>
              <span className="value">
                {state.bookingData.duration} {state.bookingData.rentalType === 'HOURLY' ? 'часов' : 'дней'}
              </span>
            </div>
            
            {state.bookingData.pickup && (
              <div className="detail-item">
                <span className="label">Дополнительно:</span>
                <span className="value">Забор прицепа</span>
              </div>
            )}
          </div>
        </div>

        {/* Pricing */}
        {state.quote && state.quote.pricing && (
          <div className="booking-section">
            <h2>Стоимость</h2>
            <div className="pricing-summary">
              {state.quote.pricing.breakdown && state.quote.pricing.breakdown.rental && (
                <div className="price-item">
                  <span className="price-label">Аренда:</span>
                  <span className="price-value">{state.quote.pricing.breakdown.rental}</span>
                </div>
              )}
              
              {state.bookingData.pickup && state.quote.pricing.breakdown && state.quote.pricing.breakdown.pickup && (
                <div className="price-item">
                  <span className="price-label">Забор:</span>
                  <span className="price-value">{state.quote.pricing.breakdown.pickup}</span>
                </div>
              )}
              
              {state.quote.pricing.breakdown && state.quote.pricing.breakdown.deposit && (
                <div className="price-item">
                  <span className="price-label">Залог:</span>
                  <span className="price-value">{state.quote.pricing.breakdown.deposit}</span>
                </div>
              )}
              
              <div className="price-total">
                <span className="total-label">Итого к оплате:</span>
                <span className="total-value">{(state.quote.pricing.baseCost + state.quote.pricing.additionalCost) || 0}₽</span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        {/* Create Booking Button */}
        {paymentStep === 'booking' && (
          <div className="booking-section">
            <div className="booking-actions">
              <button
                className="create-booking-button"
                onClick={handleConfirmBooking}
                disabled={loading}
              >
                {loading ? 'Создание бронирования...' : 'Создать бронирование'}
              </button>
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Steps */}
        {paymentStep === 'rental' && bookingId && (
          <div className="booking-section">
            <h2>Оплата аренды</h2>
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f0f0', borderRadius: '8px' }}>
              <p><strong>Отладка:</strong></p>
              <p>paymentStep: {paymentStep}</p>
              <p>bookingId: {bookingId}</p>
              <p>amount: {state.quote?.pricing?.baseCost + state.quote?.pricing?.additionalCost}</p>
            </div>
            <PaymentHandler
              bookingId={bookingId}
              amount={state.quote.pricing.baseCost + state.quote.pricing.additionalCost}
              paymentType="RENTAL"
              onSuccess={handleRentalPaymentSuccess}
              onError={handleRentalPaymentError}
            />
          </div>
        )}

        {paymentStep === 'deposit' && bookingId && (
          <div className="booking-section">
            <h2>Залог (HOLD)</h2>
            <PaymentHandler
              bookingId={bookingId}
              amount={state.quote.pricing.deposit}
              paymentType="DEPOSIT_HOLD"
              onSuccess={handleDepositPaymentSuccess}
              onError={handleDepositPaymentError}
            />
          </div>
        )}

        {/* Actions */}
        <div className="booking-actions">
          <button
            className="cancel-button"
            onClick={() => navigate(-1)}
            disabled={loading}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingPage;
