import React, { useState, useEffect } from 'react';
import './UserProfilePage.css';

interface UserProfilePageProps {
  userId: string;
  onBack: () => void;
}

interface User {
  id: number;
  telegramId: string;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

interface Booking {
  id: number;
  userId: number;
  trailerId: number;
  startDate: string;
  endDate: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface Transaction {
  id: number;
  userId: number;
  amount: number;
  type: string;
  status: string;
  createdAt: string;
}

interface Document {
  id: number;
  userId: number;
  type: string;
  status: string;
  filename: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

const UserProfilePage: React.FC<UserProfilePageProps> = ({ userId, onBack }) => {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'bookings' | 'transactions' | 'documents'>('profile');

  useEffect(() => {
    if (userId) {
      loadUserData();
    }
  }, [userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setError('Необходимо войти в систему');
        return;
      }

      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api';
      
      // Load user profile
      const userResponse = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success) {
          setUser(userData.data);
        }
      }

      // Load bookings (mock data for now)
      setBookings([
        {
          id: 1,
          userId: parseInt(userId!),
          trailerId: 1,
          startDate: '2025-10-15',
          endDate: '2025-10-20',
          status: 'CONFIRMED',
          totalAmount: 5000,
          createdAt: '2025-10-14T10:00:00Z'
        }
      ]);

      // Load transactions (mock data for now)
      setTransactions([
        {
          id: 1,
          userId: parseInt(userId!),
          amount: 5000,
          type: 'PAYMENT',
          status: 'COMPLETED',
          createdAt: '2025-10-14T10:00:00Z'
        }
      ]);

