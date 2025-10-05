import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import logger from '../utils/logger';

export interface PhotoUpload {
  id: string;
  bookingId: string;
  userId: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  side: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT';
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export interface PhotoCheck {
  id: string;
  bookingId: string;
  userId: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  photos: {
    FRONT?: PhotoUpload;
    REAR?: PhotoUpload;
    LEFT?: PhotoUpload;
    RIGHT?: PhotoUpload;
  };
  status: 'PENDING' | 'COMPLETED' | 'MISSING';
  createdAt: Date;
  updatedAt: Date;
}

class PhotoService {
  private uploadPath: string;
  private maxFileSize: number;
  private allowedMimeTypes: string[];

  constructor() {
    this.uploadPath = process.env['UPLOAD_PATH'] || './uploads';
    this.maxFileSize = parseInt(process.env['MAX_FILE_SIZE'] || '10485760'); // 10MB
    this.allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
      logger.info(`Created upload directory: ${this.uploadPath}`);
    }
  }

  /**
   * Configure multer for photo uploads
   */
  public getMulterConfig() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `photo_${uniqueSuffix}${ext}`);
      }
    });

    const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      if (this.allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`));
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: 4 // Maximum 4 files per request
      }
    });
  }

  /**
   * Validate photo upload
   */
  public validatePhotoUpload(file: Express.Multer.File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      return { valid: false, error: `Invalid file type. Allowed: ${this.allowedMimeTypes.join(', ')}` };
    }

    if (file.size > this.maxFileSize) {
      return { valid: false, error: `File too large. Maximum size: ${this.maxFileSize / 1024 / 1024}MB` };
    }

    return { valid: true };
  }

  /**
   * Create photo upload record
   */
  public createPhotoUpload(
    bookingId: string,
    userId: string,
    type: 'CHECK_IN' | 'CHECK_OUT',
    side: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT',
    file: Express.Multer.File
  ): PhotoUpload {
    return {
      id: `photo_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
      bookingId,
      userId,
      type,
      side,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date()
    };
  }

  /**
   * Get photo file path
   */
  public getPhotoPath(filename: string): string {
    return path.join(this.uploadPath, filename);
  }

  /**
   * Check if photo file exists
   */
  public photoExists(filename: string): boolean {
    const filePath = this.getPhotoPath(filename);
    return fs.existsSync(filePath);
  }

  /**
   * Delete photo file
   */
  public deletePhoto(filename: string): boolean {
    try {
      const filePath = this.getPhotoPath(filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted photo file: ${filename}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error deleting photo file ${filename}:`, error);
      return false;
    }
  }

  /**
   * Get photo URL for serving
   */
  public getPhotoUrl(filename: string): string {
    return `/uploads/${filename}`;
  }

  /**
   * Validate all required photos for check-in/check-out
   */
  public validatePhotoCheck(photos: PhotoUpload[]): { valid: boolean; missing: string[] } {
    const requiredSides = ['FRONT', 'REAR', 'LEFT', 'RIGHT'];
    const uploadedSides = photos.map(p => p.side);
    const missing = requiredSides.filter(side => !uploadedSides.includes(side as any));

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Create photo check record
   */
  public createPhotoCheck(
    bookingId: string,
    userId: string,
    type: 'CHECK_IN' | 'CHECK_OUT',
    photos: PhotoUpload[]
  ): PhotoCheck {
    const photoMap: PhotoCheck['photos'] = {};
    photos.forEach(photo => {
      photoMap[photo.side] = photo;
    });

    const validation = this.validatePhotoCheck(photos);

    return {
      id: `check_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
      bookingId,
      userId,
      type,
      photos: photoMap,
      status: validation.valid ? 'COMPLETED' : 'MISSING',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get photo statistics
   */
  public getPhotoStats(): { totalFiles: number; totalSize: number } {
    try {
      const files = fs.readdirSync(this.uploadPath);
      let totalSize = 0;

      files.forEach(file => {
        const filePath = path.join(this.uploadPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      });

      return {
        totalFiles: files.length,
        totalSize
      };
    } catch (error) {
      logger.error('Error getting photo stats:', error);
      return { totalFiles: 0, totalSize: 0 };
    }
  }

  /**
   * Clean up old photos (for maintenance)
   */
  public cleanupOldPhotos(daysOld: number = 30): { deleted: number; errors: number } {
    try {
      const files = fs.readdirSync(this.uploadPath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let deleted = 0;
      let errors = 0;

      files.forEach(file => {
        const filePath = path.join(this.uploadPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && stats.mtime < cutoffDate) {
          try {
            fs.unlinkSync(filePath);
            deleted++;
            logger.info(`Cleaned up old photo: ${file}`);
          } catch (error) {
            errors++;
            logger.error(`Error deleting old photo ${file}:`, error);
          }
        }
      });

      return { deleted, errors };
    } catch (error) {
      logger.error('Error during photo cleanup:', error);
      return { deleted: 0, errors: 1 };
    }
  }
}

export const photoService = new PhotoService();
