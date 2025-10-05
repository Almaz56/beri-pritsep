import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trailersApi, quoteApi, type Trailer, type QuoteRequest } from '../api';
import { showTelegramAlert, setupTelegramMainButton, hideTelegramMainButton } from '../telegram';
import './TrailerPage.css';

const TrailerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
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

  // Safe state setter
  const safeSetBookingData = useCallback((updater: (prev: typeof bookingData) => typeof bookingData) => {
    try {
      setBookingData(updater);
    } catch (error) {
      console.error('Error updating booking data:', error);
    }
  }, []);
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadTrailer();
    }
  }, [id]);

  useEffect(() => {
    if (showBookingForm) {
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
  }, [showBookingForm, bookingData]);

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
    } catch (err) {
      console.error('Error loading trailer:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const calculateQuote = useCallback(async () => {
    if (!trailer || !bookingData.startDate || !bookingData.startTime || bookingData.duration <= 0) {
      console.log('Missing data for quote calculation:', { trailer: !!trailer, startDate: bookingData.startDate, startTime: bookingData.startTime, duration: bookingData.duration });
      return;
    }

    try {
      setQuoteLoading(true);
      
      const startDateTime = new Date(`${bookingData.startDate}T${bookingData.startTime}`);
      const endDateTime = new Date(startDateTime);
      
      if (bookingData.rentalType === 'HOURLY') {
        endDateTime.setHours(endDateTime.getHours() + bookingData.duration);
      } else {
        endDateTime.setDate(endDateTime.getDate() + bookingData.duration);
      }

      const request: QuoteRequest = {
        trailerId: trailer.id,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        rentalType: bookingData.rentalType,
        additionalServices: {
          pickup: bookingData.pickup
        }
      };

      console.log('Calculating quote with request:', request);

      const response = await quoteApi.calculateQuote(request);
      
      if (response.success && response.data) {
        console.log('Full response data:', response.data);
        console.log('Pricing structure:', response.data.pricing);
        
        // Validate response structure
        if (response.data.pricing && response.data.pricing.breakdown) {
          setQuote(response.data);
          console.log('Quote calculated successfully:', response.data);
        } else {
          console.error('Invalid quote response structure:', response.data);
          console.error('Expected pricing.breakdown, got:', response.data.pricing);
          showTelegramAlert('Некорректный ответ от сервера');
        }
      } else {
        console.error('Quote calculation failed:', response.error);
        showTelegramAlert(response.error || 'Ошибка расчета стоимости');
      }
    } catch (err) {
      console.error('Error calculating quote:', err);
      showTelegramAlert('Ошибка расчета стоимости');
    } finally {
      setQuoteLoading(false);
    }
  }, [trailer, bookingData.startDate, bookingData.startTime, bookingData.duration, bookingData.rentalType, bookingData.pickup]);

  useEffect(() => {
    if (bookingData.startDate && bookingData.startTime && bookingData.duration > 0) {
      calculateQuote();
    }
  }, [calculateQuote]);

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
      
      // Navigate to booking confirmation or payment
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

  const formatDimensions = (dimensions: Trailer['dimensions']) => {
    return `${dimensions.length / 1000}м × ${dimensions.width / 1000}м × ${dimensions.height / 1000}м`;
  };

  const formatWeight = (weight: number) => {
    return weight >= 1000 ? `${weight / 1000}т` : `${weight}кг`;
  };

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
      {/* Photo Gallery */}
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

      {/* Trailer Info */}
      <div className="trailer-info">
        <h1 className="trailer-name">{trailer.name}</h1>
        <p className="trailer-description">{trailer.description}</p>

        {/* Specifications */}
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
              <span className="spec-label">Тент:</span>
              <span className="spec-value">
                {trailer.hasTent ? '✅ Есть' : '❌ Нет'}
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Оси:</span>
              <span className="spec-value">{trailer.axles}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Тормоз:</span>
              <span className="spec-value">{trailer.brakeType}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Масса:</span>
              <span className="spec-value">{formatWeight(trailer.weight)}</span>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="pricing">
          <h3>Цены</h3>
          <div className="pricing-grid">
            <div className="price-item">
              <span className="price-label">Минимум (2 часа):</span>
              <span className="price-value">{trailer.pricing.minCost}₽</span>
            </div>
            <div className="price-item">
              <span className="price-label">Дополнительный час:</span>
              <span className="price-value">{trailer.pricing.hourPrice}₽</span>
            </div>
            <div className="price-item">
              <span className="price-label">Сутки:</span>
              <span className="price-value">{trailer.pricing.dayPrice}₽</span>
            </div>
            <div className="price-item">
              <span className="price-label">Залог:</span>
              <span className="price-value">{trailer.pricing.deposit}₽</span>
            </div>
            <div className="price-item">
              <span className="price-label">Забор прицепа:</span>
              <span className="price-value">{trailer.pricing.pickupPrice}₽</span>
            </div>
          </div>
        </div>

        {/* Location */}
        {trailer.location && (
          <div className="location">
            <h3>Локация</h3>
            <div className="location-info">
              <h4>{trailer.location.name}</h4>
              <p>{trailer.location.address}</p>
              <p>Телефон: {trailer.location.phone}</p>
              <p>Часы работы: {trailer.location.workingHours.open} - {trailer.location.workingHours.close}</p>
            </div>
          </div>
        )}

        {/* Booking Form */}
        <div className="booking-section">
          <h3>Бронирование</h3>
          
          {!showBookingForm ? (
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
                  safeSetBookingData(prev => ({ ...prev, rentalType: 'DAILY' }));
                  setShowBookingForm(true);
                }}
              >
                Посуточная аренда
              </button>
            </div>
          ) : (
            <div className="booking-form">
              <div className="form-group">
                <label>Тип аренды:</label>
                <select
                  value={bookingData.rentalType}
                  onChange={(e) => safeSetBookingData(prev => ({ 
                    ...prev, 
                    rentalType: e.target.value as 'HOURLY' | 'DAILY' 
                  }))}
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
                  onChange={(e) => {
                    safeSetBookingData(prev => ({ ...prev, startDate: e.target.value }));
                  }}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group">
                <label>Время начала:</label>
                <input
                  type="time"
                  value={bookingData.startTime}
                  onChange={(e) => {
                    safeSetBookingData(prev => ({ ...prev, startTime: e.target.value }));
                  }}
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
                    const value = parseInt(e.target.value) || (bookingData.rentalType === 'HOURLY' ? 2 : 1);
                    safeSetBookingData(prev => ({ ...prev, duration: value }));
                  }}
                />
              </div>

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={bookingData.pickup}
                    onChange={(e) => safeSetBookingData(prev => ({ ...prev, pickup: e.target.checked }))}
                  />
                  Забор прицепа (+{trailer.pricing.pickupPrice}₽)
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
                      <span>Итого к оплате: {quote.pricing.total || 0}₽</span>
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
                <button 
                  className="book-button"
                  onClick={handleBooking}
                  disabled={!quote || !quote.pricing || quoteLoading}
                >
                  Забронировать
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrailerPage;
