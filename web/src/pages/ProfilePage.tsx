import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, phoneApi, documentsApi, type User } from '../api';
import { getTelegramInitData, getTelegramUserUnsafe, requestTelegramContact, showTelegramAlert } from '../telegram';
import { getAuthToken, setAuthToken, removeAuthToken } from '../api';
import PhoneRequestModal from '../components/PhoneRequestModal';
import UserDataForm from '../components/UserDataForm';
import RentalCountdown from '../components/RentalCountdown';
import './ProfilePage.css';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentStatus, setDocumentStatus] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  
  // New modal states
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showUserDataModal, setShowUserDataModal] = useState(false);
  const [activeRental, setActiveRental] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // Автоматическая проверка статуса телефона каждые 5 секунд
  useEffect(() => {
    if (user && (user as any).phoneVerificationStatus === 'REQUIRED') {
      const interval = setInterval(checkPhoneStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Проверка статуса документов при загрузке пользователя
  useEffect(() => {
    if (user) {
      checkDocumentStatus();
      loadPayments();
    }
  }, [user]);

  const attemptTelegramAutoLogin = async (): Promise<boolean> => {
    try {
      const initData = getTelegramInitData();
      if (!initData) {
        console.log('No Telegram initData available');
        return false;
      }
      console.log('Attempting auto-login with initData');
      const response = await authApi.telegramLogin(initData);
      if (response.success && response.data) {
        console.log('Auto-login successful');
        setAuthToken(response.data.token);
        setUser(response.data.user);
        return true;
      } else {
        console.log('Auto-login failed:', response.error);
      }
    } catch (error) {
      console.log('Auto-login error:', error);
    }
    return false;
  };

  const checkAuth = async () => {
    let token = getAuthToken();
    console.log('Checking auth, token exists:', !!token);
    
    if (token) {
      try {
        const response = await authApi.getProfile(token);
        
        if (response.success && response.data) {
          console.log('Profile loaded successfully');
          setUser(response.data);
        } else {
          // Token is invalid, remove it
          console.log('Token invalid, removing and trying auto-login');
          removeAuthToken();
          // попробовать авто-логин через Telegram сразу
          const ok = await attemptTelegramAutoLogin();
          if (ok) {
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Error checking auth:', err);
        removeAuthToken();
        const ok = await attemptTelegramAutoLogin();
        if (ok) {
          setLoading(false);
          return;
        }
      }
    } else {
      // Попробуем авторизоваться автоматически через Telegram initData
      console.log('No token, attempting auto-login');
      await attemptTelegramAutoLogin();
    }
    
    setLoading(false);
  };

  const handleTelegramAuth = async () => {
    try {
      setAuthenticating(true);
      setError(null);

      const initData = getTelegramInitData();
      
      if (!initData) {
        // Try dev mode authentication
        console.log('No initData, trying dev mode...');
        const response = await authApi.devLogin();
        
        if (response.success && response.data) {
          setAuthToken(response.data.token);
          setUser(response.data.user);
          showTelegramAlert('Авторизация успешна!');
        } else {
          setError(response.error || 'Ошибка авторизации');
        }
        return;
      }

      const response = await authApi.telegramLogin(initData);
      
      if (response.success && response.data) {
        setAuthToken(response.data.token);
        setUser(response.data.user);
        showTelegramAlert('Авторизация успешна!');
        // Автоматический запрос номера, если требуется
        try {
          if ((response.data.user as any).phoneVerificationStatus === 'REQUIRED') {
            const tgUser = getTelegramUserUnsafe();
            if (tgUser?.id) {
              const token = getAuthToken();
              await phoneApi.requestPhone(String(tgUser.id), response.data.user.id, token!);
            }
          }
        } catch {}
      } else {
        setError(response.error || 'Ошибка авторизации');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Ошибка авторизации');
    } finally {
      setAuthenticating(false);
    }
  };

  const handleRequestContact = async () => {
    try {
      const token = getAuthToken();
      if (!token || !user) {
        showTelegramAlert('Ошибка: вы не авторизованы');
        return;
      }

      // Получаем Telegram ID из пользователя
      const telegramId = user.telegramId;
      if (!telegramId) {
        showTelegramAlert('Ошибка: Telegram ID не найден');
        return;
      }

      // Отправляем запрос через API
      const response = await phoneApi.requestPhone(telegramId.toString(), user.id, token);
      
      if (response.success) {
        showTelegramAlert('Запрос отправлен в Telegram Bot. Проверьте чат с ботом и нажмите кнопку "Отправить номер телефона".');
        
        // Начинаем проверку статуса
        checkPhoneStatus();
      } else {
        showTelegramAlert(response.error || 'Не удалось отправить запрос');
      }
    } catch (err) {
      console.error('Contact request error:', err);
      showTelegramAlert('Ошибка при запросе контакта');
    }
  };

  const checkPhoneStatus = async () => {
    if (!user) return;
    
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await phoneApi.getPhoneStatus(user.id, token);
      if (response.success && response.data) {
        // Обновляем пользователя с новыми данными
        setUser(prev => prev ? {
          ...prev,
          phone: response.data!.phone,
          phoneVerificationStatus: response.data!.phoneVerificationStatus
        } : null);
      }
    } catch (err) {
      console.error('Phone status check error:', err);
    }
  };

  const checkDocumentStatus = async () => {
    if (!user) return;
    
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await documentsApi.getDocumentVerification(user.id, token);
      if (response.success && response.data) {
        setDocumentStatus(response.data);
      }
    } catch (err) {
      console.error('Document status check error:', err);
    }
  };

  const loadPayments = async () => {
    if (!user) return;
    
    const token = getAuthToken();
    if (!token) return;

    setPaymentsLoading(true);
    try {
      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 
        (window.location.hostname === 'app.beripritsep.ru' 
          ? 'https://api.beripritsep.ru' 
          : 'http://localhost:8080');

      const response = await fetch(`${API_BASE_URL}/api/payments/user/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setPayments(result.data);
        }
      }
    } catch (err) {
      console.error('Payments load error:', err);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    setUser(null);
    showTelegramAlert('Вы вышли из аккаунта');
  };

  // New modal handlers
  const handlePhoneSubmit = async (phone: string) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await phoneApi.updatePhone(phone, token);
      if (response.success) {
        showTelegramAlert('Номер телефона сохранен!');
        setShowPhoneModal(false);
        // Refresh user data
        await checkAuth();
      } else {
        showTelegramAlert(response.error || 'Ошибка сохранения номера');
      }
    } catch (error) {
      console.error('Phone update error:', error);
      showTelegramAlert('Ошибка сохранения номера телефона');
    }
  };

  const handleUserDataSubmit = async (data: any) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await authApi.updateProfile(data, token);
      if (response.success) {
        showTelegramAlert('Данные сохранены!');
        setShowUserDataModal(false);
        // Refresh user data
        await checkAuth();
      } else {
        showTelegramAlert(response.error || 'Ошибка сохранения данных');
      }
    } catch (error) {
      console.error('User data save error:', error);
      showTelegramAlert('Ошибка сохранения данных');
    }
  };

  const handleExtendRental = () => {
    showTelegramAlert('Функция продления аренды будет доступна в ближайшее время');
  };

  const handleTimeUp = () => {
    showTelegramAlert('Время аренды истекло! Пожалуйста, верните прицеп.');
  };

  const getVerificationStatusText = (status: User['verificationStatus']) => {
    switch (status) {
      case 'PENDING':
        return 'Ожидает проверки';
      case 'VERIFIED':
        return 'Подтвержден';
      case 'REJECTED':
        return 'Отклонен';
      default:
        return 'Неизвестно';
    }
  };

  const getVerificationStatusColor = (status: User['verificationStatus']) => {
    switch (status) {
      case 'PENDING':
        return '#FF9800';
      case 'VERIFIED':
        return '#4CAF50';
      case 'REJECTED':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  if (loading) {
    return (
      <div className="fullscreen-loading">
        <div className="loading-content">
          <div className="modern-spinner"></div>
          <p className="loading-text">Загрузка профиля...</p>
          <p className="loading-subtext">Получаем ваши данные</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page">
        <div className="auth-container">
          <div className="auth-header">
            <h1>Вход в аккаунт</h1>
            <p>Для использования приложения необходимо авторизоваться через Telegram</p>
          </div>

          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          <div className="auth-actions">
            <button 
              className="auth-button"
              onClick={handleTelegramAuth}
              disabled={authenticating}
            >
              {authenticating ? (
                <>
                  <div className="loading-spinner small"></div>
                  Авторизация...
                </>
              ) : (
                'Войти через Telegram'
              )}
            </button>

            <div className="dev-mode-info">
              <p>Режим разработки:</p>
              <p>Если Telegram WebApp недоступен, будет использован тестовый аккаунт</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Мой профиль</h1>
      </div>

      <div className="profile-content">
        {/* User Info */}
        <div className="profile-section">
          <h2>Личная информация</h2>
          <div className="user-info">
            <div className="info-item">
              <span className="info-label">Имя:</span>
              <span className="info-value">{user.firstName} {user.lastName}</span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Username:</span>
              <span className="info-value">@{user.username || 'не указан'}</span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Telegram ID:</span>
              <span className="info-value">{user.telegramId}</span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Телефон:</span>
              <span className="info-value">
                {(user as any).phone || 'не указан'}
                {(user as any).phoneVerificationStatus === 'REQUIRED' && (
                  <button 
                    className="request-contact-button"
                    onClick={handleRequestContact}
                  >
                    Подтвердить номер
                  </button>
                )}
                {(user as any).phoneVerificationStatus === 'VERIFIED' && (user as any).phone && (
                  <span className="verified-badge">✓ Подтвержден</span>
                )}
              </span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Статус верификации:</span>
              <span 
                className="info-value verification-status"
                style={{ color: getVerificationStatusColor(user.verificationStatus) }}
              >
                {getVerificationStatusText(user.verificationStatus)}
              </span>
            </div>
          </div>
        </div>

        {/* Verification Section */}
        {user.verificationStatus === 'PENDING' && (
          <div className="profile-section verification-section">
            <h2>Верификация документов</h2>
            <div className="verification-info">
              <p>Для полного доступа к услугам необходимо пройти верификацию документов.</p>
              <p>Загрузите фото паспорта или водительского удостоверения для проверки.</p>
              
              {documentStatus && documentStatus.hasDocuments && (
                <div className="document-status">
                  <h4>Статус документов: {documentStatus.status}</h4>
                  {documentStatus.documents.passport && (
                    <p>📄 Паспорт: загружен</p>
                  )}
                  {documentStatus.documents.driverLicense && (
                    <p>🚗 Водительские права: загружены</p>
                  )}
                  {documentStatus.moderatorComment && (
                    <p className="moderator-comment">
                      <strong>Комментарий модератора:</strong> {documentStatus.moderatorComment}
                    </p>
                  )}
                </div>
              )}
              
              <button 
                className="upload-docs-button"
                onClick={() => navigate('/documents/upload')}
              >
                {documentStatus && documentStatus.hasDocuments ? 'Обновить документы' : 'Загрузить документы'}
              </button>
            </div>
          </div>
        )}

        {user.verificationStatus === 'REJECTED' && (
          <div className="profile-section verification-section rejected">
            <h2>Верификация отклонена</h2>
            <div className="verification-info">
              <p>Ваши документы не прошли проверку. Пожалуйста, загрузите качественные фото документов.</p>
              <button 
                className="upload-docs-button"
                onClick={() => navigate('/documents/upload')}
              >
                Загрузить документы повторно
              </button>
            </div>
          </div>
        )}

        {user.verificationStatus === 'VERIFIED' && (
          <div className="profile-section verification-section verified">
            <h2>✅ Документы подтверждены</h2>
            <div className="verification-info">
              <p>Ваши документы успешно прошли проверку. Вы можете пользоваться всеми услугами приложения.</p>
            </div>
          </div>
        )}

        {/* Payment History */}
        <div className="profile-section">
          <h2>История платежей</h2>
          {paymentsLoading ? (
            <div className="loading-message">Загрузка платежей...</div>
          ) : payments.length > 0 ? (
            <div className="payments-list">
              {payments.map((payment) => (
                <div key={payment.id} className="payment-item">
                  <div className="payment-info">
                    <div className="payment-type">
                      {payment.type === 'RENTAL' ? 'Оплата аренды' : 'Залог'}
                    </div>
                    <div className="payment-amount">{payment.amount}₽</div>
                  </div>
                  <div className="payment-details">
                    <div className={`payment-status ${payment.status.toLowerCase()}`}>
                      {payment.status === 'COMPLETED' && '✅ Оплачено'}
                      {payment.status === 'PENDING' && '⏳ Ожидание'}
                      {payment.status === 'FAILED' && '❌ Ошибка'}
                      {payment.status === 'CANCELLED' && '🚫 Отменено'}
                    </div>
                    <div className="payment-date">
                      {new Date(payment.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-payments">Платежей пока нет</div>
          )}
        </div>

        {/* Actions */}
        <div className="profile-section">
          <h2>Действия</h2>
          <div className="profile-actions">
            <button 
              className="bookings-button"
              onClick={() => navigate('/bookings')}
            >
              Мои бронирования
            </button>
            <button 
              className="logout-button"
              onClick={handleLogout}
            >
              Выйти из аккаунта
            </button>
          </div>
        </div>

        {/* Active Rental Countdown */}
        {activeRental && (
          <div className="profile-section">
            <h2>Активная аренда</h2>
            <RentalCountdown
              startTime={new Date(activeRental.startTime)}
              endTime={new Date(activeRental.endTime)}
              onTimeUp={handleTimeUp}
              onExtendRental={handleExtendRental}
            />
          </div>
        )}

        {/* Missing Data Actions */}
        {user && (
          <div className="profile-section">
            <h2>Завершите регистрацию</h2>
            <div className="registration-actions">
              {!user.phone && (
                <button 
                  className="btn-primary"
                  onClick={() => setShowPhoneModal(true)}
                >
                  📱 Добавить номер телефона
                </button>
              )}
              <button 
                className="btn-primary"
                onClick={() => setShowUserDataModal(true)}
              >
                📋 Заполнить личные данные
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <PhoneRequestModal
        isOpen={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        onPhoneSubmit={handlePhoneSubmit}
      />

      <UserDataForm
        isOpen={showUserDataModal}
        onClose={() => setShowUserDataModal(false)}
        onSubmit={handleUserDataSubmit}
      />
    </div>
  );
};

export default ProfilePage;
