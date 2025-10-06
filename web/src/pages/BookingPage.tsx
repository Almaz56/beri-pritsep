import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingsApi, type Trailer, type BookingRequest } from '../api';
import { showTelegramAlert, setupTelegramMainButton, hideTelegramMainButton } from '../telegram';
import { getAuthToken } from '../api';
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
  
  const state = location.state as BookingState;

  useEffect(() => {
    if (!state || !state.trailer || !state.bookingData || !state.quote) {
      showTelegramAlert('Ошибка: данные бронирования не найдены');
      navigate('/');
      return;
    }

    // Setup Telegram Main Button
    setupTelegramMainButton('Подтвердить бронирование', handleConfirmBooking, {
      color: '#4CAF50',
      textColor: '#ffffff'
    });

    return () => {
      hideTelegramMainButton();
    };
  }, [state, navigate]);

  const handleConfirmBooking = async () => {
    if (!state) return;

    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
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
        showTelegramAlert('Бронирование создано успешно!');
        navigate('/profile');
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
                <span>Тент: {state.trailer.hasTent ? 'Есть' : 'Нет'}</span>
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
                <span className="total-value">{state.quote.pricing.total || 0}₽</span>
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
