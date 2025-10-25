import React, { useState, useEffect } from 'react';
import './UsersPage.css';

interface UsersPageProps {
  onUserSelect: (userId: string) => void;
}

interface User {
  id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  phone?: string;
  phoneVerificationStatus: 'REQUIRED' | 'VERIFIED';
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentVerification {
  id: string;
  userId: string;
  status: 'PENDING_MODERATION' | 'APPROVED' | 'REJECTED';
  moderatorComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Mock data removed - using real API calls

const UsersPage: React.FC<UsersPageProps> = ({ onUserSelect }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [documentVerifications, setDocumentVerifications] = useState<DocumentVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Check if admin is logged in
      const token = localStorage.getItem('admin_token');
      if (!token) {
        console.error('No admin token found');
        setError('Необходимо войти в систему');
        return;
      }
      
      // Load users from API
      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api';
      console.log('Loading users from:', `${API_BASE_URL}/admin/users`);
      const usersResponse = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Users response status:', usersResponse.status);
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        console.log('Users data received:', usersData);
        if (usersData.success) {
          console.log('Setting users:', usersData.data);
          setUsers(usersData.data.map((user: any) => ({
            ...user,
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt)
          })));
        } else {
          console.error('API error:', usersData.error);
          setError(`Ошибка API: ${usersData.error}`);
        }
      } else {
        const errorText = await usersResponse.text();
        console.error('HTTP error:', usersResponse.status, errorText);
        setError(`Ошибка HTTP: ${usersResponse.status}`);
      }
      
