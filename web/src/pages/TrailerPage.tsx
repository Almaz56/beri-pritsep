import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { trailersApi, quoteApi, type Trailer, type QuoteRequest } from '../api';
import { showTelegramAlert, setupTelegramMainButton, hideTelegramMainButton } from '../telegram';
import './TrailerPage.css';

const TrailerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [trailer, setTrailer] = useState<Trailer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingData, setBookingData] = useState({
    rentalType: 'HOURLY' as 'HOURLY' | 'DAILY',
    startDate: '',
    startTime: '',
    duration: 2,
    pickup: false
  });
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    // Handle Telegram Mini App startapp parameter
    const startapp = searchParams.get('startapp');
    if (startapp && startapp.startsWith('trailer_')) {
      const trailerId = startapp.replace('trailer_', '');
      // Clean URL by removing startapp parameter
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('startapp');
      const newUrl = newSearchParams.toString() ? `?${newSearchParams.toString()}` : '';
      window.history.replaceState({}, '', `/trailer/${trailerId}${newUrl}`);
    }
    
    if (id) {
      loadTrailer();
    }
  }, [id, searchParams]);

  useEffect(() => {
    if (showBookingForm && quote && quote.pricing) {
      setupTelegramMainButton('Забронировать', handleBooking, {
        color: '#4CAF50',
        textColor: '#ffffff'
      });
    } else {
      hideTelegramMainButton();
    }

    return () => {
      hideTelegramMainButton();
    };
  }, [showBookingForm, quote]);

  useEffect(() => {
    if (bookingData.startDate && bookingData.startTime && bookingData.duration > 0) {
      calculateQuote();
    }
  }, [bookingData.startDate, bookingData.startTime, bookingData.duration, bookingData.rentalType, bookingData.pickup]);

  const loadTrailer = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const response = await trailersApi.getTrailer(id);
      if (response.success && response.data) {
        setTrailer(response.data);
      } else {
        setError(response.error || 'Прицеп не найден');
      }
    } catch (error) {
      console.error('Error loading trailer:', error);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const calculateQuote = useCallback(async () => {
    if (!trailer || !bookingData.startDate || !bookingData.startTime || bookingData.duration <= 0) {
      return;
    }

    try {
      setQuoteLoading(true);
      const startTime = new Date(`${bookingData.startDate}T${bookingData.startTime}`);
      const endTime = new Date(startTime);
      
      if (bookingData.rentalType === 'HOURLY') {
        endTime.setHours(endTime.getHours() + bookingData.duration);
      } else {
        endTime.setDate(endTime.getDate() + bookingData.duration);
      }

      const request: QuoteRequest = {
        trailerId: trailer.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        rentalType: bookingData.rentalType,
        additionalServices: {
          pickup: bookingData.pickup
        }
      };

      const response = await quoteApi.calculateQuote(request);
      if (response.success && response.data) {
        setQuote(response.data);
      } else {
        showTelegramAlert(response.error || 'Ошибка расчета стоимости');
      }
    } catch (error) {
      console.error('Error calculating quote:', error);
      showTelegramAlert('Ошибка расчета стоимости');
    } finally {
      setQuoteLoading(false);
    }
  }, [trailer, bookingData.startDate, bookingData.startTime, bookingData.duration, bookingData.rentalType, bookingData.pickup]);

  const handleBooking = useCallback(() => {
    try {
      if (!quote || !quote.pricing) {
        showTelegramAlert('Сначала рассчитайте стоимость');
        return;
      }
      if (!trailer) {
        showTelegramAlert('Ошибка: прицеп не найден');
        return;
      }
      navigate('/booking', { 
        state: { 
          trailer, 
          bookingData, 
          quote 
        } 
      });
    } catch (error) {
      console.error('Error in handleBooking:', error);
      showTelegramAlert('Ошибка при бронировании');
    }
  }, [quote, trailer, bookingData, navigate]);

  const formatDimensions = (dimensions: any) => {
    if (!dimensions) return 'Не указано';
    return `${dimensions.length/1000}м × ${dimensions.width/1000}м × ${dimensions.height/1000}м`;
  };

  const formatWeight = (weight: number) => 
    weight >= 1000 ? `${weight/1000}т` : `${weight}кг`;

  const nextPhoto = () => {
    if (trailer && currentPhotoIndex < trailer.photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  };

  const prevPhoto = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="trailer-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка прицепа...</p>
        </div>
      </div>
    );
  }

  if (error || !trailer) {
    return (
      <div className="trailer-page">
        <div className="error-container">
          <h2>Ошибка загрузки</h2>
          <p>{error || 'Прицеп не найден'}</p>
          <button onClick={() => navigate(-1)} className="back-button">
            Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="trailer-page">
      <div className="photo-gallery">
        <div className="main-photo">
          <img 
            src={trailer.photos[currentPhotoIndex]} 
            alt={trailer.name}
            loading="lazy"
          />
          {trailer.photos.length > 1 && (
            <>
              <button 
                className="photo-nav prev" 
                onClick={prevPhoto}
                disabled={currentPhotoIndex === 0}
              >
                ‹
              </button>
              <button 
                className="photo-nav next" 
                onClick={nextPhoto}
                disabled={currentPhotoIndex === trailer.photos.length - 1}
              >
                ›
              </button>
            </>
          )}
        </div>
        {trailer.photos.length > 1 && (
          <div className="photo-thumbnails">
            {trailer.photos.map((photo, index) => (
              <img
                key={index}
                src={photo}
                alt={`${trailer.name} ${index + 1}`}
                className={`thumbnail ${index === currentPhotoIndex ? 'active' : ''}`}
                onClick={() => setCurrentPhotoIndex(index)}
                loading="lazy"
              />
            ))}
          </div>
        )}
      </div>

      <div className="trailer-info">
        <h1 className="trailer-name">{trailer.name}</h1>
        <p className="trailer-description">{trailer.description}</p>

        <div className="specifications">
          <h3>Характеристики</h3>
          <div className="specs-grid">
            <div className="spec-item">
              <span className="spec-label">Габариты:</span>
              <span className="spec-value">{formatDimensions(trailer.dimensions)}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Грузоподъемность:</span>
              <span className="spec-value">{formatWeight(trailer.capacity)}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Особенности:</span>
              <span className="spec-value">{trailer.features.length > 0 ? trailer.features.join(', ') : 'Нет'}</span>
            </div>
          </div>
        </div>

        <div className="pricing">
          <h3>Цены</h3>
          <div className="pricing-grid">
            <div className="price-item">
              <span className="price-label">Минимум ({trailer.minRentalHours} часа):</span>
              <span className="price-value">{trailer.minRentalPrice}₽</span>
            </div>
            <div className="price-item">
              <span className="price-label">Дополнительный час:</span>
              <span className="price-value">{trailer.extraHourPrice}₽</span>
            </div>
            <div className="price-item">
              <span className="price-label">Сутки:</span>
              <span className="price-value">{trailer.dailyRate}₽</span>
            </div>
            <div className="price-item">
              <span className="price-label">Залог:</span>
              <span className="price-value">{trailer.depositAmount}₽</span>
            </div>
            <div className="price-item">
              <span className="price-label">Забор прицепа:</span>
              <span className="price-value">{trailer.pickupPrice}₽</span>
            </div>
          </div>
        </div>

        {trailer.location && (
          <div className="location">
            <h3>Локация</h3>
            <div className="location-info">
              <h4>{trailer.location.name}</h4>
              <p>{trailer.location.address}</p>
              <p>{trailer.location.city}, {trailer.location.region}</p>
              {trailer.location.description && <p>{trailer.location.description}</p>}
            </div>
          </div>
        )}

        <div className="booking-section">
          <h3>Бронирование</h3>
          {showBookingForm ? (
            <div className="booking-form">
              <div className="form-group">
                <label>Тип аренды:</label>
                <select 
                  value={bookingData.rentalType} 
                  onChange={(e) => setBookingData(prev => ({ ...prev, rentalType: e.target.value as 'HOURLY' | 'DAILY' }))}
                >
                  <option value="HOURLY">Почасовая</option>
                  <option value="DAILY">Посуточная</option>
                </select>
              </div>

              <div className="form-group">
                <label>Дата начала:</label>
                <input 
                  type="date" 
                  value={bookingData.startDate}
                  onChange={(e) => setBookingData(prev => ({ ...prev, startDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group">
                <label>Время начала:</label>
                <input 
                  type="time" 
                  value={bookingData.startTime}
                  onChange={(e) => setBookingData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>
                  {bookingData.rentalType === 'HOURLY' ? 'Продолжительность (часы):' : 'Продолжительность (дни):'}
                </label>
                <input 
                  type="number" 
                  min={bookingData.rentalType === 'HOURLY' ? 2 : 1}
                  value={bookingData.duration}
                  onChange={(e) => {
                    const duration = parseInt(e.target.value) || (bookingData.rentalType === 'HOURLY' ? 2 : 1);
                    setBookingData(prev => ({ ...prev, duration }));
                  }}
                />
              </div>

              <div className="form-group checkbox">
                <label>
                  <input 
                    type="checkbox" 
                    checked={bookingData.pickup}
                    onChange={(e) => setBookingData(prev => ({ ...prev, pickup: e.target.checked }))}
                  />
                  Забор прицепа (+{trailer.pickupPrice}₽)
                </label>
              </div>

              {quote && quote.pricing && quote.pricing.breakdown && (
                <div className="quote-result">
                  <h4>Расчет стоимости:</h4>
                  <div className="quote-breakdown">
                    {quote.pricing.breakdown.rental && (
                      <div className="breakdown-item">
                        <span>{quote.pricing.breakdown.rental}</span>
                      </div>
                    )}
                    {quote.pricing.breakdown.pickup && (
                      <div className="breakdown-item">
                        <span>{quote.pricing.breakdown.pickup}</span>
                      </div>
                    )}
                    {quote.pricing.breakdown.deposit && (
                      <div className="breakdown-item">
                        <span>{quote.pricing.breakdown.deposit}</span>
                      </div>
                    )}
                    <div className="breakdown-total">
                      <span>Итого к оплате: {(quote.pricing.baseCost + quote.pricing.additionalCost) || 0}₽</span>
                    </div>
                  </div>
                </div>
              )}

              {quoteLoading && (
                <div className="quote-loading">
                  <div className="loading-spinner small"></div>
                  <span>Расчет стоимости...</span>
                </div>
              )}

              <div className="form-actions">
                <button
                  className="cancel-button"
                  onClick={() => setShowBookingForm(false)}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="booking-buttons">
              <button 
                className="booking-button hourly"
                onClick={() => setShowBookingForm(true)}
              >
                Почасовая аренда
              </button>
              <button 
                className="booking-button daily"
                onClick={() => {
                  setBookingData(prev => ({ ...prev, rentalType: 'DAILY' }));
                  setShowBookingForm(true);
                }}
              >
                Посуточная аренда
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrailerPage;
