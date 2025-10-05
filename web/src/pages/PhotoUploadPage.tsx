import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { showTelegramAlert } from '../telegram';
import './PhotoUploadPage.css';

const PhotoUploadPage: React.FC = () => {
  const { bookingId, type } = useParams<{ bookingId: string; type: string }>();
  const [uploading, setUploading] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    if (fileArray.length !== 4) {
      showTelegramAlert('Пожалуйста, выберите ровно 4 фотографии');
      return;
    }

    uploadPhotos(fileArray);
  };

  const uploadPhotos = async (files: File[]) => {
    if (!bookingId || !type) {
      showTelegramAlert('Ошибка: не указан ID бронирования или тип');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('photos', file);
      });
      formData.append('bookingId', bookingId);
      formData.append('type', type);
      formData.append('sides', 'FRONT,REAR,LEFT,RIGHT');

      const token = localStorage.getItem('authToken');
      if (!token) {
        showTelegramAlert('Ошибка: необходимо авторизоваться');
        return;
      }

      const response = await fetch('http://localhost:8080/api/photos/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setUploadedPhotos(result.data.uploadedPhotos);
        showTelegramAlert('Фотографии успешно загружены!');
      } else {
        showTelegramAlert(`Ошибка: ${result.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      showTelegramAlert('Ошибка при загрузке фотографий');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="photo-upload-page">
      <div className="upload-header">
        <h1>Фотофиксация прицепа</h1>
        <p>Бронирование: {bookingId}</p>
        <p>Тип: {type === 'CHECK_IN' ? 'Получение' : 'Возврат'}</p>
      </div>

      <div className="upload-instructions">
        <h3>Инструкции по съемке:</h3>
        <ul>
          <li><strong>FRONT</strong> - передняя часть прицепа</li>
          <li><strong>REAR</strong> - задняя часть прицепа</li>
          <li><strong>LEFT</strong> - левая сторона прицепа</li>
          <li><strong>RIGHT</strong> - правая сторона прицепа</li>
        </ul>
        <p>Выберите 4 фотографии в правильном порядке!</p>
      </div>

      <div className="upload-section">
        <button 
          className="upload-button"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          {uploading ? 'Загрузка...' : 'Выбрать 4 фотографии'}
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {uploadedPhotos.length > 0 && (
        <div className="uploaded-photos">
          <h3>Загруженные фотографии:</h3>
          <div className="photos-grid">
            {uploadedPhotos.map((photo, index) => (
              <div key={photo.id} className="photo-item">
                <img src={photo.url} alt={photo.side} />
                <p>{photo.side}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="upload-tips">
        <h3>Советы по съемке:</h3>
        <ul>
          <li>Убедитесь в хорошем освещении</li>
          <li>Снимайте с расстояния 2-3 метра</li>
          <li>Вся прицеп должен быть в кадре</li>
          <li>Проверьте качество фото перед загрузкой</li>
        </ul>
      </div>
    </div>
  );
};

export default PhotoUploadPage;
