import React, { useState } from 'react';
import './PhotoComparisonViewer.css';

interface PhotoComparison {
  id: string;
  bookingId: string;
  side: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT';
  beforePhoto: {
    id: string;
    filename: string;
    url: string;
    uploadedAt: Date;
  };
  afterPhoto: {
    id: string;
    filename: string;
    url: string;
    uploadedAt: Date;
  };
  comparison: {
    hasDamage: boolean;
    damageLevel: 'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE';
    damageDescription: string[];
    confidence: number;
    differences: Array<{
      type: 'SCRATCH' | 'DENT' | 'STAIN' | 'MISSING_PART' | 'OTHER';
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      description: string;
      location: string;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface PhotoComparisonViewerProps {
  comparison: PhotoComparison;
  onClose: () => void;
  onUpdate?: (comparisonId: string, updates: any) => void;
}

const PhotoComparisonViewer: React.FC<PhotoComparisonViewerProps> = ({ 
  comparison, 
  onClose, 
  onUpdate 
}) => {
  const [activeTab, setActiveTab] = useState<'before' | 'after' | 'side-by-side'>('side-by-side');
  const [isUpdating, setIsUpdating] = useState(false);

  const getDamageLevelColor = (level: string) => {
    switch (level) {
      case 'NONE':
        return '#4CAF50';
      case 'MINOR':
        return '#FF9800';
      case 'MODERATE':
        return '#FF5722';
      case 'SEVERE':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getDamageLevelText = (level: string) => {
    switch (level) {
      case 'NONE':
        return 'Повреждений не обнаружено';
      case 'MINOR':
        return 'Незначительные повреждения';
      case 'MODERATE':
        return 'Умеренные повреждения';
      case 'SEVERE':
        return 'Серьезные повреждения';
      default:
        return 'Неизвестно';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return '#4CAF50';
      case 'MEDIUM':
        return '#FF9800';
      case 'HIGH':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return 'Низкая';
      case 'MEDIUM':
        return 'Средняя';
      case 'HIGH':
        return 'Высокая';
      default:
        return 'Неизвестно';
    }
  };

  const getSideText = (side: string) => {
    switch (side) {
      case 'FRONT':
        return 'Передняя часть';
      case 'REAR':
        return 'Задняя часть';
      case 'LEFT':
        return 'Левая сторона';
      case 'RIGHT':
        return 'Правая сторона';
      default:
        return side;
    }
  };

  const handleUpdateComparison = async (updates: any) => {
    if (!onUpdate) return;
    
    setIsUpdating(true);
    try {
      await onUpdate(comparison.id, updates);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="photo-comparison-overlay">
      <div className="photo-comparison-modal">
        <div className="comparison-header">
          <h3>Сравнение фото - {getSideText(comparison.side)}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="comparison-content">
          {/* Tab Navigation */}
          <div className="tab-navigation">
            <button 
              className={`tab-button ${activeTab === 'side-by-side' ? 'active' : ''}`}
              onClick={() => setActiveTab('side-by-side')}
            >
              Сравнение
            </button>
            <button 
              className={`tab-button ${activeTab === 'before' ? 'active' : ''}`}
              onClick={() => setActiveTab('before')}
            >
              До аренды
            </button>
            <button 
              className={`tab-button ${activeTab === 'after' ? 'active' : ''}`}
              onClick={() => setActiveTab('after')}
            >
              После аренды
            </button>
          </div>

          {/* Photo Display */}
          <div className="photo-display">
            {activeTab === 'side-by-side' && (
              <div className="side-by-side-view">
                <div className="photo-container">
                  <h4>До аренды</h4>
                  <img src={comparison.beforePhoto.url} alt="Before" />
                  <p className="photo-info">
                    Загружено: {new Date(comparison.beforePhoto.uploadedAt).toLocaleString('ru-RU')}
                  </p>
                </div>
                <div className="photo-container">
                  <h4>После аренды</h4>
                  <img src={comparison.afterPhoto.url} alt="After" />
                  <p className="photo-info">
                    Загружено: {new Date(comparison.afterPhoto.uploadedAt).toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'before' && (
              <div className="single-photo-view">
                <img src={comparison.beforePhoto.url} alt="Before" />
                <p className="photo-info">
                  Загружено: {new Date(comparison.beforePhoto.uploadedAt).toLocaleString('ru-RU')}
                </p>
              </div>
            )}

            {activeTab === 'after' && (
              <div className="single-photo-view">
                <img src={comparison.afterPhoto.url} alt="After" />
                <p className="photo-info">
                  Загружено: {new Date(comparison.afterPhoto.uploadedAt).toLocaleString('ru-RU')}
                </p>
              </div>
            )}
          </div>

          {/* Analysis Results */}
          <div className="analysis-results">
            <div className="analysis-header">
              <h4>Результаты анализа</h4>
              <div className="confidence-score">
                Уверенность: {Math.round(comparison.comparison.confidence * 100)}%
              </div>
            </div>

            <div className="damage-summary">
              <div 
                className="damage-level"
                style={{ backgroundColor: getDamageLevelColor(comparison.comparison.damageLevel) }}
              >
                {getDamageLevelText(comparison.comparison.damageLevel)}
              </div>
            </div>

            {comparison.comparison.hasDamage && (
              <div className="damage-details">
                <h5>Обнаруженные повреждения:</h5>
                <div className="damage-list">
                  {comparison.comparison.differences.map((difference, index) => (
                    <div key={index} className="damage-item">
                      <div className="damage-type">
                        <span className="damage-icon">
                          {difference.type === 'SCRATCH' ? '🔪' :
                           difference.type === 'DENT' ? '🔨' :
                           difference.type === 'STAIN' ? '💧' :
                           difference.type === 'MISSING_PART' ? '❌' : '⚠️'}
                        </span>
                        <span className="damage-description">{difference.description}</span>
                      </div>
                      <div className="damage-meta">
                        <span 
                          className="severity-badge"
                          style={{ backgroundColor: getSeverityColor(difference.severity) }}
                        >
                          {getSeverityText(difference.severity)}
                        </span>
                        <span className="damage-location">{difference.location}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Review Actions */}
            <div className="manual-review">
              <h5>Ручная проверка</h5>
              <div className="review-actions">
                <button 
                  className="approve-button"
                  onClick={() => handleUpdateComparison({ 
                    hasDamage: false, 
                    damageLevel: 'NONE',
                    damageDescription: [],
                    differences: []
                  })}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Обновление...' : 'Одобрить (нет повреждений)'}
                </button>
                
                <button 
                  className="reject-button"
                  onClick={() => {
                    const damageLevel = prompt('Уровень повреждений (MINOR/MODERATE/SEVERE):');
                    const description = prompt('Описание повреждений:');
                    if (damageLevel && description) {
                      handleUpdateComparison({
                        hasDamage: true,
                        damageLevel,
                        damageDescription: [description],
                        differences: [{
                          type: 'OTHER',
                          severity: damageLevel === 'SEVERE' ? 'HIGH' : damageLevel === 'MODERATE' ? 'MEDIUM' : 'LOW',
                          description,
                          location: 'Не указано'
                        }]
                      });
                    }
                  }}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Обновление...' : 'Отклонить (есть повреждения)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoComparisonViewer;
