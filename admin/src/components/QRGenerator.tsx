import React, { useState } from 'react';
import './QRGenerator.css';

interface QRGeneratorProps {
  type: 'LOCATION' | 'TRAILER';
  id: string;
  name: string;
  onClose: () => void;
}

const QRGenerator: React.FC<QRGeneratorProps> = ({ type, id, name, onClose }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string>('');

  const generateQR = async () => {
    setLoading(true);
    setError(null);

    try {
      // Call real API - always use direct server URL in development
      const API_BASE_URL = window.location.hostname === 'admin.beripritsep.ru' 
        ? 'https://api.beripritsep.ru/api' 
        : 'http://localhost:8080/api';
      
      const endpoint = type === 'LOCATION' 
        ? `${API_BASE_URL}/qr/location/${id}`
        : `${API_BASE_URL}/qr/trailer/${id}`;
      
      console.log('QR API endpoint:', endpoint);
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      console.log('QR API response:', data);

      if (data.success && data.data) {
        setQrCode(data.data.qrCode);
        setUrl(data.data.url);
      } else {
        setError(data.error || 'Ошибка генерации QR-кода');
      }
    } catch (err) {
      console.error('QR generation error:', err);
      setError('Ошибка генерации QR-кода');
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!qrCode) return;

    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `qr-${type.toLowerCase()}-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(url);
    alert('URL скопирован в буфер обмена');
  };

  return (
    <div className="qr-generator-overlay">
      <div className="qr-generator-modal">
        <div className="qr-generator-header">
          <h3>Генерация QR-кода</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="qr-generator-content">
          <div className="qr-info">
            <h4>{type === 'LOCATION' ? 'Локация' : 'Прицеп'}: {name}</h4>
            <p>ID: {id}</p>
          </div>

          {!qrCode && !loading && (
            <div className="qr-generate-section">
              <p>Нажмите кнопку для генерации QR-кода</p>
              <button className="generate-button" onClick={generateQR}>
                Сгенерировать QR-код
              </button>
            </div>
          )}

          {loading && (
            <div className="qr-loading">
              <div className="loading-spinner"></div>
              <p>Генерация QR-кода...</p>
            </div>
          )}

          {error && (
            <div className="qr-error">
              <p>{error}</p>
              <button className="retry-button" onClick={generateQR}>
                Попробовать снова
              </button>
            </div>
          )}

          {qrCode && (
            <div className="qr-result">
              <div className="qr-code-display">
                <img src={qrCode} alt="QR Code" className="qr-image" />
              </div>
              
              <div className="qr-url">
                <label>URL:</label>
                <div className="url-container">
                  <input 
                    type="text" 
                    value={url} 
                    readOnly 
                    className="url-input"
                  />
                  <button className="copy-button" onClick={copyUrl}>
                    Копировать
                  </button>
                </div>
              </div>

              <div className="qr-actions">
                <button className="download-button" onClick={downloadQR}>
                  Скачать QR-код
                </button>
                <button className="regenerate-button" onClick={generateQR}>
                  Сгенерировать заново
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRGenerator;
