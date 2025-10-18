import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trailersApi, type Trailer } from '../api';
import { showTelegramAlert } from '../telegram';
import './LocationPage.css';

const LocationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get('location_id');
  const startapp = searchParams.get('startapp');
  
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handle Telegram Mini App startapp parameter
    if (startapp) {
      if (startapp.startsWith('location_')) {
        const extractedLocationId = startapp.replace('location_', '');
        // Update URL to include location_id parameter
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set('location_id', extractedLocationId);
        newSearchParams.delete('startapp'); // Remove startapp parameter
        window.history.replaceState({}, '', `?${newSearchParams.toString()}`);
      } else if (startapp.startsWith('trailer_')) {
        const trailerId = startapp.replace('trailer_', '');
        // Redirect to trailer page
        window.location.href = `/trailer/${trailerId}`;
        return;
      }
    }
    
    loadTrailers();
  }, [locationId, startapp, searchParams]);

  const loadTrailers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await trailersApi.getTrailers(locationId || undefined);
      
      if (response.success && response.data) {
        setTrailers(response.data);
      } else {
        setError(response.error || 'Не удалось загрузить прицепы');
      }
    } catch (err) {
      console.error('Error loading trailers:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleTrailerClick = (trailerId: string) => {
    window.location.href = `/trailer/${trailerId}`;
  };

  const formatDimensions = (dimensions: Trailer['dimensions']) => {
    if (!dimensions) return 'Не указано';
    return `${dimensions.length / 1000}м × ${dimensions.width / 1000}м × ${dimensions.height / 1000}м`;
  };

  const getStatusColor = (status: Trailer['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return '#4CAF50';
      case 'RENTED':
        return '#FF9800';
      case 'MAINTENANCE':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: Trailer['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return 'Доступен';
      case 'RENTED':
        return 'Арендован';
      case 'MAINTENANCE':
        return 'На обслуживании';
      default:
        return 'Неизвестно';
    }
  };

  if (loading) {
    return (
      <div className="location-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка прицепов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="location-page">
        <div className="error-container">
          <h2>Ошибка загрузки</h2>
          <p>{error}</p>
          <button onClick={loadTrailers} className="retry-button">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (trailers.length === 0) {
    return (
      <div className="location-page">
        <div className="empty-container">
          <h2>Прицепы не найдены</h2>
          <p>В данной локации пока нет доступных прицепов</p>
        </div>
      </div>
    );
  }

  return (
    <div className="location-page">
      <div className="location-header">
        <h1>Доступные прицепы</h1>
        {locationId && (
          <p className="location-info">
            Локация: {trailers[0]?.location?.name || 'Неизвестная локация'}
          </p>
        )}
      </div>

      <div className="trailers-grid">
        {trailers.map((trailer) => (
          <div
            key={trailer.id}
            className="trailer-card"
            onClick={() => handleTrailerClick(trailer.id)}
          >
            <div className="trailer-image">
              {trailer.photos.length > 0 ? (
                <img
                  src={trailer.photos[0]}
                  alt={trailer.name}
                  loading="lazy"
                />
              ) : (
                <div className="no-image">
                  <span>📷</span>
                </div>
              )}
              <div 
                className="status-badge"
                style={{ backgroundColor: getStatusColor(trailer.status) }}
              >
                {getStatusText(trailer.status)}
              </div>
            </div>

            <div className="trailer-info">
              <h3 className="trailer-name">{trailer.name}</h3>
              
              <div className="trailer-specs">
                <div className="spec-item">
                  <span className="spec-label">Грузоподъемность:</span>
                  <span className="spec-value">{trailer.capacity} кг</span>
                </div>
                
                <div className="spec-item">
                  <span className="spec-label">Габариты:</span>
                  <span className="spec-value">{formatDimensions(trailer.dimensions)}</span>
                </div>
                
                <div className="spec-item">
                  <span className="spec-label">Особенности:</span>
                  <span className="spec-value">
                    {trailer.features.length > 0 ? trailer.features.join(', ') : 'Нет'}
                  </span>
                </div>
              </div>

              <div className="trailer-pricing">
                <div className="price-item">
                  <span className="price-label">Минимум:</span>
                  <span className="price-value">{trailer.minRentalHours}ч = {trailer.minRentalPrice}₽</span>
                </div>
                <div className="price-item">
                  <span className="price-label">Доп. час:</span>
                  <span className="price-value">{trailer.extraHourPrice}₽</span>
                </div>
                <div className="price-item">
                  <span className="price-label">Сутки:</span>
                  <span className="price-value">{trailer.dailyRate}₽</span>
                </div>
              </div>

              <div className="trailer-actions">
                <button 
                  className="view-details-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTrailerClick(trailer.id);
                  }}
                >
                  Подробнее
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="location-footer">
        <p className="trailers-count">
          Найдено прицепов: {trailers.length}
        </p>
      </div>
    </div>
  );
};

export default LocationPage;