      // Load document verifications from API
      const docsResponse = await fetch(`${API_BASE_URL}/admin/document-verifications`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        if (docsData.success) {
          setDocumentVerifications(docsData.data.map((doc: any) => ({
            ...doc,
            createdAt: new Date(doc.createdAt),
            updatedAt: new Date(doc.updatedAt)
          })));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUser = async (userId: string, status: 'VERIFIED' | 'REJECTED', comment?: string) => {
    try {
      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api';
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ status, comment })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Update local state
          setUsers(users.map(user => 
            user.id === userId 
              ? { ...user, verificationStatus: status, updatedAt: new Date() }
              : user
          ));
          
          // Update document verification
          setDocumentVerifications(documentVerifications.map(dv =>
            dv.userId === userId
              ? { ...dv, status: status === 'VERIFIED' ? 'APPROVED' : 'REJECTED', moderatorComment: comment, updatedAt: new Date() }
              : dv
          ));
          
          alert(`Пользователь ${status === 'VERIFIED' ? 'верифицирован' : 'отклонен'} успешно`);
        } else {
          alert(`Ошибка: ${result.error}`);
        }
      } else {
        alert('Ошибка при обновлении статуса пользователя');
      }
    } catch (error) {
      console.error('Error verifying user:', error);
      alert('Ошибка при обновлении статуса пользователя');
    }
  };

  const handleViewDocuments = (user: User) => {
    setSelectedUser(user);
    setShowDocumentModal(true);
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

  const filteredUsers = users.filter(user => {
    if (filter === 'ALL') return true;
    return user.verificationStatus === filter;
  });

  if (loading) {
    return <div className="admin-users-page loading">Загрузка пользователей...</div>;
  }

  if (error) {
    return (
      <div className="admin-users-page">
        <div className="error-message">
          <h3>Ошибка</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Перезагрузить страницу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-users-page">
      <div className="page-header">
        <h2>Управление пользователями</h2>
        <div className="header-controls">
          <div className="filter-controls">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as any)}
              className="filter-select"
            >
              <option value="ALL">Все пользователи</option>
              <option value="PENDING">Ожидают проверки</option>
              <option value="VERIFIED">Подтверждены</option>
              <option value="REJECTED">Отклонены</option>
            </select>
          </div>
          <button 
            className="refresh-button"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? '🔄' : '🔄'} Обновить
          </button>
        </div>
      </div>

      <div className="users-stats">
        <div className="stat-card">
          <h3>Всего пользователей</h3>
          <span className="stat-number">{users.length}</span>
        </div>
        <div className="stat-card">
          <h3>Ожидают проверки</h3>
          <span className="stat-number">{users.filter(u => u.verificationStatus === 'PENDING').length}</span>
        </div>
        <div className="stat-card">
          <h3>Подтверждены</h3>
          <span className="stat-number">{users.filter(u => u.verificationStatus === 'VERIFIED').length}</span>
        </div>
        <div className="stat-card">
          <h3>Отклонены</h3>
          <span className="stat-number">{users.filter(u => u.verificationStatus === 'REJECTED').length}</span>
        </div>
      </div>

      <div className="users-list">
        {filteredUsers.map(user => {
          const docVerification = documentVerifications.find(dv => dv.userId === user.id);
          
          return (
            <div key={user.id} className="user-item">
              <div className="user-info">
                <div className="user-header">
                  <h3>{user.firstName} {user.lastName}</h3>
                  <span 
                    className="verification-status"
                    style={{ color: getVerificationStatusColor(user.verificationStatus) }}
                  >
                    {getVerificationStatusText(user.verificationStatus)}
                  </span>
                </div>
                
                <div className="user-details">
                  <p><strong>Telegram ID:</strong> {user.telegramId}</p>
                  <p><strong>Username:</strong> @{user.username}</p>
                  <p><strong>Телефон:</strong> {user.phone || user.phoneNumber}</p>
                  <p><strong>Статус телефона:</strong> 
                    <span className={user.phoneVerificationStatus === 'VERIFIED' ? 'verified' : 'pending'}>
                      {user.phoneVerificationStatus === 'VERIFIED' ? 'Подтвержден' : 'Требуется'}
                    </span>
                  </p>
                  <p><strong>Регистрация:</strong> {user.createdAt.toLocaleDateString('ru-RU')}</p>
                </div>

                {docVerification && (
                  <div className="document-info">
                    <h4>Документы:</h4>
                    <p><strong>Статус:</strong> 
                      <span className={`doc-status ${docVerification.status.toLowerCase()}`}>
                        {docVerification.status === 'PENDING_MODERATION' ? 'На модерации' :
                         docVerification.status === 'APPROVED' ? 'Одобрены' : 'Отклонены'}
                      </span>
                    </p>
                    {docVerification.moderatorComment && (
                      <p><strong>Комментарий:</strong> {docVerification.moderatorComment}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="user-actions">
                <button 
                  className="profile-button"
                  onClick={() => onUserSelect(user.id)}
                >
                  👤 Профиль
                </button>
                
                {docVerification && (
                  <button 
                    className="documents-button"
                    onClick={() => handleViewDocuments(user)}
                  >
                    Документы
                  </button>
                )}
                
                {user.verificationStatus === 'PENDING' && (
                  <>
                    <button 
                      className="approve-button"
                      onClick={() => handleVerifyUser(user.id, 'VERIFIED')}
                    >
                      Одобрить
                    </button>
                    <button 
                      className="reject-button"
                      onClick={() => {
                        const comment = prompt('Причина отклонения:');
                        if (comment) {
                          handleVerifyUser(user.id, 'REJECTED', comment);
                        }
                      }}
                    >
                      Отклонить
                    </button>
                  </>
                )}
                
                {user.verificationStatus === 'REJECTED' && (
                  <button 
                    className="approve-button"
                    onClick={() => handleVerifyUser(user.id, 'VERIFIED')}
                  >
                    Одобрить
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showDocumentModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Документы пользователя: {selectedUser.firstName} {selectedUser.lastName}</h2>
              <button 
                className="close-button"
                onClick={() => setShowDocumentModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="document-viewer">
                <p>Здесь будет отображение загруженных документов:</p>
                <ul>
                  <li>📄 Паспорт (если загружен)</li>
                  <li>🚗 Водительские права (если загружены)</li>
                </ul>
                <p className="note">В реальном приложении здесь будут отображаться фотографии документов для модерации.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
