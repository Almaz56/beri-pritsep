import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentsApi, getAuthToken, authApi } from '../api';
import { showTelegramAlert, setupTelegramMainButton, hideTelegramMainButton } from '../telegram';
import './DocumentUploadPage.css';

type DocumentType = 'PASSPORT' | 'DRIVER_LICENSE';

const DocumentUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType>('PASSPORT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // refresh token from unified storage in case it was set after auth
    const currentToken = getAuthToken();
    if (currentToken !== token) {
      setToken(currentToken);
    }

    if (!token) {
      showTelegramAlert('Вы не авторизованы. Пожалуйста, войдите в аккаунт.');
      navigate('/profile');
      return;
    }

    // Fetch current user profile to get real userId
    (async () => {
      try {
        const profile = await authApi.getProfile(token);
        if (profile.success && profile.data) {
          setUserId(profile.data.id);
        } else {
          showTelegramAlert('Не удалось получить профиль пользователя. Пожалуйста, войдите заново.');
          navigate('/profile');
        }
      } catch {
        showTelegramAlert('Ошибка при получении профиля. Пожалуйста, войдите заново.');
        navigate('/profile');
      }
    })();

    // Get user ID from token (in real app, would decode JWT)
    // For now, we'll use a mock user ID
    setUserId('user_dev_1');

    setupTelegramMainButton('Загрузить документ', handleUploadDocument, { 
      isActive: selectedFile !== null && !loading 
    });

    return () => {
      hideTelegramMainButton();
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [token, selectedFile, loading, navigate]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setOcrPreview(null);
    
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreview(null);
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Поддерживаются только файлы JPG, PNG и WebP');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Размер файла не должен превышать 10MB');
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const newPreview = URL.createObjectURL(file);
    setPreview(newPreview);
  }, []);

  const handleUploadDocument = useCallback(async () => {
    if (!selectedFile || !userId || !token) {
      setError('Пожалуйста, выберите файл и убедитесь, что вы авторизованы');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('documentType', selectedDocumentType);

      const response = await documentsApi.uploadDocument(formData, token);

      if (response.success && response.data) {
        showTelegramAlert('Документ успешно загружен! Ожидает модерации.');
        
        // Show OCR preview if available
        if (response.data.ocrPreview?.success) {
          setOcrPreview(response.data.ocrPreview.text);
        }
        
        // Navigate back to profile after a short delay
        setTimeout(() => {
          navigate('/profile');
        }, 2000);
      } else {
        setError(response.error || 'Ошибка при загрузке документа');
        showTelegramAlert(response.error || 'Ошибка при загрузке документа');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Произошла ошибка при загрузке документа');
      showTelegramAlert('Произошла ошибка при загрузке документа');
    } finally {
      setLoading(false);
    }
  }, [selectedFile, userId, token, selectedDocumentType, navigate]);

  const getDocumentTypeLabel = (type: DocumentType): string => {
    switch (type) {
      case 'PASSPORT':
        return 'Паспорт';
      case 'DRIVER_LICENSE':
        return 'Водительское удостоверение';
      default:
        return 'Документ';
    }
  };

  const getDocumentTypeDescription = (type: DocumentType): string => {
    switch (type) {
      case 'PASSPORT':
        return 'Загрузите фото главной страницы паспорта РФ';
      case 'DRIVER_LICENSE':
        return 'Загрузите фото водительского удостоверения';
      default:
        return 'Загрузите фото документа';
    }
  };

  return (
    <div className="document-upload-page">
      <h2>Загрузка документа</h2>
      
      {error && <div className="error-message">{error}</div>}

      <div className="document-type-selector">
        <h3>Тип документа</h3>
        <div className="type-buttons">
          <button
            className={`type-button ${selectedDocumentType === 'PASSPORT' ? 'active' : ''}`}
            onClick={() => setSelectedDocumentType('PASSPORT')}
          >
            📄 Паспорт
          </button>
          <button
            className={`type-button ${selectedDocumentType === 'DRIVER_LICENSE' ? 'active' : ''}`}
            onClick={() => setSelectedDocumentType('DRIVER_LICENSE')}
          >
            🚗 Водительские права
          </button>
        </div>
      </div>

      <div className="document-info">
        <h3>{getDocumentTypeLabel(selectedDocumentType)}</h3>
        <p>{getDocumentTypeDescription(selectedDocumentType)}</p>
        
        <div className="requirements">
          <h4>Требования к фото:</h4>
          <ul>
            <li>Четкое изображение без размытия</li>
            <li>Хорошее освещение</li>
            <li>Весь документ должен быть виден</li>
            <li>Формат: JPG, PNG или WebP</li>
            <li>Размер: не более 10MB</li>
          </ul>
        </div>
      </div>

      <div className="file-upload-section">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={loading}
          id="document-upload-input"
          style={{ display: 'none' }}
        />
        <label htmlFor="document-upload-input" className="file-upload-label">
          {selectedFile ? 'Выбрать другой файл' : 'Выбрать файл'}
        </label>
      </div>

      {preview && (
        <div className="document-preview">
          <h3>Предварительный просмотр</h3>
          <img src={preview} alt="Document preview" className="preview-image" />
          <p className="file-info">
            Файл: {selectedFile?.name} ({(selectedFile?.size || 0 / 1024 / 1024).toFixed(2)} MB)
          </p>
        </div>
      )}

      {ocrPreview && (
        <div className="ocr-preview">
          <h3>Распознанный текст</h3>
          <div className="ocr-text">
            {ocrPreview}
          </div>
          <p className="ocr-note">
            * Это предварительное распознавание. Точность проверки будет выполнена модератором.
          </p>
        </div>
      )}

      {loading && (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span>Загрузка документа...</span>
        </div>
      )}
    </div>
  );
};

export default DocumentUploadPage;
