import React, { useState } from 'react';
import { showTelegramAlert } from '../telegram';

interface PhoneRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhoneSubmit: (phone: string) => void;
}

const PhoneRequestModal: React.FC<PhoneRequestModalProps> = ({
  isOpen,
  onClose,
  onPhoneSubmit
}) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      showTelegramAlert('Пожалуйста, введите номер телефона');
      return;
    }

    // Basic phone validation
    const phoneRegex = /^(\+7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
    if (!phoneRegex.test(phone)) {
      showTelegramAlert('Пожалуйста, введите корректный номер телефона');
      return;
    }

    setLoading(true);
    try {
      await onPhoneSubmit(phone);
      onClose();
    } catch (error) {
      console.error('Phone submission error:', error);
      showTelegramAlert('Ошибка при сохранении номера телефона');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="phone-request-modal-overlay">
      <div className="phone-request-modal">
        <div className="phone-request-header">
          <h3>📱 Номер телефона</h3>
          <p>Для завершения регистрации укажите ваш номер телефона</p>
        </div>
        
        <form onSubmit={handleSubmit} className="phone-request-form">
          <div className="phone-input-group">
            <label htmlFor="phone">Номер телефона</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 (999) 123-45-67"
              className="phone-input"
              disabled={loading}
              required
            />
          </div>
          
          <div className="phone-request-actions">
            <button
              type="submit"
              className="btn-primary phone-submit-btn"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить номер'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PhoneRequestModal;
