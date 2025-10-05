import React, { useState, useEffect } from 'react';
import QRGenerator from '../components/QRGenerator';
import './LocationsPage.css';

interface Location {
  id: string;
  name: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  workingHours: {
    open: string;
    close: string;
  };
  phone: string;
  description: string;
  qrCode: string;
}

const mockLocations: Location[] = [
  {
    id: 'loc_1',
    name: 'Автопарк "Северный"',
    address: 'ул. Северная, 15, Москва',
    coordinates: { lat: 55.7558, lng: 37.6176 },
    workingHours: { open: '08:00', close: '20:00' },
    phone: '+7 (495) 123-45-67',
    description: 'Основной автопарк в северной части города',
    qrCode: 'qr_location_1'
  },
  {
    id: 'loc_2',
    name: 'Автопарк "Южный"',
    address: 'ул. Южная, 42, Москва',
    coordinates: { lat: 55.7558, lng: 37.6176 },
    workingHours: { open: '09:00', close: '21:00' },
    phone: '+7 (495) 765-43-21',
    description: 'Автопарк в южной части города с расширенными услугами',
    qrCode: 'qr_location_2'
  }
];

const LocationsPage: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [qrGenerator, setQrGenerator] = useState<{ type: 'LOCATION'; id: string; name: string } | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLocations(mockLocations);
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

  const handleDeleteLocation = (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить эту локацию?')) {
      setLocations(locations.filter(l => l.id !== id));
      alert(`Локация ${id} удалена (mock)`);
    }
  };

  const handleSaveLocation = (locationData: Partial<Location>) => {
    if (editingLocation) {
      setLocations(locations.map(l => (l.id === editingLocation.id ? { ...l, ...locationData } : l)));
    } else {
      const newLocation: Location = {
        id: `loc_${Date.now()}`,
        name: locationData.name || '',
        address: locationData.address || '',
        coordinates: locationData.coordinates || { lat: 0, lng: 0 },
        workingHours: locationData.workingHours || { open: '08:00', close: '20:00' },
        phone: locationData.phone || '',
        description: locationData.description || '',
        qrCode: `qr_location_${Date.now()}`
      };
      setLocations([...locations, newLocation]);
    }
    setShowAddForm(false);
    alert(`Локация ${locationData.name} сохранена (mock)`);
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
              <p className="location-hours">🕒 {location.workingHours.open} - {location.workingHours.close}</p>
              <p className="location-phone">📞 {location.phone}</p>
              <p className="location-description">{location.description}</p>
              <div className="location-coordinates">
                <span>Координаты: {location.coordinates.lat.toFixed(6)}, {location.coordinates.lng.toFixed(6)}</span>
              </div>
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
                  phone: formData.get('phone') as string,
                  description: formData.get('description') as string,
                  workingHours: {
                    open: formData.get('openTime') as string,
                    close: formData.get('closeTime') as string
                  },
                  coordinates: {
                    lat: parseFloat(formData.get('lat') as string),
                    lng: parseFloat(formData.get('lng') as string)
                  }
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
                  <label>Телефон:</label>
                  <input 
                    type="tel" 
                    name="phone" 
                    defaultValue={editingLocation?.phone || ''} 
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
                    <label>Время открытия:</label>
                    <input 
                      type="time" 
                      name="openTime" 
                      defaultValue={editingLocation?.workingHours.open || '08:00'} 
                      required 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Время закрытия:</label>
                    <input 
                      type="time" 
                      name="closeTime" 
                      defaultValue={editingLocation?.workingHours.close || '20:00'} 
                      required 
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Широта:</label>
                    <input 
                      type="number" 
                      name="lat" 
                      step="0.000001"
                      defaultValue={editingLocation?.coordinates.lat || 0} 
                      required 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Долгота:</label>
                    <input 
                      type="number" 
                      name="lng" 
                      step="0.000001"
                      defaultValue={editingLocation?.coordinates.lng || 0} 
                      required 
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
          id={qrGenerator.id}
          name={qrGenerator.name}
          onClose={() => setQrGenerator(null)}
        />
      )}
    </div>
  );
};

export default LocationsPage;
