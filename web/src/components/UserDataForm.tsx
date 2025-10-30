import React, { useState } from 'react';
import { showTelegramAlert } from '../telegram';

interface UserDataFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserData) => void;
}

interface UserData {
  firstName: string;
  lastName: string;
  middleName?: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssuedDate: string;
  birthDate: string;
  birthPlace: string;
}

const UserDataForm: React.FC<UserDataFormProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<UserData>({
    firstName: '',
    lastName: '',
    middleName: '',
    passportSeries: '',
    passportNumber: '',
    passportIssuedBy: '',
    passportIssuedDate: '',
    birthDate: '',
    birthPlace: ''
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: keyof UserData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim()) {
      showTelegramAlert('Пожалуйста, введите имя');
      return false;
    }
    if (!formData.lastName.trim()) {
      showTelegramAlert('Пожалуйста, введите фамилию');
      return false;
    }
    if (!formData.passportSeries.trim()) {
      showTelegramAlert('Пожалуйста, введите серию паспорта');
      return false;
    }
    if (!formData.passportNumber.trim()) {
      showTelegramAlert('Пожалуйста, введите номер паспорта');
      return false;
    }
    if (!formData.passportIssuedBy.trim()) {
      showTelegramAlert('Пожалуйста, введите кем выдан паспорт');
      return false;
    }
    if (!formData.passportIssuedDate) {
      showTelegramAlert('Пожалуйста, введите дату выдачи паспорта');
      return false;
    }
    if (!formData.birthDate) {
      showTelegramAlert('Пожалуйста, введите дату рождения');
      return false;
    }
    if (!formData.birthPlace.trim()) {
      showTelegramAlert('Пожалуйста, введите место рождения');
      return false;
    }

    // Validate passport series format (4 digits)
    if (!/^\d{4}$/.test(formData.passportSeries)) {
      showTelegramAlert('Серия паспорта должна содержать 4 цифры');
      return false;
    }

    // Validate passport number format (6 digits)
    if (!/^\d{6}$/.test(formData.passportNumber)) {
      showTelegramAlert('Номер паспорта должен содержать 6 цифр');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('User data submission error:', error);
      showTelegramAlert('Ошибка при сохранении данных');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="user-data-modal-overlay">
      <div className="user-data-modal">
        <div className="user-data-header">
          <h3>📋 Личные данные</h3>
          <p>Заполните ваши паспортные данные для завершения регистрации</p>
        </div>
        
        <form onSubmit={handleSubmit} className="user-data-form">
          <div className="form-section">
            <h4>ФИО</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="lastName">Фамилия *</label>
                <input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Иванов"
                  className="form-input"
                  disabled={loading}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="firstName">Имя *</label>
                <input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="Иван"
                  className="form-input"
                  disabled={loading}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="middleName">Отчество</label>
              <input
                id="middleName"
                type="text"
                value={formData.middleName}
                onChange={(e) => handleInputChange('middleName', e.target.value)}
                placeholder="Иванович"
                className="form-input"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-section">
            <h4>Паспортные данные</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="passportSeries">Серия *</label>
                <input
                  id="passportSeries"
                  type="text"
                  value={formData.passportSeries}
                  onChange={(e) => handleInputChange('passportSeries', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  className="form-input"
                  disabled={loading}
                  maxLength={4}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="passportNumber">Номер *</label>
                <input
                  id="passportNumber"
                  type="text"
                  value={formData.passportNumber}
                  onChange={(e) => handleInputChange('passportNumber', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="567890"
                  className="form-input"
                  disabled={loading}
                  maxLength={6}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="passportIssuedBy">Кем выдан *</label>
              <input
                id="passportIssuedBy"
                type="text"
                value={formData.passportIssuedBy}
                onChange={(e) => handleInputChange('passportIssuedBy', e.target.value)}
                placeholder="ОУФМС России по г. Москве"
                className="form-input"
                disabled={loading}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="passportIssuedDate">Дата выдачи *</label>
              <input
                id="passportIssuedDate"
                type="date"
                value={formData.passportIssuedDate}
                onChange={(e) => handleInputChange('passportIssuedDate', e.target.value)}
                className="form-input"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-section">
            <h4>Дополнительная информация</h4>
            <div className="form-group">
              <label htmlFor="birthDate">Дата рождения *</label>
              <input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => handleInputChange('birthDate', e.target.value)}
                className="form-input"
                disabled={loading}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="birthPlace">Место рождения *</label>
              <input
                id="birthPlace"
                type="text"
                value={formData.birthPlace}
                onChange={(e) => handleInputChange('birthPlace', e.target.value)}
                placeholder="г. Москва"
                className="form-input"
                disabled={loading}
                required
              />
            </div>
          </div>
          
          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary form-submit-btn"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить данные'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserDataForm;
