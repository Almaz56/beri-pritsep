import multer from 'multer';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';
import { DocumentUpload, DocumentVerification, documentUploads, documentVerifications, users } from '../data';

type DocumentType = 'PASSPORT' | 'DRIVER_LICENSE' | 'OTHER';

class DocumentService {
  private uploadPath: string;
  private maxFileSize: number; // in bytes
  private multerConfig: multer.Multer;

  constructor() {
    this.uploadPath = process.env['UPLOAD_PATH'] || path.join('/app', 'uploads');
    this.maxFileSize = parseInt(process.env['MAX_FILE_SIZE'] || '10485760'); // Default 10MB

    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
      logger.info(`Created upload directory: ${this.uploadPath}`);
    }

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'document-' + uniqueSuffix + path.extname(file.originalname));
      }
    });

    this.multerConfig = multer({
      storage: storage,
      limits: { fileSize: this.maxFileSize },
      fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only .png, .jpg and .webp format allowed!') as any, false);
        }
      }
    });
  }

  getMulterConfig(): multer.Multer {
    return this.multerConfig;
  }

  validateDocumentUpload(file: Express.Multer.File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file uploaded' };
    }
    if (file.size > this.maxFileSize) {
      return { valid: false, error: `File size exceeds ${this.maxFileSize / (1024 * 1024)}MB limit` };
    }
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      return { valid: false, error: 'Only .png, .jpg and .webp format allowed!' };
    }
    return { valid: true };
  }

  createDocumentUpload(
    userId: string,
    type: DocumentType,
    file: Express.Multer.File
  ): DocumentUpload {
    const newDocument: DocumentUpload = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      type,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date(),
    };
    return newDocument;
  }

  createDocumentVerification(
    userId: string,
    documents: DocumentUpload[]
  ): DocumentVerification {
    const documentMap: DocumentVerification['documents'] = {};
    documents.forEach(doc => {
      if (doc.type === 'PASSPORT') {
        documentMap.passport = doc;
      } else if (doc.type === 'DRIVER_LICENSE') {
        documentMap.driverLicense = doc;
      }
    });

    return {
      id: `docver_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      documents: documentMap,
      status: 'PENDING_MODERATION',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  validateDocumentVerification(documents: DocumentUpload[]): { valid: boolean; missing: DocumentType[] } {
    const requiredTypes: DocumentType[] = ['PASSPORT', 'DRIVER_LICENSE'];
    const uploadedTypes = new Set(documents.map(d => d.type));
    const missingTypes = requiredTypes.filter(type => !uploadedTypes.has(type));
    return { valid: missingTypes.length === 0, missing: missingTypes };
  }

  getDocumentUrl(filename: string): string {
    // In a real app, this would be a CDN URL or a signed URL from cloud storage
    return `${process.env.BACKEND_URL || 'http://localhost:8080'}/uploads/${filename}`;
  }

  deleteDocument(filename: string): boolean {
    const filePath = path.join(this.uploadPath, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Deleted document file: ${filePath}`);
      return true;
    }
    logger.warn(`Attempted to delete non-existent document file: ${filePath}`);
    return false;
  }

  // OCR preview simulation (in real app, would use actual OCR service)
  simulateOCRPreview(file: Express.Multer.File): { success: boolean; text?: string; confidence?: number } {
    // Simulate OCR processing
    const mockTexts = {
      'passport': 'ПАСПОРТ РОССИЙСКОЙ ФЕДЕРАЦИИ\nСЕРИЯ 1234 № 567890\nИВАН ПЕТРОВ\n01.01.1990',
      'driver_license': 'ВОДИТЕЛЬСКОЕ УДОСТОВЕРЕНИЕ\nСЕРИЯ 1234 № 567890\nИВАН ПЕТРОВ\n01.01.1990'
    };

    // Simple simulation based on filename or random
    const isPassport = file.originalname.toLowerCase().includes('passport') || 
                      file.originalname.toLowerCase().includes('паспорт');
    const isDriverLicense = file.originalname.toLowerCase().includes('license') || 
                           file.originalname.toLowerCase().includes('права') ||
                           file.originalname.toLowerCase().includes('удостоверение');

    if (isPassport) {
      return {
        success: true,
        text: mockTexts.passport,
        confidence: 0.85
      };
    } else if (isDriverLicense) {
      return {
        success: true,
        text: mockTexts.driver_license,
        confidence: 0.78
      };
    }

    return {
      success: false,
      text: 'Не удалось распознать текст документа',
      confidence: 0.0
    };
  }

  // Get user's document verification status
  getUserDocumentVerification(userId: string): DocumentVerification | null {
    return Array.from(documentVerifications.values()).find(dv => dv.userId === userId) || null;
  }

  // Update document verification status (for admin)
  updateDocumentVerification(
    verificationId: string, 
    status: DocumentVerification['status'],
    moderatorId: string,
    comment?: string
  ): boolean {
    const verification = documentVerifications.get(verificationId);
    if (!verification) {
      return false;
    }

    verification.status = status;
    verification.moderatorId = moderatorId;
    verification.moderatorComment = comment;
    verification.updatedAt = new Date();

    // Update user verification status
    const user = users.get(verification.userId);
    if (user) {
      if (status === 'APPROVED') {
        user.verificationStatus = 'VERIFIED';
      } else if (status === 'REJECTED') {
        user.verificationStatus = 'PENDING';
      }
      user.updatedAt = new Date();
    }

    logger.info(`Document verification ${verificationId} updated to ${status} by moderator ${moderatorId}`);
    return true;
  }

  // Get all pending document verifications (for admin)
  getPendingVerifications(): DocumentVerification[] {
    return Array.from(documentVerifications.values()).filter(dv => dv.status === 'PENDING_MODERATION');
  }
}

export const documentService = new DocumentService();
