import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import TrailersPage from './pages/TrailersPage';
import LocationsPage from './pages/LocationsPage';
import UsersPage from './pages/UsersPage';
import BookingsPage from './pages/BookingsPage';
import TransactionsPage from './pages/TransactionsPage';
import PhotoComparisonsPage from './pages/PhotoComparisonsPage';
import './App.css';

type Page = 'dashboard' | 'trailers' | 'locations' | 'users' | 'bookings' | 'transactions' | 'photo-comparisons';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'trailers':
        return <TrailersPage />;
      case 'locations':
        return <LocationsPage />;
      case 'users':
        return <UsersPage />;
      case 'bookings':
        return <BookingsPage />;
      case 'transactions':
        return <TransactionsPage />;
      case 'photo-comparisons':
        return <PhotoComparisonsPage />;
      default:
        return <Dashboard />;
    }
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
            onClick={() => setCurrentPage('dashboard')}
          >
            <span className="menu-icon">📊</span>
            <span className="menu-text">Панель управления</span>
          </li>
          
          <li 
            className={currentPage === 'trailers' ? 'active' : ''}
            onClick={() => setCurrentPage('trailers')}
          >
            <span className="menu-icon">🚛</span>
            <span className="menu-text">Прицепы</span>
          </li>
          
          <li 
            className={currentPage === 'locations' ? 'active' : ''}
            onClick={() => setCurrentPage('locations')}
          >
            <span className="menu-icon">📍</span>
            <span className="menu-text">Локации</span>
          </li>
          
          <li 
            className={currentPage === 'users' ? 'active' : ''}
            onClick={() => setCurrentPage('users')}
          >
            <span className="menu-icon">👥</span>
            <span className="menu-text">Пользователи</span>
          </li>
          
          <li 
            className={currentPage === 'bookings' ? 'active' : ''}
            onClick={() => setCurrentPage('bookings')}
          >
            <span className="menu-icon">📅</span>
            <span className="menu-text">Бронирования</span>
          </li>
          
          <li 
            className={currentPage === 'transactions' ? 'active' : ''}
            onClick={() => setCurrentPage('transactions')}
          >
            <span className="menu-icon">💳</span>
            <span className="menu-text">Транзакции</span>
          </li>
          
          <li 
            className={currentPage === 'photo-comparisons' ? 'active' : ''}
            onClick={() => setCurrentPage('photo-comparisons')}
          >
            <span className="menu-icon">📸</span>
            <span className="menu-text">Сравнение фото</span>
          </li>
        </ul>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">👨‍💼</div>
            <div className="user-details">
              <p className="user-name">Администратор</p>
              <p className="user-role">Admin</p>
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
            <button className="header-button logout">
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

export default App;
