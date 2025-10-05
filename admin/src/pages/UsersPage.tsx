import React, { useState, useEffect } from 'react';
import './UsersPage.css';

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

const mockUsers: User[] = [
  {
    id: 'user_dev_1',
    telegramId: 123456789,
    firstName: 'Иван',
    lastName: 'Петров',
    username: 'ivan_petrov',
    phoneNumber: '+7 (900) 123-45-67',
    phone: '+7 (900) 123-45-67',
    phoneVerificationStatus: 'VERIFIED',
    verificationStatus: 'PENDING',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: 'user_2',
    telegramId: 987654321,
    firstName: 'Мария',
    lastName: 'Сидорова',
    username: 'maria_s',
    phoneNumber: '+7 (900) 987-65-43',
    phoneVerificationStatus: 'REQUIRED',
    verificationStatus: 'PENDING',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-12')
  }
];

const mockDocumentVerifications: DocumentVerification[] = [
  {
    id: 'docver_1',
    userId: 'user_dev_1',
    status: 'PENDING_MODERATION',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  }
];

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [documentVerifications, setDocumentVerifications] = useState<DocumentVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUsers(mockUsers);
      setDocumentVerifications(mockDocumentVerifications);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUser = (userId: string, status: 'VERIFIED' | 'REJECTED', comment?: string) => {
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
    
    alert(`Пользователь ${status === 'VERIFIED' ? 'верифицирован' : 'отклонен'} (mock)`);
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

  return (
    <div className="admin-users-page">
      <div className="page-header">
        <h2>Управление пользователями</h2>
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
