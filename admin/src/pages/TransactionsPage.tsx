import React, { useState, useEffect } from 'react';
import './TransactionsPage.css';

interface Transaction {
  id: string;
  bookingId: string;
  userId: string;
  type: 'RENTAL_PAYMENT' | 'DEPOSIT_HOLD' | 'DEPOSIT_RELEASE' | 'DEPOSIT_CHARGE' | 'REFUND';
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  paymentMethod: 'TINKOFF' | 'CASH' | 'CARD';
  tinkoffPaymentId?: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Booking {
  id: string;
  userId: string;
  trailerId: string;
  startTime: Date;
  endTime: Date;
}

const mockTransactions: Transaction[] = [];

const mockBookings: Booking[] = [];

const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RENTAL_PAYMENT' | 'DEPOSIT_HOLD' | 'DEPOSIT_RELEASE' | 'DEPOSIT_CHARGE' | 'REFUND'>('ALL');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTransactions(mockTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (transactionId: string, newStatus: Transaction['status']) => {
    setTransactions(transactions.map(transaction => 
      transaction.id === transactionId 
        ? { ...transaction, status: newStatus, updatedAt: new Date() }
        : transaction
    ));
    alert(`Статус транзакции изменен на: ${getStatusText(newStatus)} (mock)`);
  };

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailsModal(true);
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'PENDING':
        return '#FF9800';
      case 'SUCCESS':
        return '#4CAF50';
      case 'FAILED':
        return '#F44336';
      case 'CANCELLED':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: Transaction['status']) => {
    switch (status) {
      case 'PENDING':
        return 'Ожидает';
      case 'SUCCESS':
        return 'Успешно';
      case 'FAILED':
        return 'Ошибка';
      case 'CANCELLED':
        return 'Отменено';
      default:
        return 'Неизвестно';
    }
  };

  const getTypeText = (type: Transaction['type']) => {
    switch (type) {
      case 'RENTAL_PAYMENT':
        return 'Оплата аренды';
      case 'DEPOSIT_HOLD':
        return 'Блокировка залога';
      case 'DEPOSIT_RELEASE':
        return 'Возврат залога';
      case 'DEPOSIT_CHARGE':
        return 'Списание залога';
      case 'REFUND':
        return 'Возврат средств';
      default:
        return 'Неизвестно';
    }
  };

  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'RENTAL_PAYMENT':
        return '#2196F3';
      case 'DEPOSIT_HOLD':
        return '#FF9800';
      case 'DEPOSIT_RELEASE':
        return '#4CAF50';
      case 'DEPOSIT_CHARGE':
        return '#F44336';
      case 'REFUND':
        return '#9C27B0';
      default:
        return '#9E9E9E';
    }
  };

  const getPaymentMethodText = (method: Transaction['paymentMethod']) => {
    switch (method) {
      case 'TINKOFF':
        return 'Tinkoff';
      case 'CASH':
        return 'Наличные';
      case 'CARD':
        return 'Карта';
      default:
        return 'Неизвестно';
    }
  };

  const getBookingInfo = (bookingId: string) => {
    const booking = mockBookings.find(b => b.id === bookingId);
    return booking ? `Бронирование #${booking.id}` : 'Неизвестное бронирование';
  };

  const filteredTransactions = transactions.filter(transaction => {
    const statusMatch = filter === 'ALL' || transaction.status === filter;
    const typeMatch = typeFilter === 'ALL' || transaction.type === typeFilter;
    return statusMatch && typeMatch;
  });

  const totalAmount = transactions
    .filter(t => t.status === 'SUCCESS')
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingAmount = transactions
    .filter(t => t.status === 'PENDING')
    .reduce((sum, t) => sum + t.amount, 0);

  if (loading) {
    return <div className="admin-transactions-page loading">Загрузка транзакций...</div>;
  }

  return (
    <div className="admin-transactions-page">
      <div className="page-header">
        <h2>Управление транзакциями</h2>
        <div className="filter-controls">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="ALL">Все статусы</option>
            <option value="PENDING">Ожидают</option>
            <option value="SUCCESS">Успешные</option>
            <option value="FAILED">Ошибки</option>
            <option value="CANCELLED">Отменены</option>
          </select>
          
          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="ALL">Все типы</option>
            <option value="RENTAL_PAYMENT">Оплата аренды</option>
            <option value="DEPOSIT_HOLD">Блокировка залога</option>
            <option value="DEPOSIT_RELEASE">Возврат залога</option>
            <option value="DEPOSIT_CHARGE">Списание залога</option>
            <option value="REFUND">Возврат средств</option>
          </select>
        </div>
      </div>

      <div className="transactions-stats">
        <div className="stat-card">
          <h3>Всего транзакций</h3>
          <span className="stat-number">{transactions.length}</span>
        </div>
        <div className="stat-card">
          <h3>Успешные</h3>
          <span className="stat-number">{transactions.filter(t => t.status === 'SUCCESS').length}</span>
        </div>
        <div className="stat-card">
          <h3>Ожидают</h3>
          <span className="stat-number">{transactions.filter(t => t.status === 'PENDING').length}</span>
        </div>
        <div className="stat-card">
          <h3>Общая сумма</h3>
          <span className="stat-number">{totalAmount.toLocaleString()}₽</span>
        </div>
        <div className="stat-card">
          <h3>В обработке</h3>
          <span className="stat-number">{pendingAmount.toLocaleString()}₽</span>
        </div>
      </div>

      <div className="transactions-list">
        {filteredTransactions.map(transaction => (
          <div key={transaction.id} className="transaction-item">
            <div className="transaction-info">
              <div className="transaction-header">
                <h3>Транзакция #{transaction.id}</h3>
                <div className="status-badges">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(transaction.status) }}
                  >
                    {getStatusText(transaction.status)}
                  </span>
                  <span 
                    className="type-badge"
                    style={{ backgroundColor: getTypeColor(transaction.type) }}
                  >
                    {getTypeText(transaction.type)}
                  </span>
                </div>
              </div>
              
              <div className="transaction-details">
                <div className="detail-row">
                  <span className="label">Сумма:</span>
                  <span className="value amount">{transaction.amount.toLocaleString()}₽</span>
                </div>
                <div className="detail-row">
                  <span className="label">Бронирование:</span>
                  <span className="value">{getBookingInfo(transaction.bookingId)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Способ оплаты:</span>
                  <span className="value">{getPaymentMethodText(transaction.paymentMethod)}</span>
                </div>
                {transaction.tinkoffPaymentId && (
                  <div className="detail-row">
                    <span className="label">ID платежа:</span>
                    <span className="value">{transaction.tinkoffPaymentId}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="label">Описание:</span>
                  <span className="value">{transaction.description}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Создано:</span>
                  <span className="value">{transaction.createdAt.toLocaleString('ru-RU')}</span>
                </div>
              </div>
            </div>

            <div className="transaction-actions">
              <button 
                className="details-button"
                onClick={() => handleViewDetails(transaction)}
              >
                Подробности
              </button>
              
              {transaction.status === 'PENDING' && (
                <>
                  <button 
                    className="approve-button"
                    onClick={() => handleStatusChange(transaction.id, 'SUCCESS')}
                  >
                    Подтвердить
                  </button>
                  <button 
                    className="cancel-button"
                    onClick={() => handleStatusChange(transaction.id, 'CANCELLED')}
                  >
                    Отменить
                  </button>
                </>
              )}
              
              {transaction.status === 'FAILED' && (
                <button 
                  className="retry-button"
                  onClick={() => handleStatusChange(transaction.id, 'PENDING')}
                >
                  Повторить
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showDetailsModal && selectedTransaction && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Детали транзакции #{selectedTransaction.id}</h2>
              <button 
                className="close-button"
                onClick={() => setShowDetailsModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="transaction-details-full">
                <div className="detail-section">
                  <h3>Основная информация</h3>
                  <p><strong>ID транзакции:</strong> {selectedTransaction.id}</p>
                  <p><strong>Тип:</strong> {getTypeText(selectedTransaction.type)}</p>
                  <p><strong>Статус:</strong> {getStatusText(selectedTransaction.status)}</p>
                  <p><strong>Сумма:</strong> {selectedTransaction.amount.toLocaleString()}₽</p>
                  <p><strong>Способ оплаты:</strong> {getPaymentMethodText(selectedTransaction.paymentMethod)}</p>
                </div>
                
                <div className="detail-section">
                  <h3>Связанные данные</h3>
                  <p><strong>Бронирование:</strong> {getBookingInfo(selectedTransaction.bookingId)}</p>
                  <p><strong>Пользователь:</strong> {selectedTransaction.userId}</p>
                  {selectedTransaction.tinkoffPaymentId && (
                    <p><strong>ID платежа Tinkoff:</strong> {selectedTransaction.tinkoffPaymentId}</p>
                  )}
                </div>
                
                <div className="detail-section">
                  <h3>Дополнительная информация</h3>
                  <p><strong>Описание:</strong> {selectedTransaction.description}</p>
                  <p><strong>Создано:</strong> {selectedTransaction.createdAt.toLocaleString('ru-RU')}</p>
                  <p><strong>Обновлено:</strong> {selectedTransaction.updatedAt.toLocaleString('ru-RU')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;
