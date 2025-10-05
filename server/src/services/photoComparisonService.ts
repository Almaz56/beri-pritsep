import logger from '../utils/logger';
import { PhotoUpload, PhotoCheck, photoUploads, photoChecks } from '../data';

interface PhotoComparisonResult {
  id: string;
  bookingId: string;
  side: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT';
  beforePhoto: PhotoUpload;
  afterPhoto: PhotoUpload;
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

interface ComparisonOptions {
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  autoApprove: boolean;
  requireManualReview: boolean;
}

class PhotoComparisonService {
  private comparisons = new Map<string, PhotoComparisonResult>();

  /**
   * Compare photos before and after rental
   */
  async comparePhotos(
    bookingId: string,
    side: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT',
    beforePhotoId: string,
    afterPhotoId: string,
    options: ComparisonOptions = {
      sensitivity: 'MEDIUM',
      autoApprove: false,
      requireManualReview: true
    }
  ): Promise<PhotoComparisonResult> {
    try {
      const beforePhoto = photoUploads.get(beforePhotoId);
      const afterPhoto = photoUploads.get(afterPhotoId);

      if (!beforePhoto || !afterPhoto) {
        throw new Error('One or both photos not found');
      }

      if (beforePhoto.bookingId !== bookingId || afterPhoto.bookingId !== bookingId) {
        throw new Error('Photos do not belong to the specified booking');
      }

      if (beforePhoto.side !== side || afterPhoto.side !== side) {
        throw new Error('Photo sides do not match');
      }

      // Simulate photo comparison analysis
      const comparison = await this.analyzePhotos(beforePhoto, afterPhoto, options);

      const result: PhotoComparisonResult = {
        id: `comparison_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        bookingId,
        side,
        beforePhoto,
        afterPhoto,
        comparison,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.comparisons.set(result.id, result);
      logger.info(`Photo comparison completed for booking ${bookingId}, side ${side}`);

      return result;
    } catch (error) {
      logger.error('Error comparing photos:', error);
      throw error;
    }
  }

  /**
   * Simulate photo analysis (in real app would use AI/ML)
   */
  private async analyzePhotos(
    beforePhoto: PhotoUpload,
    afterPhoto: PhotoUpload,
    options: ComparisonOptions
  ): Promise<PhotoComparisonResult['comparison']> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock analysis based on file names and random factors
    const hasDamage = Math.random() > 0.7; // 30% chance of damage
    const damageLevel = hasDamage ? this.getRandomDamageLevel() : 'NONE';
    const confidence = Math.random() * 0.3 + 0.7; // 70-100% confidence

    const differences: PhotoComparisonResult['comparison']['differences'] = [];

    if (hasDamage) {
      const damageTypes = ['SCRATCH', 'DENT', 'STAIN', 'MISSING_PART', 'OTHER'];
      const numDifferences = Math.floor(Math.random() * 3) + 1; // 1-3 differences

      for (let i = 0; i < numDifferences; i++) {
        const type = damageTypes[Math.floor(Math.random() * damageTypes.length)] as any;
        differences.push({
          type,
          severity: this.getSeverityForDamageLevel(damageLevel),
          description: this.getDamageDescription(type),
          location: this.getRandomLocation()
        });
      }
    }

    return {
      hasDamage,
      damageLevel,
      damageDescription: differences.map(d => d.description),
      confidence,
      differences
    };
  }

  private getRandomDamageLevel(): 'MINOR' | 'MODERATE' | 'SEVERE' {
    const levels = ['MINOR', 'MODERATE', 'SEVERE'];
    const weights = [0.6, 0.3, 0.1]; // 60% minor, 30% moderate, 10% severe
    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < levels.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return levels[i] as any;
      }
    }

    return 'MINOR';
  }

  private getSeverityForDamageLevel(level: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    switch (level) {
      case 'MINOR':
        return 'LOW';
      case 'MODERATE':
        return 'MEDIUM';
      case 'SEVERE':
        return 'HIGH';
      default:
        return 'LOW';
    }
  }

  private getDamageDescription(type: string): string {
    const descriptions = {
      SCRATCH: [
        'Поверхностная царапина на кузове',
        'Царапина от ветки',
        'Мелкие царапины на краске'
      ],
      DENT: [
        'Вмятина на крыле',
        'Вмятина от удара',
        'Деформация кузова'
      ],
      STAIN: [
        'Пятно от грязи',
        'Следы от птичьего помета',
        'Загрязнение поверхности'
      ],
      MISSING_PART: [
        'Отсутствует декоративный элемент',
        'Потеряна накладка',
        'Отсутствует деталь'
      ],
      OTHER: [
        'Повреждение неопределенного типа',
        'Нестандартное повреждение',
        'Другое повреждение'
      ]
    };

    const typeDescriptions = descriptions[type as keyof typeof descriptions] || descriptions.OTHER;
    return typeDescriptions[Math.floor(Math.random() * typeDescriptions.length)];
  }

  private getRandomLocation(): string {
    const locations = [
      'Передний бампер',
      'Задний бампер',
      'Левое крыло',
      'Правое крыло',
      'Левая дверь',
      'Правая дверь',
      'Крыша',
      'Капот',
      'Крышка багажника',
      'Боковая панель'
    ];

    return locations[Math.floor(Math.random() * locations.length)];
  }

  /**
   * Get comparison result by ID
   */
  getComparison(comparisonId: string): PhotoComparisonResult | undefined {
    return this.comparisons.get(comparisonId);
  }

  /**
   * Get all comparisons for a booking
   */
  getBookingComparisons(bookingId: string): PhotoComparisonResult[] {
    return Array.from(this.comparisons.values())
      .filter(comparison => comparison.bookingId === bookingId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Get all comparisons with damage
   */
  getDamageComparisons(): PhotoComparisonResult[] {
    return Array.from(this.comparisons.values())
      .filter(comparison => comparison.comparison.hasDamage)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get comparison statistics
   */
  getComparisonStats(): {
    totalComparisons: number;
    damageFound: number;
    noDamage: number;
    averageConfidence: number;
    damageByLevel: Record<string, number>;
  } {
    const comparisons = Array.from(this.comparisons.values());
    const totalComparisons = comparisons.length;
    const damageFound = comparisons.filter(c => c.comparison.hasDamage).length;
    const noDamage = totalComparisons - damageFound;
    const averageConfidence = comparisons.length > 0 
      ? comparisons.reduce((sum, c) => sum + c.comparison.confidence, 0) / comparisons.length
      : 0;

    const damageByLevel = comparisons
      .filter(c => c.comparison.hasDamage)
      .reduce((acc, c) => {
        const level = c.comparison.damageLevel;
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      totalComparisons,
      damageFound,
      noDamage,
      averageConfidence,
      damageByLevel
    };
  }

  /**
   * Update comparison result (for manual review)
   */
  updateComparison(
    comparisonId: string,
    updates: Partial<PhotoComparisonResult['comparison']>
  ): PhotoComparisonResult | null {
    const comparison = this.comparisons.get(comparisonId);
    if (!comparison) {
      return null;
    }

    comparison.comparison = { ...comparison.comparison, ...updates };
    comparison.updatedAt = new Date();
    this.comparisons.set(comparisonId, comparison);

    logger.info(`Comparison ${comparisonId} updated`);
    return comparison;
  }

  /**
   * Delete comparison
   */
  deleteComparison(comparisonId: string): boolean {
    const deleted = this.comparisons.delete(comparisonId);
    if (deleted) {
      logger.info(`Comparison ${comparisonId} deleted`);
    }
    return deleted;
  }

  /**
   * Auto-compare all photos for a booking
   */
  async autoCompareBooking(bookingId: string): Promise<PhotoComparisonResult[]> {
    try {
      // Get all photo checks for this booking
      const bookingPhotoChecks = Array.from(photoChecks.values())
        .filter(check => check.bookingId === bookingId);

      const results: PhotoComparisonResult[] = [];

      // Group photos by side
      const photosBySide = new Map<string, { before?: PhotoUpload; after?: PhotoUpload }>();

      for (const check of bookingPhotoChecks) {
        if (check.type === 'CHECK_IN') {
          // Process check-in photos
          for (const [side, photo] of Object.entries(check.photos)) {
            if (photo) {
              if (!photosBySide.has(side)) {
                photosBySide.set(side, {});
              }
              photosBySide.get(side)!.before = photo;
            }
          }
        } else if (check.type === 'CHECK_OUT') {
          // Process check-out photos
          for (const [side, photo] of Object.entries(check.photos)) {
            if (photo) {
              if (!photosBySide.has(side)) {
                photosBySide.set(side, {});
              }
              photosBySide.get(side)!.after = photo;
            }
          }
        }
      }

      // Compare photos for each side
      for (const [side, photos] of photosBySide) {
        if (photos.before && photos.after) {
          const result = await this.comparePhotos(
            bookingId,
            side as any,
            photos.before.id,
            photos.after.id
          );
          results.push(result);
        }
      }

      logger.info(`Auto-comparison completed for booking ${bookingId}: ${results.length} comparisons`);
      return results;
    } catch (error) {
      logger.error(`Error auto-comparing booking ${bookingId}:`, error);
      throw error;
    }
  }
}

export const photoComparisonService = new PhotoComparisonService();
