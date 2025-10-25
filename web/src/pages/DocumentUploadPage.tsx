import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentsApi, getAuthToken } from '../api';
import { showTelegramAlert } from '../telegram';
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
  // userId не нужен на клиенте, сервер берет его из JWT

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    if (bytes < 0) return 'Invalid size';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    if (i >= sizes.length) return 'Too large';
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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

    return () => {
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

    // Debug file information
    console.log('Selected file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

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

    // Additional validation for suspicious file sizes
    if (file.size === 0) {
      setError('Файл пустой или поврежден');
      return;
    }

    // Check for extremely large files (likely corrupted)
    if (file.size > 100 * 1024 * 1024) { // 100MB
      setError('Файл слишком большой. Максимальный размер: 10MB');
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const newPreview = URL.createObjectURL(file);
    setPreview(newPreview);
  }, []);

  const handleUploadDocument = useCallback(async () => {
    if (!selectedFile || !token) {
      setError('Пожалуйста, выберите файл и убедитесь, что вы авторизованы');
      return;
    }

    // Additional validation before upload
    if (selectedFile.size === 0) {
      setError('Файл пустой или поврежден');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Размер файла не должен превышать 10MB');
      return;
    }

    console.log('Uploading file:', {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      formattedSize: formatFileSize(selectedFile.size)
    });

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
  }, [selectedFile, token, selectedDocumentType, navigate]);

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

      {/* Primary upload button near the top, always visible */}
      {!loading && (
        <div style={{ margin: '8px 0 16px 0' }}>
          <button
            className="upload-button"
            onClick={handleUploadDocument}
            disabled={!selectedFile || !token}
          >
            Загрузить документ
          </button>
        </div>
      )}

      {preview && (
        <div className="document-preview">
          <h3>Предварительный просмотр</h3>
          <img src={preview} alt="Document preview" className="preview-image" />
          <p className="file-info">
            Файл: {selectedFile?.name} ({selectedFile ? formatFileSize(selectedFile.size) : '0.00 MB'})
          </p>
          {/* Inline visible upload button (duplicate of fixed bar) */}
          {!loading && (
            <button
              className="upload-button"
              onClick={handleUploadDocument}
              disabled={!selectedFile || !token}
              style={{ marginTop: 12 }}
            >
              Загрузить документ
            </button>
          )}
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
        <div className="fullscreen-loading">
          <div className="loading-content">
            <div className="modern-spinner"></div>
            <p className="loading-text">Загрузка документа...</p>
            <p className="loading-subtext">Обрабатываем ваш файл</p>
          </div>
        </div>
      )}

      {/* Always-visible fixed bottom bar button */}
      {!loading && (
        <div className="upload-fixed-bar">
          <button
            className="upload-button"
            onClick={handleUploadDocument}
            disabled={!selectedFile || !token}
          >
            Загрузить документ
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentUploadPage;
