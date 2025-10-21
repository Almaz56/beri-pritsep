import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import LoginForm from './components/LoginForm';
import Dashboard from './pages/Dashboard';
import Trailers from './pages/Trailers';
import LocationsPage from './pages/LocationsPage';
import UsersPage from './pages/UsersPage';
import UserProfilePage from './pages/UserProfilePage';
import BookingsPage from './pages/BookingsPage';
import TransactionsPage from './pages/TransactionsPage';
import PhotoComparisonsPage from './pages/PhotoComparisonsPage';
import SupportPage from './pages/SupportPage';
import './App.css';

type Page = 'dashboard' | 'trailers' | 'locations' | 'users' | 'bookings' | 'transactions' | 'photo-comparisons' | 'support';

const AdminApp: React.FC = () => {
  const { admin, login, loading, error } = useAdminAuth();

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
    } catch (err) {
      // Error is handled by the context
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!admin) {
    return <LoginForm onLogin={handleLogin} loading={loading} error={error || undefined} />;
  }

  return (
    <Router>
      <AdminLayout />
    </Router>
  );
};

const AdminLayout: React.FC = () => {
  const { admin, logout } = useAdminAuth();
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    // Restore page from localStorage on app load
    const savedPage = localStorage.getItem('admin-current-page') as Page;
    return savedPage || 'dashboard';
  });

  const handlePageChange = (page: Page) => {
    setCurrentPage(page);
    // Save current page to localStorage
    localStorage.setItem('admin-current-page', page);
  };

  const renderPage = () => {
    return (
      <Routes>
        <Route path="/" element={<Dashboard onNavigate={handlePageChange} />} />
        <Route path="/dashboard" element={<Dashboard onNavigate={handlePageChange} />} />
        <Route path="/trailers" element={<Trailers />} />
        <Route path="/locations" element={<LocationsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:userId" element={<UserProfilePage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/photo-comparisons" element={<PhotoComparisonsPage />} />
        <Route path="/support" element={<SupportPage />} />
      </Routes>
    );
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return 'Панель управления';
      case 'trailers':
        return 'Управление прицепами';
      case 'locations':
        return 'Управление локациями';
      case 'users':
        return 'Управление пользователями';
      case 'bookings':
        return 'Управление бронированиями';
      case 'transactions':
        return 'Управление транзакциями';
      case 'photo-comparisons':
        return 'Сравнение фото';
      case 'support':
        return 'Чат поддержки';
      default:
        return 'Панель управления';
    }
  };

  return (
    <div className="admin-app">
      <nav className="admin-sidebar">
        <div className="sidebar-header">
          <h2>Бери прицеп</h2>
          <p>Админ-панель</p>
        </div>
        
        <ul className="sidebar-menu">
          <li 
            className={currentPage === 'dashboard' ? 'active' : ''}
            onClick={() => handlePageChange('dashboard')}
          >
            <span className="menu-icon">📊</span>
            <span className="menu-text">Панель управления</span>
          </li>
          
          <li 
            className={currentPage === 'trailers' ? 'active' : ''}
            onClick={() => handlePageChange('trailers')}
          >
            <span className="menu-icon">🚛</span>
            <span className="menu-text">Прицепы</span>
          </li>
          
          <li 
            className={currentPage === 'locations' ? 'active' : ''}
            onClick={() => handlePageChange('locations')}
          >
            <span className="menu-icon">📍</span>
            <span className="menu-text">Локации</span>
          </li>
          
          <li 
            className={currentPage === 'users' ? 'active' : ''}
            onClick={() => handlePageChange('users')}
          >
            <span className="menu-icon">👥</span>
            <span className="menu-text">Пользователи</span>
          </li>
          
          <li 
            className={currentPage === 'bookings' ? 'active' : ''}
            onClick={() => handlePageChange('bookings')}
          >
            <span className="menu-icon">📅</span>
            <span className="menu-text">Бронирования</span>
          </li>
          
          <li 
            className={currentPage === 'transactions' ? 'active' : ''}
            onClick={() => handlePageChange('transactions')}
          >
            <span className="menu-icon">💳</span>
            <span className="menu-text">Транзакции</span>
          </li>
          
          <li 
            className={currentPage === 'photo-comparisons' ? 'active' : ''}
            onClick={() => handlePageChange('photo-comparisons')}
          >
            <span className="menu-icon">📸</span>
            <span className="menu-text">Сравнение фото</span>
          </li>
          
          <li 
            className={currentPage === 'support' ? 'active' : ''}
            onClick={() => handlePageChange('support')}
          >
            <span className="menu-icon">💬</span>
            <span className="menu-text">Поддержка</span>
          </li>
        </ul>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">👨‍💼</div>
            <div className="user-details">
              <p className="user-name">{admin?.firstName} {admin?.lastName}</p>
              <p className="user-role">{admin?.role}</p>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="admin-main">
        <header className="admin-header">
          <h1>{getPageTitle()}</h1>
          <div className="header-actions">
            <button className="header-button">
              <span className="button-icon">🔔</span>
              <span className="button-text">Уведомления</span>
            </button>
            <button className="header-button">
              <span className="button-icon">⚙️</span>
              <span className="button-text">Настройки</span>
            </button>
            <button className="header-button logout" onClick={logout}>
              <span className="button-icon">🚪</span>
              <span className="button-text">Выйти</span>
            </button>
          </div>
        </header>
        
        <div className="admin-content">
          {renderPage()}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AdminAuthProvider>
      <AdminApp />
    </AdminAuthProvider>
  );
};

export default App;
