import React, { useState, useEffect } from 'react';
import PhotoComparisonViewer from '../components/PhotoComparisonViewer';
import './PhotoComparisonsPage.css';

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

const mockComparisons: PhotoComparison[] = [];

const PhotoComparisonsPage: React.FC = () => {
  const [comparisons, setComparisons] = useState<PhotoComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'DAMAGE' | 'NO_DAMAGE'>('ALL');
  const [selectedComparison, setSelectedComparison] = useState<PhotoComparison | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  useEffect(() => {
    loadComparisons();
  }, []);

  const loadComparisons = async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setComparisons(mockComparisons);
    } catch (error) {
      console.error('Error loading comparisons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewComparison = (comparison: PhotoComparison) => {
    setSelectedComparison(comparison);
    setShowViewer(true);
  };

  const handleUpdateComparison = async (comparisonId: string, updates: any) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setComparisons(comparisons.map(comp => 
      comp.id === comparisonId 
        ? { ...comp, comparison: { ...comp.comparison, ...updates }, updatedAt: new Date() }
        : comp
    ));
    
    alert('Сравнение обновлено (mock)');
  };

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
        return 'Нет повреждений';
      case 'MINOR':
        return 'Незначительные';
      case 'MODERATE':
        return 'Умеренные';
      case 'SEVERE':
        return 'Серьезные';
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

  const filteredComparisons = comparisons.filter(comparison => {
    if (filter === 'ALL') return true;
    if (filter === 'DAMAGE') return comparison.comparison.hasDamage;
    if (filter === 'NO_DAMAGE') return !comparison.comparison.hasDamage;
    return true;
  });

  if (loading) {
    return <div className="admin-photo-comparisons-page loading">Загрузка сравнений...</div>;
  }

  return (
    <div className="admin-photo-comparisons-page">
      <div className="page-header">
        <h2>Сравнение фото до/после аренды</h2>
        <div className="filter-controls">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="ALL">Все сравнения</option>
            <option value="DAMAGE">С повреждениями</option>
            <option value="NO_DAMAGE">Без повреждений</option>
          </select>
        </div>
      </div>

      <div className="comparisons-stats">
        <div className="stat-card">
          <h3>Всего сравнений</h3>
          <span className="stat-number">{comparisons.length}</span>
        </div>
        <div className="stat-card">
          <h3>С повреждениями</h3>
          <span className="stat-number">{comparisons.filter(c => c.comparison.hasDamage).length}</span>
        </div>
        <div className="stat-card">
          <h3>Без повреждений</h3>
          <span className="stat-number">{comparisons.filter(c => !c.comparison.hasDamage).length}</span>
        </div>
        <div className="stat-card">
          <h3>Средняя уверенность</h3>
          <span className="stat-number">
            {comparisons.length > 0 
              ? Math.round(comparisons.reduce((sum, c) => sum + c.comparison.confidence, 0) / comparisons.length * 100)
              : 0}%
          </span>
        </div>
      </div>

      <div className="comparisons-list">
        {filteredComparisons.map(comparison => (
          <div key={comparison.id} className="comparison-item">
            <div className="comparison-info">
              <div className="comparison-header">
                <h3>Бронирование #{comparison.bookingId}</h3>
                <span className="side-badge">{getSideText(comparison.side)}</span>
              </div>
              
              <div className="comparison-details">
                <div className="detail-row">
                  <span className="label">Уровень повреждений:</span>
                  <span 
                    className="damage-level"
                    style={{ backgroundColor: getDamageLevelColor(comparison.comparison.damageLevel) }}
                  >
                    {getDamageLevelText(comparison.comparison.damageLevel)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Уверенность:</span>
                  <span className="confidence">{Math.round(comparison.comparison.confidence * 100)}%</span>
                </div>
                <div className="detail-row">
                  <span className="label">Количество повреждений:</span>
                  <span className="damage-count">{comparison.comparison.differences.length}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Создано:</span>
                  <span className="created-at">{comparison.createdAt.toLocaleString('ru-RU')}</span>
                </div>
              </div>

              {comparison.comparison.hasDamage && (
                <div className="damage-summary">
                  <h4>Обнаруженные повреждения:</h4>
                  <ul>
                    {comparison.comparison.damageDescription.map((desc, index) => (
                      <li key={index}>{desc}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="comparison-actions">
              <button 
                className="view-button"
                onClick={() => handleViewComparison(comparison)}
              >
                Просмотреть
              </button>
            </div>
          </div>
        ))}
      </div>

      {showViewer && selectedComparison && (
        <PhotoComparisonViewer
          comparison={selectedComparison}
          onClose={() => {
            setShowViewer(false);
            setSelectedComparison(null);
          }}
          onUpdate={handleUpdateComparison}
        />
      )}
    </div>
  );
};

export default PhotoComparisonsPage;
