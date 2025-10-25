import React, { useState, useEffect } from 'react';
import './BookingsPage.css';

interface Booking {
  id: string;
  userId: string;
  trailerId: string;
  startTime: Date;
  endTime: Date;
  rentalType: 'HOURLY' | 'DAILY';
  additionalServices: { pickup: boolean };
  pricing: { baseCost: number; additionalCost: number; deposit: number; total: number };
  status: 'PENDING_PAYMENT' | 'PAID' | 'ACTIVE' | 'RETURNED' | 'CLOSED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface Trailer {
  id: string;
  name: string;
}

const mockBookings: Booking[] = [];

const mockUsers: User[] = [];
const mockTrailers: Trailer[] = [];

const BookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING_PAYMENT' | 'PAID' | 'ACTIVE' | 'RETURNED' | 'CLOSED' | 'CANCELLED'>('ALL');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setBookings(mockBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (bookingId: string, newStatus: Booking['status']) => {
    setBookings(bookings.map(booking => 
      booking.id === bookingId 
        ? { ...booking, status: newStatus, updatedAt: new Date() }
        : booking
    ));
    alert(`Статус бронирования изменен на: ${getStatusText(newStatus)} (mock)`);
  };

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
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
        return 'Неизвестно';
    }
  };

  const getUserName = (userId: string) => {
    const user = mockUsers.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Неизвестный пользователь';
  };

  const getTrailerName = (trailerId: string) => {
    const trailer = mockTrailers.find(t => t.id === trailerId);
    return trailer ? trailer.name : 'Неизвестный прицеп';
  };

  const filteredBookings = bookings.filter(booking => {
    if (filter === 'ALL') return true;
    return booking.status === filter;
  });

  if (loading) {
    return <div className="admin-bookings-page loading">Загрузка бронирований...</div>;
  }

  return (
    <div className="admin-bookings-page">
      <div className="page-header">
        <h2>Управление бронированиями</h2>
        <div className="filter-controls">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="ALL">Все бронирования</option>
            <option value="PENDING_PAYMENT">Ожидают оплаты</option>
            <option value="PAID">Оплачены</option>
            <option value="ACTIVE">Активные</option>
            <option value="RETURNED">Возвращены</option>
            <option value="CLOSED">Завершены</option>
            <option value="CANCELLED">Отменены</option>
          </select>
        </div>
      </div>

      <div className="bookings-stats">
        <div className="stat-card">
          <h3>Всего бронирований</h3>
          <span className="stat-number">{bookings.length}</span>
        </div>
        <div className="stat-card">
          <h3>Активные</h3>
          <span className="stat-number">{bookings.filter(b => b.status === 'ACTIVE').length}</span>
        </div>
        <div className="stat-card">
          <h3>Ожидают оплаты</h3>
          <span className="stat-number">{bookings.filter(b => b.status === 'PENDING_PAYMENT').length}</span>
        </div>
        <div className="stat-card">
          <h3>Завершены</h3>
          <span className="stat-number">{bookings.filter(b => b.status === 'CLOSED').length}</span>
        </div>
      </div>

      <div className="bookings-list">
        {filteredBookings.map(booking => (
          <div key={booking.id} className="booking-item">
            <div className="booking-info">
              <div className="booking-header">
                <h3>Бронирование #{booking.id}</h3>
                <span 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(booking.status) }}
                >
                  {getStatusText(booking.status)}
                </span>
              </div>
              
              <div className="booking-details">
                <div className="detail-row">
                  <span className="label">Клиент:</span>
                  <span className="value">{getUserName(booking.userId)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Прицеп:</span>
                  <span className="value">{getTrailerName(booking.trailerId)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Период:</span>
                  <span className="value">
                    {booking.startTime.toLocaleString('ru-RU')} - {booking.endTime.toLocaleString('ru-RU')}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Тип аренды:</span>
                  <span className="value">{booking.rentalType === 'HOURLY' ? 'Почасовая' : 'Посуточная'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Доп. услуги:</span>
                  <span className="value">{booking.additionalServices.pickup ? 'Забор прицепа' : 'Нет'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Сумма:</span>
                  <span className="value total-amount">{booking.pricing.total}₽</span>
                </div>
                <div className="detail-row">
                  <span className="label">Создано:</span>
                  <span className="value">{booking.createdAt.toLocaleString('ru-RU')}</span>
                </div>
              </div>
            </div>

            <div className="booking-actions">
              <button 
                className="details-button"
                onClick={() => handleViewDetails(booking)}
              >
                Подробности
              </button>
              
              {booking.status === 'PENDING_PAYMENT' && (
                <>
                  <button 
                    className="approve-button"
                    onClick={() => handleStatusChange(booking.id, 'PAID')}
                  >
                    Подтвердить оплату
                  </button>
                  <button 
                    className="cancel-button"
                    onClick={() => handleStatusChange(booking.id, 'CANCELLED')}
                  >
                    Отменить
                  </button>
                </>
              )}
              
              {booking.status === 'PAID' && (
                <button 
                  className="activate-button"
                  onClick={() => handleStatusChange(booking.id, 'ACTIVE')}
                >
                  Активировать
                </button>
              )}
              
              {booking.status === 'ACTIVE' && (
                <button 
                  className="return-button"
                  onClick={() => handleStatusChange(booking.id, 'RETURNED')}
                >
                  Отметить возврат
                </button>
              )}
              
              {booking.status === 'RETURNED' && (
                <button 
                  className="close-button"
                  onClick={() => handleStatusChange(booking.id, 'CLOSED')}
                >
                  Завершить
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showDetailsModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Детали бронирования #{selectedBooking.id}</h2>
              <button 
                className="close-button"
                onClick={() => setShowDetailsModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="booking-details-full">
                <div className="detail-section">
                  <h3>Информация о клиенте</h3>
                  <p><strong>Имя:</strong> {getUserName(selectedBooking.userId)}</p>
                  <p><strong>Телефон:</strong> {mockUsers.find(u => u.id === selectedBooking.userId)?.phone || 'Не указан'}</p>
                </div>
                
                <div className="detail-section">
                  <h3>Информация о прицепе</h3>
                  <p><strong>Название:</strong> {getTrailerName(selectedBooking.trailerId)}</p>
                </div>
                
                <div className="detail-section">
                  <h3>Детали аренды</h3>
                  <p><strong>Начало:</strong> {selectedBooking.startTime.toLocaleString('ru-RU')}</p>
                  <p><strong>Окончание:</strong> {selectedBooking.endTime.toLocaleString('ru-RU')}</p>
                  <p><strong>Тип:</strong> {selectedBooking.rentalType === 'HOURLY' ? 'Почасовая' : 'Посуточная'}</p>
                  <p><strong>Забор прицепа:</strong> {selectedBooking.additionalServices.pickup ? 'Да' : 'Нет'}</p>
                </div>
                
                <div className="detail-section">
                  <h3>Финансовая информация</h3>
                  <p><strong>Базовая стоимость:</strong> {selectedBooking.pricing.baseCost}₽</p>
                  <p><strong>Дополнительные услуги:</strong> {selectedBooking.pricing.additionalCost}₽</p>
                  <p><strong>Залог:</strong> {selectedBooking.pricing.deposit}₽</p>
                  <p><strong>Итого:</strong> {selectedBooking.pricing.total}₽</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsPage;
