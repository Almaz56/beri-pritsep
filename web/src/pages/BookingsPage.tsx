import React, { useState, useEffect } from 'react';
import { bookingsApi, type Booking, authApi, setAuthToken, getAuthToken } from '../api';
import { getTelegramInitData } from '../telegram';
import { showTelegramAlert } from '../telegram';
import PaymentHandler from '../components/PaymentHandler';
import './BookingsPage.css';

const BookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      let token = getAuthToken();
      if (!token) {
        // Попробуем мгновенную авторизацию через Telegram initData
        const initData = getTelegramInitData();
        if (initData) {
          const auth = await authApi.telegramLogin(initData);
          if (auth.success && auth.data) {
            setAuthToken(auth.data.token);
            token = auth.data.token;
          }
        }
      }
      if (!token) {
        setError('Необходимо авторизоваться');
        return;
      }

      const response = await bookingsApi.getUserBookings(token);
      
      if (response.success && response.data) {
        setBookings(response.data);
      } else {
        setError(response.error || 'Ошибка загрузки бронирований');
      }
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError('Ошибка загрузки бронирований');
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: Booking['status']) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return 'Ожидает оплаты';
      case 'PAID':
        return 'Оплачено';
      case 'ACTIVE':
        return 'Активно';
      case 'RETURNED':
        return 'Возвращено';
      case 'CLOSED':
        return 'Завершено';
      case 'CANCELLED':
        return 'Отменено';
      default:
        return status;
    }
  };

  const getStatusColor = (status: Booking['status']) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return '#FF9800';
      case 'PAID':
        return '#4CAF50';
      case 'ACTIVE':
        return '#2196F3';
      case 'RETURNED':
        return '#9C27B0';
      case 'CLOSED':
        return '#607D8B';
      case 'CANCELLED':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePaymentSuccess = (bookingId: number) => {
    showTelegramAlert('Платеж успешно обработан!');
    // Обновляем статус бронирования
    setBookings(prev => prev.map(booking => 
      booking.id === bookingId 
        ? { ...booking, status: 'PAID' as const }
        : booking
    ));
  };

  const handlePaymentError = (bookingId: number, error: string) => {
    showTelegramAlert(`Ошибка платежа: ${error}`);
  };

  if (loading) {
    return (
      <div className="bookings-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка бронирований...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bookings-page">
        <div className="error-container">
          <h2>Ошибка загрузки</h2>
          <p>{error}</p>
          <button onClick={loadBookings} className="retry-button">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bookings-page">
      <div className="bookings-header">
        <h1>Мои бронирования</h1>
        <p>Всего бронирований: {bookings.length}</p>
      </div>

      {bookings.length === 0 ? (
        <div className="empty-container">
          <h2>Бронирований нет</h2>
          <p>У вас пока нет активных бронирований</p>
        </div>
      ) : (
        <div className="bookings-list">
          {bookings.map((booking) => (
            <div key={booking.id} className="booking-card">
              <div className="booking-header">
                <h3>{booking.trailer?.name || 'Прицеп'}</h3>
                <span 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(booking.status) }}
                >
                  {getStatusText(booking.status)}
                </span>
              </div>

              <div className="booking-details">
                <div className="detail-row">
                  <span className="label">Начало:</span>
                  <span className="value">{formatDateTime(booking.startTime)}</span>
                </div>
                
                <div className="detail-row">
                  <span className="label">Окончание:</span>
                  <span className="value">{formatDateTime(booking.endTime)}</span>
                </div>
                
                <div className="detail-row">
                  <span className="label">Тип:</span>
                  <span className="value">
                    {booking.rentalType === 'HOURLY' ? 'Почасовая' : 'Посуточная'}
                  </span>
                </div>
                
                {booking.additionalServices.pickup && (
                  <div className="detail-row">
                    <span className="label">Дополнительно:</span>
                    <span className="value">Забор прицепа</span>
                  </div>
                )}
              </div>

              <div className="booking-pricing">
                <div className="price-row">
                  <span className="label">Стоимость:</span>
                  <span className="value">{(booking.pricing.baseCost + booking.pricing.additionalCost)}₽</span>
                </div>
                <div className="price-row">
                  <span className="label">Залог:</span>
                  <span className="value deposit">{booking.pricing.deposit}₽</span>
                </div>
              </div>

              <div className="booking-footer">
                <span className="created-date">
                  Создано: {formatDateTime(booking.createdAt)}
                </span>
              </div>

              {/* Payment Section for PENDING_PAYMENT bookings */}
              {booking.status === 'PENDING_PAYMENT' && (
                <div className="payment-section">
                  <h4>Оплата аренды</h4>
                  <PaymentHandler
                    bookingId={booking.id.toString()}
                    amount={booking.pricing.baseCost + booking.pricing.additionalCost}
                    paymentType="RENTAL"
                    onSuccess={() => handlePaymentSuccess(booking.id)}
                    onError={(error) => handlePaymentError(booking.id, error)}
                  />
                </div>
              )}

              {/* Deposit Section for PAID bookings */}
              {booking.status === 'PAID' && (
                <div className="payment-section">
                  <h4>Залог</h4>
                  <PaymentHandler
                    bookingId={booking.id.toString()}
                    amount={booking.pricing.deposit}
                    paymentType="DEPOSIT_HOLD"
                    onSuccess={() => handlePaymentSuccess(booking.id)}
                    onError={(error) => handlePaymentError(booking.id, error)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingsPage;
