import React, { useState, useEffect } from 'react';
import { adminApi } from '../api';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import './Dashboard.css';

interface DashboardStats {
  totalUsers: number;
  pendingVerifications: number;
  totalBookings: number;
  activeBookings: number;
  totalRevenue: number;
  pendingPayments: number;
  totalTrailers: number;
  availableTrailers: number;
  totalLocations: number;
  totalTransactions: number;
}

const mockStats: DashboardStats = {
  totalUsers: 0,
  pendingVerifications: 0,
  totalBookings: 0,
  activeBookings: 0,
  totalRevenue: 0,
  pendingPayments: 0,
  totalTrailers: 0,
  availableTrailers: 0,
  totalLocations: 0,
  totalTransactions: 0
};

type Page = 'dashboard' | 'trailers' | 'locations' | 'users' | 'bookings' | 'transactions' | 'photo-comparisons' | 'support';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { token } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats>(mockStats);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token]);

  const loadDashboardData = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      
      // Load real stats from API
      const statsResponse = await adminApi.getStats(token);
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      } else {
        // Fallback to mock data if API fails
        setStats(mockStats);
      }
      
      // Mock recent activity for now
      setRecentActivity([
        { type: 'booking', message: 'Новое бронирование #booking_3', time: '2 минуты назад' },
        { type: 'payment', message: 'Оплата получена: 1,200₽', time: '5 минут назад' },
        { type: 'user', message: 'Новый пользователь: Мария Сидорова', time: '10 минут назад' },
        { type: 'verification', message: 'Документы одобрены: Иван Петров', time: '15 минут назад' },
        { type: 'booking', message: 'Бронирование завершено: #booking_1', time: '20 минут назад' }
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Fallback to mock data
      setStats(mockStats);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return '📅';
      case 'payment':
        return '💰';
      case 'user':
        return '👤';
      case 'verification':
        return '✅';
      default:
        return '📋';
    }
  };

  if (loading) {
    return <div className="admin-dashboard loading">Загрузка дашборда...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Панель управления</h1>
        <p>Добро пожаловать в админ-панель "Бери прицеп"</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Пользователи</h3>
            <div className="stat-number">{stats.totalUsers}</div>
            <div className="stat-subtitle">
              {stats.pendingVerifications} ожидают верификации
            </div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Бронирования</h3>
            <div className="stat-number">{stats.totalBookings}</div>
            <div className="stat-subtitle">
              {stats.activeBookings} активных
            </div>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Доходы</h3>
            <div className="stat-number">{stats.totalRevenue.toLocaleString()}₽</div>
            <div className="stat-subtitle">
              {stats.pendingPayments.toLocaleString()}₽ в обработке
            </div>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">🚛</div>
          <div className="stat-content">
            <h3>Прицепы</h3>
            <div className="stat-number">{stats.totalTrailers}</div>
            <div className="stat-subtitle">
              {stats.availableTrailers} доступно
            </div>
          </div>
        </div>

        <div className="stat-card secondary">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <h3>Локации</h3>
            <div className="stat-number">{stats.totalLocations}</div>
            <div className="stat-subtitle">
              Автопарки
            </div>
          </div>
        </div>

        <div className="stat-card dark">
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <h3>Транзакции</h3>
            <div className="stat-number">{stats.totalTransactions}</div>
            <div className="stat-subtitle">
              Всего операций
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="recent-activity">
          <h2>Последняя активность</h2>
          <div className="activity-list">
            {recentActivity.map((activity, index) => (
              <div key={index} className="activity-item">
                <div className="activity-icon">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="activity-content">
                  <p className="activity-message">{activity.message}</p>
                  <span className="activity-time">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="quick-actions">
          <h2>Быстрые действия</h2>
          <div className="actions-grid">
            <button className="action-button" onClick={() => onNavigate('trailers')}>
              <div className="action-icon">🚛</div>
              <div className="action-text">
                <h4>Управление прицепами</h4>
                <p>Добавить, редактировать прицепы</p>
              </div>
            </button>

            <button className="action-button" onClick={() => onNavigate('locations')}>
              <div className="action-icon">📍</div>
              <div className="action-text">
                <h4>Управление локациями</h4>
                <p>Настроить автопарки</p>
              </div>
            </button>

            <button className="action-button" onClick={() => onNavigate('users')}>
              <div className="action-icon">👥</div>
              <div className="action-text">
                <h4>Верификация пользователей</h4>
                <p>Проверить документы</p>
              </div>
            </button>

            <button className="action-button" onClick={() => onNavigate('bookings')}>
              <div className="action-icon">📅</div>
              <div className="action-text">
                <h4>Управление бронированиями</h4>
                <p>Просмотр и управление</p>
              </div>
            </button>

            <button className="action-button" onClick={() => onNavigate('transactions')}>
              <div className="action-icon">💳</div>
              <div className="action-text">
                <h4>Финансовые операции</h4>
                <p>Транзакции и платежи</p>
              </div>
            </button>

            <button className="action-button" onClick={() => onNavigate('photo-comparisons')}>
              <div className="action-icon">📸</div>
              <div className="action-text">
                <h4>Сравнение фото</h4>
                <p>Анализ повреждений</p>
              </div>
            </button>

            <button className="action-button" onClick={() => onNavigate('support')}>
              <div className="action-icon">💬</div>
              <div className="action-text">
                <h4>Поддержка</h4>
                <p>Чат с пользователями</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
