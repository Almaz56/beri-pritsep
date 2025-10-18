import React, { useState, useEffect } from 'react';
import { adminApi, locationsApi, Trailer, Location } from '../api';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import './Trailers.css';

const Trailers: React.FC = () => {
  const { token } = useAdminAuth();
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTrailer, setEditingTrailer] = useState<Trailer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadTrailers();
    loadLocations();
  }, [token]);

  const loadTrailers = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await adminApi.getTrailers(token);
      if (response.success) {
        setTrailers(response.data || []);
      } else {
        setError(response.error || 'Ошибка загрузки прицепов');
      }
    } catch (err) {
      setError('Ошибка загрузки прицепов');
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    if (!token) return;
    
    try {
      const response = await locationsApi.getAdminLocations(token);
      if (response.success && response.data) {
        setLocations(response.data);
      }
    } catch (err) {
      console.error('Error loading locations:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm('Вы уверены, что хотите удалить этот прицеп?')) return;
    
    try {
      const response = await adminApi.deleteTrailer(token, id);
      if (response.success) {
        setTrailers(trailers.filter(t => t.id !== id));
      } else {
        setError(response.error || 'Ошибка удаления прицепа');
      }
    } catch (err) {
      setError('Ошибка удаления прицепа');
    }
  };

  const handleEdit = (trailer: Trailer) => {
    setEditingTrailer(trailer);
    setShowForm(true);
  };

  const handleFormSubmit = async (trailerData: Partial<Trailer>): Promise<Trailer | null> => {
    if (!token) return null;
    
    try {
      let response;
      if (editingTrailer) {
        response = await adminApi.updateTrailer(token, editingTrailer.id, trailerData);
      } else {
        response = await adminApi.createTrailer(token, trailerData);
      }
      
      if (response.success) {
        setShowForm(false);
        setEditingTrailer(null);
        loadTrailers();
        return response.data || null; // Возвращаем созданный/обновленный прицеп
      } else {
        setError(response.error || 'Ошибка сохранения прицепа');
        return null;
      }
    } catch (err) {
      setError('Ошибка сохранения прицепа');
      return null;
    }
  };

  const filteredTrailers = trailers.filter(trailer => {
    const matchesSearch = trailer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         trailer.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || trailer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return '#10b981';
      case 'RENTED': return '#f59e0b';
      case 'MAINTENANCE': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'Доступен';
      case 'RENTED': return 'Арендован';
      case 'MAINTENANCE': return 'На обслуживании';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="trailers-container">
        <div className="loading">Загрузка прицепов...</div>
      </div>
    );
  }

  return (
    <div className="trailers-container">
      <div className="trailers-header">
        <h1>Управление прицепами</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(true)}
        >
          + Добавить прицеп
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="trailers-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск прицепов..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Все статусы</option>
          <option value="AVAILABLE">Доступен</option>
          <option value="RENTED">Арендован</option>
          <option value="MAINTENANCE">На обслуживании</option>
        </select>
      </div>

      <div className="trailers-grid">
        {filteredTrailers.map((trailer) => (
          <div key={trailer.id} className="trailer-card">
            <div className="trailer-header">
              <h3>{trailer.name}</h3>
              <span 
                className="status-badge"
                style={{ backgroundColor: getStatusColor(trailer.status) }}
              >
                {getStatusText(trailer.status)}
              </span>
            </div>
            
            <div className="trailer-info">
              <p><strong>Вместимость:</strong> {trailer.capacity} кг</p>
              <p><strong>Цена за сутки:</strong> {trailer.dailyRate} ₽</p>
              <p><strong>Мин. время аренды:</strong> {trailer.minRentalHours} ч</p>
              <p><strong>Цена за мин. время:</strong> {trailer.minRentalPrice} ₽</p>
              <p><strong>Цена за доп. час:</strong> {trailer.extraHourPrice} ₽</p>
              <p><strong>Цена забора:</strong> {trailer.pickupPrice} ₽</p>
              <p><strong>Залог:</strong> {trailer.depositAmount} ₽</p>
              <p><strong>Локация:</strong> {trailer.location?.name || 'Не указана'}</p>
            </div>
            
            <div className="trailer-description">
              <p>{trailer.description}</p>
            </div>
            
            {trailer.features && trailer.features.length > 0 && (
              <div className="trailer-features">
                <strong>Особенности:</strong>
                <ul>
                  {trailer.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="trailer-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => handleEdit(trailer)}
              >
                Редактировать
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => handleDelete(trailer.id)}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTrailers.length === 0 && (
        <div className="empty-state">
          <p>Прицепы не найдены</p>
        </div>
      )}

      {showForm && (
        <TrailerForm
          trailer={editingTrailer}
          locations={locations}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingTrailer(null);
          }}
          token={token || ''}
          onPhotosUploaded={loadTrailers}
        />
      )}
    </div>
  );
};

interface TrailerFormProps {
  trailer?: Trailer | null;
  locations: Location[];
  onSubmit: (data: Partial<Trailer>) => Promise<Trailer | null>;
  onCancel: () => void;
  token: string;
  onPhotosUploaded?: () => void;
}

const TrailerForm: React.FC<TrailerFormProps> = ({ trailer, locations, onSubmit, onCancel, token, onPhotosUploaded }) => {
  const [formData, setFormData] = useState({
    name: trailer?.name || '',
    description: trailer?.description || '',
    capacity: trailer?.capacity || 0,
    dailyRate: trailer?.dailyRate || 0,
    minRentalHours: trailer?.minRentalHours || 1,
    minRentalPrice: trailer?.minRentalPrice || 0,
    extraHourPrice: trailer?.extraHourPrice || 0,
    pickupPrice: trailer?.pickupPrice || 0,
    depositAmount: trailer?.depositAmount || 0,
    locationId: trailer?.locationId || '',
    features: trailer?.features || [],
    status: trailer?.status || 'AVAILABLE'
  });
  
  const [photoUrls, setPhotoUrls] = useState<string[]>(trailer?.photos || []);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Сохраняем файлы для загрузки
    setSelectedFiles(prev => [...prev, ...files]);
    
    // Создаем URL для предварительного просмотра
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      setPhotoUrls(prev => [...prev, url]);
    });
  };

  const removePhoto = async (index: number, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    console.log('Removing photo at index:', index);
    console.log('Current photoUrls:', photoUrls);
    console.log('Trailer photos length:', trailer?.photos?.length || 0);
    
    const newUrls = photoUrls.filter((_, i) => i !== index);
    console.log('New URLs after removal:', newUrls);
    
    // Если это новый файл (еще не загруженный), просто удаляем из локального состояния
    if (index >= (trailer?.photos?.length || 0)) {
      console.log('Removing new file (not yet uploaded)');
      const fileIndex = index - (trailer?.photos?.length || 0);
      setSelectedFiles(prev => prev.filter((_, i) => i !== fileIndex));
      setPhotoUrls(newUrls);
      return;
    }
    
    // Если это существующее фото, обновляем базу данных
    if (trailer && token) {
      console.log('Updating existing photo in database');
      try {
        const response = await adminApi.updateTrailerPhotos(token, trailer.id, newUrls);
        console.log('API response:', response);
        if (response.success) {
          setPhotoUrls(newUrls);
          // Перезагружаем трейлеры для обновления данных
          if (onPhotosUploaded) {
            onPhotosUploaded();
          }
        } else {
          console.error('Failed to remove photo:', response.error);
        }
      } catch (error) {
        console.error('Error removing photo:', error);
      }
    } else {
      console.log('Fallback: updating local state only');
      // Fallback: просто обновляем локальное состояние
      setPhotoUrls(newUrls);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Сначала отправляем данные прицепа без новых фото
    const submitData = {
      ...formData,
      photos: trailer?.photos || [], // Отправляем только существующие фото
      locationId: formData.locationId ? Number(formData.locationId) : undefined
    };
    
    // Вызываем onSubmit для создания/обновления прицепа
    const savedTrailer = await onSubmit(submitData);
    
    // Если есть новые файлы для загрузки, загружаем их
    if (selectedFiles.length > 0 && token && savedTrailer) {
      try {
        const response = await adminApi.uploadTrailerPhotos(token, savedTrailer.id, selectedFiles);
        if (response.success) {
          console.log('Photos uploaded successfully');
          // Очищаем выбранные файлы
          setSelectedFiles([]);
          // Перезагружаем трейлеры для обновления данных
          if (onPhotosUploaded) {
            onPhotosUploaded();
          }
        } else {
          console.error('Failed to upload photos:', response.error);
        }
      } catch (error) {
        console.error('Error uploading photos:', error);
      }
    }
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  const addFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ''] });
  };

  const removeFeature = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index);
    setFormData({ ...formData, features: newFeatures });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>{trailer ? 'Редактировать прицеп' : 'Добавить прицеп'}</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="trailer-form">
          <div className="form-group">
            <label>Название *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Описание *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={3}
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Вместимость (кг) *</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                required
                min="0"
              />
            </div>
            
            <div className="form-group">
              <label>Статус</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' })}
              >
                <option value="AVAILABLE">Доступен</option>
                <option value="RENTED">Арендован</option>
                <option value="MAINTENANCE">На обслуживании</option>
              </select>
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Цена за сутки (₽) *</label>
              <input
                type="number"
                value={formData.dailyRate}
                onChange={(e) => setFormData({ ...formData, dailyRate: parseFloat(e.target.value) })}
                required
                min="0"
                step="0.01"
              />
            </div>
            
            <div className="form-group">
              <label>Мин. время аренды (часы) *</label>
              <input
                type="number"
                value={formData.minRentalHours}
                onChange={(e) => setFormData({ ...formData, minRentalHours: parseInt(e.target.value) })}
                required
                min="1"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Цена за мин. время (₽) *</label>
              <input
                type="number"
                value={formData.minRentalPrice}
                onChange={(e) => setFormData({ ...formData, minRentalPrice: parseFloat(e.target.value) })}
                required
                min="0"
                step="0.01"
              />
            </div>
            
            <div className="form-group">
              <label>Цена за доп. час (₽) *</label>
              <input
                type="number"
                value={formData.extraHourPrice}
                onChange={(e) => setFormData({ ...formData, extraHourPrice: parseFloat(e.target.value) })}
                required
                min="0"
                step="0.01"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Цена забора (₽) *</label>
              <input
                type="number"
                value={formData.pickupPrice}
                onChange={(e) => setFormData({ ...formData, pickupPrice: parseFloat(e.target.value) })}
                required
                min="0"
                step="0.01"
              />
            </div>
            
            <div className="form-group">
              <label>Залог (₽) *</label>
              <input
                type="number"
                value={formData.depositAmount}
                onChange={(e) => setFormData({ ...formData, depositAmount: parseFloat(e.target.value) })}
                required
                min="0"
                step="0.01"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Локация</label>
              <select
                value={formData.locationId}
                onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
              >
                <option value="">Выберите локацию (необязательно)</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} - {location.address}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>Фотографии</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handlePhotoChange}
              className="photo-input"
            />
            {photoUrls.length > 0 && (
              <div className="photo-preview">
                {photoUrls.map((url, index) => (
                  <div key={index} className="photo-item">
                    <img src={url} alt={`Preview ${index + 1}`} />
                    <button type="button" onClick={(e) => removePhoto(index, e)} className="remove-photo">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label>Особенности</label>
            {formData.features.map((feature, index) => (
              <div key={index} className="feature-input">
                <input
                  type="text"
                  value={feature}
                  onChange={(e) => handleFeatureChange(index, e.target.value)}
                  placeholder="Особенность прицепа"
                />
                <button type="button" onClick={() => removeFeature(index)}>×</button>
              </div>
            ))}
            <button type="button" onClick={addFeature} className="add-feature-btn">
              + Добавить особенность
            </button>
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              {trailer ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Trailers;
