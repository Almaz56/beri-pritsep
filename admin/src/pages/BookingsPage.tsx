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

// User/Trailer данные не используются на странице — минимальные типы опущены

const BookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING_PAYMENT' | 'PAID' | 'ACTIVE' | 'RETURNED' | 'CLOSED' | 'CANCELLED'>('ALL');
  // const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  // const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api';

  const loadBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setBookings([]);
        return;
      }
      const res = await fetch(`${API_BASE_URL}/admin/bookings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      const result = await res.json();
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || `Failed to load bookings: ${res.status}`);
      }
      const mapped: Booking[] = (result.data || []).map((b: any) => ({
        id: String(b.id),
        userId: String(b.userId),
        trailerId: String(b.trailerId),
        startTime: new Date(b.startTime),
        endTime: new Date(b.endTime),
        rentalType: (b.rentalType || 'HOURLY') as any,
        additionalServices: b.additionalServices || { pickup: false },
        pricing: b.pricing || { baseCost: 0, additionalCost: 0, deposit: 0, total: b.totalAmount || 0 },
        status: b.status,
        createdAt: new Date(b.createdAt),
        updatedAt: new Date(b.updatedAt),
      }));
      setBookings(mapped);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
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
    alert(`Статус бронирования изменен на: ${getStatusText(newStatus)} (локальное отображение)`);
  };

  const handleViewDetails = (booking: Booking) => {
    console.log('Booking details:', booking);
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

  const getStatusText = (status: Booking['status']) =>
    status === 'PENDING_PAYMENT' ? 'Ожидает оплаты'
    : status === 'PAID' ? 'Оплачено'
    : status === 'ACTIVE' ? 'Активно'
    : status === 'RETURNED' ? 'Возвращено'
    : status === 'CLOSED' ? 'Завершено'
    : status === 'CANCELLED' ? 'Отменено' : status;

  if (loading) {
    return <div className="admin-bookings-page"><div className="loading">Загрузка бронирований...</div></div>;
  }

  const filtered = filter === 'ALL' ? bookings : bookings.filter(b => b.status === filter);

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
          <span className="stat-number">{filtered.length}</span>
        </div>
        <div className="stat-card">
          <h3>Активные</h3>
          <span className="stat-number">{filtered.filter(b => b.status === 'ACTIVE').length}</span>
        </div>
        <div className="stat-card">
          <h3>Ожидают оплаты</h3>
          <span className="stat-number">{filtered.filter(b => b.status === 'PENDING_PAYMENT').length}</span>
        </div>
        <div className="stat-card">
          <h3>Завершены</h3>
          <span className="stat-number">{filtered.filter(b => b.status === 'CLOSED').length}</span>
        </div>
      </div>

      <div className="bookings-list">
        {filtered.map(booking => (
          <div key={booking.id} className="booking-item">
            <div className="booking-header">
              <div className="booking-id">Бронь #{booking.id}</div>
              <span className="status-badge" style={{ background: getStatusColor(booking.status) }}>
                {getStatusText(booking.status)}
              </span>
            </div>
            <div className="booking-body">
              <div className="details">
                <div className="detail-row"><span className="label">Пользователь:</span> <span className="value">{booking.userId}</span></div>
                <div className="detail-row"><span className="label">Прицеп:</span> <span className="value">{booking.trailerId}</span></div>
                <div className="detail-row"><span className="label">Период:</span> <span className="value">{booking.startTime.toLocaleString('ru-RU')} — {booking.endTime.toLocaleString('ru-RU')}</span></div>
                <div className="detail-row"><span className="label">Сумма:</span> <span className="value total-amount">{booking.pricing.total}₽</span></div>
              </div>
            </div>
            <div className="booking-actions">
              <button className="details-button" onClick={() => handleViewDetails(booking)}>Подробности</button>
              <button className="approve-button" onClick={() => handleStatusChange(booking.id, 'PAID')}>Подтвердить оплату</button>
              <button className="cancel-button" onClick={() => handleStatusChange(booking.id, 'CANCELLED')}>Отменить</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookingsPage;
