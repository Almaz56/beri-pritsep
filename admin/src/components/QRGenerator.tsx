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
      // Mock API call - in real app would call actual API
      const mockUrl = type === 'LOCATION' 
        ? `https://app.beripritsep.ru/?location_id=${id}`
        : `https://app.beripritsep.ru/trailer/${id}`;
      
      setUrl(mockUrl);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate mock QR code (in real app would be actual QR generation)
      const mockQRCode = `data:image/svg+xml;base64,${btoa(`
        <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="300" fill="white"/>
          <text x="150" y="150" text-anchor="middle" font-family="Arial" font-size="12" fill="black">
            QR Code for ${name}
          </text>
          <text x="150" y="170" text-anchor="middle" font-family="Arial" font-size="10" fill="gray">
            ${type} - ${id}
          </text>
        </svg>
      `)}`;

      setQrCode(mockQRCode);
    } catch (err) {
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
