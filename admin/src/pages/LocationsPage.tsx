import React, { useState, useEffect } from 'react';
import { locationsApi, Location } from '../api';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import QRGenerator from '../components/QRGenerator';
import './LocationsPage.css';


const LocationsPage: React.FC = () => {
  const { token } = useAdminAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [qrGenerator, setQrGenerator] = useState<{ type: 'LOCATION'; id: number; name: string } | null>(null);

  useEffect(() => {
    if (token) {
      loadLocations();
    }
  }, [token]);

  const loadLocations = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await locationsApi.getAdminLocations(token);
      if (response.success && response.data) {
        setLocations(response.data);
      } else {
        console.error('Error loading locations:', response.error);
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = () => {
    setEditingLocation(null);
    setShowAddForm(true);
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setShowAddForm(true);
  };

  const handleDeleteLocation = async (id: number) => {
    if (!token || !window.confirm('Вы уверены, что хотите удалить эту локацию?')) return;
    
    try {
      const response = await locationsApi.deleteLocation(token, id);
      if (response.success) {
        setLocations(locations.filter(l => l.id !== id));
        alert('Локация удалена успешно');
      } else {
        alert('Ошибка удаления локации: ' + response.error);
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Ошибка удаления локации');
    }
  };

  const handleSaveLocation = async (locationData: Partial<Location>) => {
    if (!token) return;
    
    try {
      let response;
      if (editingLocation) {
        // Update existing location
        response = await locationsApi.updateLocation(token, editingLocation.id, locationData);
      } else {
        // Create new location
        response = await locationsApi.createLocation(token, locationData);
      }
      
      if (response.success && response.data) {
        await loadLocations(); // Reload locations from server
        setShowAddForm(false);
        setEditingLocation(null);
        alert(editingLocation ? 'Локация обновлена успешно' : 'Локация создана успешно');
      } else {
        alert('Ошибка сохранения локации: ' + response.error);
      }
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Ошибка сохранения локации');
    }
  };

  if (loading) {
    return <div className="admin-locations-page loading">Загрузка локаций...</div>;
  }

  return (
    <div className="admin-locations-page">
      <div className="page-header">
        <h2>Управление локациями</h2>
        <button className="add-location-button" onClick={handleAddLocation}>
          Добавить локацию
        </button>
      </div>

      <div className="locations-list">
        {locations.map(location => (
          <div key={location.id} className="location-item">
            <div className="location-info">
              <h3>{location.name}</h3>
              <p className="location-address">📍 {location.address}</p>
              <p className="location-city">🏙️ {location.city}, {location.region}</p>
              {location.description && <p className="location-description">{location.description}</p>}
              {location.latitude && location.longitude && (
                <div className="location-coordinates">
                  <span>Координаты: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
                </div>
              )}
            </div>

            <div className="location-actions">
              <button 
                className="qr-button"
                onClick={() => setQrGenerator({ type: 'LOCATION', id: location.id, name: location.name })}
              >
                QR-код
              </button>
              <button 
                className="edit-button"
                onClick={() => handleEditLocation(location)}
              >
                Редактировать
              </button>
              <button 
                className="delete-button"
                onClick={() => handleDeleteLocation(location.id)}
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
              <h2>{editingLocation ? 'Редактировать локацию' : 'Добавить локацию'}</h2>
              <button 
                className="close-button"
                onClick={() => setShowAddForm(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveLocation({
                  name: formData.get('name') as string,
                  address: formData.get('address') as string,
                  city: formData.get('city') as string,
                  region: formData.get('region') as string,
                  description: formData.get('description') as string,
                  latitude: formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : undefined,
                  longitude: formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : undefined
                });
              }}>
                <div className="form-group">
                  <label>Название:</label>
                  <input 
                    type="text" 
                    name="name" 
                    defaultValue={editingLocation?.name || ''} 
                    required 
                  />
                </div>
                
                <div className="form-group">
                  <label>Адрес:</label>
                  <input 
                    type="text" 
                    name="address" 
                    defaultValue={editingLocation?.address || ''} 
                    required 
                  />
                </div>
                
                <div className="form-group">
                  <label>Город:</label>
                  <input 
                    type="text" 
                    name="city" 
                    defaultValue={editingLocation?.city || ''} 
                    required 
                  />
                </div>
                
                <div className="form-group">
                  <label>Регион:</label>
                  <input 
                    type="text" 
                    name="region" 
                    defaultValue={editingLocation?.region || ''} 
                    required 
                  />
                </div>
                
                <div className="form-group">
                  <label>Описание:</label>
                  <textarea 
                    name="description" 
                    defaultValue={editingLocation?.description || ''} 
                    rows={3}
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Широта (необязательно):</label>
                    <input 
                      type="number" 
                      name="latitude" 
                      step="0.000001"
                      defaultValue={editingLocation?.latitude || ''} 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Долгота (необязательно):</label>
                    <input 
                      type="number" 
                      name="longitude" 
                      step="0.000001"
                      defaultValue={editingLocation?.longitude || ''} 
                    />
                  </div>
                </div>
                
                <div className="modal-actions">
                  <button type="submit" className="save-button">
                    Сохранить
                  </button>
                  <button 
                    type="button" 
                    className="cancel-button"
                    onClick={() => setShowAddForm(false)}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {qrGenerator && (
        <QRGenerator
          type={qrGenerator.type}
          id={qrGenerator.id.toString()}
          name={qrGenerator.name}
          onClose={() => setQrGenerator(null)}
        />
      )}
    </div>
  );
};

export default LocationsPage;
