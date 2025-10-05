import React, { useState, useEffect } from 'react';
import { trailersApi, type Trailer } from '../api';
import QRGenerator from '../components/QRGenerator';
import './TrailersPage.css';

const TrailersPage: React.FC = () => {
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTrailer, setEditingTrailer] = useState<Trailer | null>(null);
  const [qrGenerator, setQrGenerator] = useState<{ type: 'TRAILER'; id: string; name: string } | null>(null);

  useEffect(() => {
    loadTrailers();
  }, []);

  const loadTrailers = async () => {
    try {
      setLoading(true);
      const response = await trailersApi.getTrailers();
      if (response.success && response.data) {
        setTrailers(response.data);
      }
    } catch (error) {
      console.error('Error loading trailers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrailer = () => {
    setEditingTrailer(null);
    setShowAddForm(true);
  };

  const handleEditTrailer = (trailer: Trailer) => {
    setEditingTrailer(trailer);
    setShowAddForm(true);
  };

  const handleDeleteTrailer = async (trailerId: string) => {
    if (confirm('Вы уверены, что хотите удалить этот прицеп?')) {
      try {
        // TODO: Implement delete API
        console.log('Delete trailer:', trailerId);
        loadTrailers();
      } catch (error) {
        console.error('Error deleting trailer:', error);
      }
    }
  };

  if (loading) {
    return <div className="trailers-page loading">Загрузка...</div>;
  }

  return (
    <div className="trailers-page">
      <div className="page-header">
        <h1>Управление прицепами</h1>
        <button className="add-button" onClick={handleAddTrailer}>
          + Добавить прицеп
        </button>
      </div>

      <div className="trailers-grid">
        {trailers.map((trailer) => (
          <div key={trailer.id} className="trailer-card">
            <div className="trailer-image">
              {trailer.photos.length > 0 && (
                <img src={trailer.photos[0]} alt={trailer.name} />
              )}
            </div>
            
            <div className="trailer-info">
              <h3>{trailer.name}</h3>
              <p className="trailer-description">{trailer.description}</p>
              
              <div className="trailer-specs">
                <div className="spec-item">
                  <span className="spec-label">Грузоподъемность:</span>
                  <span className="spec-value">{trailer.capacity} кг</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Тент:</span>
                  <span className="spec-value">{trailer.hasTent ? 'Есть' : 'Нет'}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Статус:</span>
                  <span className={`status ${trailer.isAvailable ? 'available' : 'unavailable'}`}>
                    {trailer.isAvailable ? 'Доступен' : 'Недоступен'}
                  </span>
                </div>
              </div>

              <div className="trailer-pricing">
                <div className="price-item">
                  <span>Минимум:</span>
                  <span>{trailer.pricing.minHours}ч = {trailer.pricing.minCost}₽</span>
                </div>
                <div className="price-item">
                  <span>Час:</span>
                  <span>{trailer.pricing.hourPrice}₽</span>
                </div>
                <div className="price-item">
                  <span>Сутки:</span>
                  <span>{trailer.pricing.dayPrice}₽</span>
                </div>
                <div className="price-item">
                  <span>Залог:</span>
                  <span>{trailer.pricing.deposit}₽</span>
                </div>
              </div>
            </div>

            <div className="trailer-actions">
              <button 
                className="qr-button"
                onClick={() => setQrGenerator({ type: 'TRAILER', id: trailer.id, name: trailer.name })}
              >
                QR-код
              </button>
              <button 
                className="edit-button"
                onClick={() => handleEditTrailer(trailer)}
              >
                Редактировать
              </button>
              <button 
                className="delete-button"
                onClick={() => handleDeleteTrailer(trailer.id)}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingTrailer ? 'Редактировать прицеп' : 'Добавить прицеп'}</h2>
              <button 
                className="close-button"
                onClick={() => setShowAddForm(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <p>Форма добавления/редактирования прицепа будет здесь</p>
              <p>Пока что это заглушка для демонстрации</p>
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-button"
                onClick={() => setShowAddForm(false)}
              >
                Отмена
              </button>
              <button 
                className="save-button"
                onClick={() => {
                  // TODO: Implement save
                  setShowAddForm(false);
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {qrGenerator && (
        <QRGenerator
          type={qrGenerator.type}
          id={qrGenerator.id}
          name={qrGenerator.name}
          onClose={() => setQrGenerator(null)}
        />
      )}
    </div>
  );
};

export default TrailersPage;