      // Load documents from API
      const docsResponse = await fetch(`${API_BASE_URL}/admin/users/${userId}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        if (docsData.success) {
          setDocuments(docsData.data);
        }
      }

    } catch (error) {
      console.error('Error loading user data:', error);
      setError('Ошибка загрузки данных пользователя');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUser = async (status: 'VERIFIED' | 'REJECTED', comment?: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api';
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, comment })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setUser(result.data);
          alert(`Пользователь ${status === 'VERIFIED' ? 'одобрен' : 'отклонен'}`);
        }
      }
    } catch (error) {
      console.error('Error verifying user:', error);
      alert('Ошибка при изменении статуса пользователя');
    }
  };

  const handleResetVerification = async () => {
    if (!confirm('Вы уверены, что хотите сбросить статус верификации? Пользователь сможет загрузить документы заново.')) {
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api';
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/reset-verification`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setUser(result.data);
          alert('Статус верификации сброшен. Пользователь может загрузить документы заново.');
        }
      }
    } catch (error) {
      console.error('Error resetting verification:', error);
      alert('Ошибка при сбросе статуса верификации');
    }
  };

  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);

  const handleViewDocument = async (document: Document) => {
    try {
      setDocumentLoading(true);
      setSelectedDocument(document);
      
      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api';
      const token = localStorage.getItem('admin_token');
      
      if (!token) {
        alert('Необходимо войти в систему');
        return;
      }

      // Create a temporary URL with proper authorization
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/documents/${document.id}/view`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Create blob URL for the document
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setDocumentUrl(url);
      } else {
        const errorData = await response.json();
        alert(`Ошибка при загрузке документа: ${errorData.error || 'Неизвестная ошибка'}`);
        setSelectedDocument(null);
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('Ошибка при загрузке документа');
      setSelectedDocument(null);
    } finally {
      setDocumentLoading(false);
    }
  };

  const closeDocumentViewer = () => {
    if (documentUrl) {
      URL.revokeObjectURL(documentUrl);
    }
    setSelectedDocument(null);
    setDocumentUrl(null);
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedDocument) {
        closeDocumentViewer();
      }
    };

    if (selectedDocument) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [selectedDocument]);

  if (loading) {
    return <div className="user-profile-page loading">Загрузка профиля пользователя...</div>;
  }

  if (error) {
    return (
      <div className="user-profile-page">
        <div className="error-message">
          <h3>Ошибка</h3>
          <p>{error}</p>
          <button onClick={() => onBack()}>
            Вернуться к списку пользователей
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="user-profile-page">
        <div className="error-message">
          <h3>Пользователь не найден</h3>
          <button onClick={() => onBack()}>
            Вернуться к списку пользователей
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="user-profile-page">
      <div className="profile-header">
        <button 
          className="back-button"
          onClick={onBack}
        >
          ← Назад к пользователям
        </button>
        <h2>Профиль пользователя</h2>
        <button 
          className="reset-button"
          onClick={handleResetVerification}
        >
          🔄 Сбросить верификацию
        </button>
      </div>

      <div className="profile-content">
        <div className="user-info-card">
          <div className="user-avatar">
            <div className="avatar-placeholder">
              {user.firstName.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="user-details">
            <h3>{user.firstName} {user.lastName}</h3>
            <p className="username">@{user.username}</p>
            <div className="user-stats">
              <div className="stat">
                <span className="label">Telegram ID:</span>
                <span className="value">{user.telegramId}</span>
              </div>
              <div className="stat">
                <span className="label">Телефон:</span>
                <span className="value">{user.phoneNumber || 'Не указан'}</span>
              </div>
              <div className="stat">
                <span className="label">Статус:</span>
                <span className={`status ${user.verificationStatus.toLowerCase()}`}>
                  {user.verificationStatus === 'PENDING' ? 'Ожидает проверки' :
                   user.verificationStatus === 'VERIFIED' ? 'Подтвержден' : 'Отклонен'}
                </span>
              </div>
              <div className="stat">
                <span className="label">Регистрация:</span>
                <span className="value">{new Date(user.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>
          </div>
          <div className="user-actions">
            {user.verificationStatus === 'PENDING' && (
              <>
                <button 
                  className="approve-button"
                  onClick={() => handleVerifyUser('VERIFIED', 'Одобрено администратором')}
                >
                  ✅ Одобрить
                </button>
                <button 
                  className="reject-button"
                  onClick={() => handleVerifyUser('REJECTED', 'Отклонено администратором')}
                >
                  ❌ Отклонить
                </button>
              </>
            )}
            <button 
              className="reset-button"
              onClick={handleResetVerification}
            >
              🔄 Сбросить верификацию
            </button>
          </div>
        </div>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Профиль
          </button>
          <button 
            className={`tab ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            Бронирования ({bookings.length})
          </button>
          <button 
            className={`tab ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            Транзакции ({transactions.length})
          </button>
          <button 
            className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            Документы ({documents.length})
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'profile' && (
            <div className="profile-tab">
              <h3>Детальная информация</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>ID пользователя:</label>
                  <span>{user.id}</span>
                </div>
                <div className="info-item">
                  <label>Telegram ID:</label>
                  <span>{user.telegramId}</span>
                </div>
                <div className="info-item">
                  <label>Имя:</label>
                  <span>{user.firstName}</span>
                </div>
                <div className="info-item">
                  <label>Фамилия:</label>
                  <span>{user.lastName || 'Не указана'}</span>
                </div>
                <div className="info-item">
                  <label>Username:</label>
                  <span>@{user.username}</span>
                </div>
                <div className="info-item">
                  <label>Телефон:</label>
                  <span>{user.phoneNumber || 'Не указан'}</span>
                </div>
                <div className="info-item">
                  <label>Статус верификации:</label>
                  <span className={`status ${user.verificationStatus.toLowerCase()}`}>
                    {user.verificationStatus === 'PENDING' ? 'Ожидает проверки' :
                     user.verificationStatus === 'VERIFIED' ? 'Подтвержден' : 'Отклонен'}
                  </span>
                </div>
                <div className="info-item">
                  <label>Дата регистрации:</label>
                  <span>{new Date(user.createdAt).toLocaleString('ru-RU')}</span>
                </div>
                <div className="info-item">
                  <label>Последнее обновление:</label>
                  <span>{new Date(user.updatedAt).toLocaleString('ru-RU')}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="bookings-tab">
              <h3>Бронирования</h3>
              {bookings.length === 0 ? (
                <p>Бронирований нет</p>
              ) : (
                <div className="bookings-list">
                  {bookings.map(booking => (
                    <div key={booking.id} className="booking-card">
                      <div className="booking-header">
                        <span className="booking-id">#{booking.id}</span>
                        <span className={`booking-status ${booking.status.toLowerCase()}`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="booking-details">
                        <p><strong>Период:</strong> {new Date(booking.startDate).toLocaleDateString('ru-RU')} - {new Date(booking.endDate).toLocaleDateString('ru-RU')}</p>
                        <p><strong>Сумма:</strong> {booking.totalAmount} ₽</p>
                        <p><strong>Дата создания:</strong> {new Date(booking.createdAt).toLocaleString('ru-RU')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="transactions-tab">
              <h3>Транзакции</h3>
              {transactions.length === 0 ? (
                <p>Транзакций нет</p>
              ) : (
                <div className="transactions-list">
                  {transactions.map(transaction => (
                    <div key={transaction.id} className="transaction-card">
                      <div className="transaction-header">
                        <span className="transaction-id">#{transaction.id}</span>
                        <span className={`transaction-status ${transaction.status.toLowerCase()}`}>
                          {transaction.status}
                        </span>
                      </div>
                      <div className="transaction-details">
                        <p><strong>Тип:</strong> {transaction.type}</p>
                        <p><strong>Сумма:</strong> {transaction.amount} ₽</p>
                        <p><strong>Дата:</strong> {new Date(transaction.createdAt).toLocaleString('ru-RU')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="documents-tab">
              <h3>Документы</h3>
              {documents.length === 0 ? (
                <p>Документов нет</p>
              ) : (
                <div className="documents-list">
                  {documents.map(document => (
                    <div key={document.id} className="document-card">
                      <div className="document-header">
                        <span className="document-type">{document.type}</span>
                        <span className={`document-status ${document.status.toLowerCase()}`}>
                          {document.status}
                        </span>
                      </div>
                      <div className="document-details">
                        <p><strong>Файл:</strong> {document.filename}</p>
                        <p><strong>Дата загрузки:</strong> {new Date(document.createdAt).toLocaleString('ru-RU')}</p>
                        <button 
                          className="view-document-button"
                          onClick={() => handleViewDocument(document)}
                        >
                          👁️ Просмотреть
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div 
          className="document-viewer-modal"
          onClick={closeDocumentViewer}
        >
          <div 
            className="document-viewer-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="document-viewer-header">
              <h3>Просмотр документа: {selectedDocument.filename}</h3>
              <button 
                className="close-button"
                onClick={closeDocumentViewer}
              >
                ×
              </button>
            </div>
            
            <div className="document-viewer-body">
              {documentLoading ? (
                <div className="loading-spinner">
                  <div className="spinner"></div>
                  <span>Загрузка документа...</span>
                </div>
              ) : documentUrl ? (
                <div className="document-preview">
                  {selectedDocument.filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
                    <img 
                      src={documentUrl} 
                      alt={selectedDocument.filename}
                      className="document-image"
                    />
                  ) : (
                    <div className="document-file">
                      <div className="file-icon">📄</div>
                      <p>Файл: {selectedDocument.filename}</p>
                      <p>Тип: {selectedDocument.type}</p>
                      <p>Статус: {selectedDocument.status}</p>
                      <a 
                        href={documentUrl} 
                        download={selectedDocument.filename}
                        className="download-button"
                      >
                        📥 Скачать файл
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="error-message">
                  <p>Ошибка при загрузке документа</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage;
