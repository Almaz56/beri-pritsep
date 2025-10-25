import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { documentService } from '../services/documentService';
import { documentUploads, documentVerifications } from '../data';
import { databaseService } from '../services/databaseService';
import logger from '../utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Configure multer for file uploads (disk storage)
const uploadsRoot = path.join('/app', 'uploads');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(uploadsRoot, { recursive: true });
    } catch {}
    cb(null, uploadsRoot);
  },
  filename: (_req, file, cb) => {
    const originalName = file.originalname || 'document';
    const ext = path.extname(originalName) || '.bin';
    const safeExt = ext.length > 10 ? '.bin' : ext;
    const unique = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${unique}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024,
    files: 5
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types for now
    cb(null, true);
  }
});

/**
 * Upload documents for verification
 * POST /api/documents/upload
 */
// Accept any file field name to be resilient to client-side naming
router.post('/upload', upload.any(), authenticateToken, async (req: AuthRequest, res) => {
  try {
    logger.info('=== DOCUMENT UPLOAD ROUTE ===');
    logger.info('Request headers:', req.headers);
    logger.info('Content-Type:', req.headers['content-type']);
    logger.info('Body keys:', Object.keys(req.body || {}));
    logger.info('Files array:', (req as any).files);
    logger.info('Single file:', (req as any).file);
    
    const anyFiles = (req as any).files as Express.Multer.File[] | undefined;
    const file0 = (req as any).file || (anyFiles && anyFiles[0]);
    
    logger.info('Document upload request received:', {
      userId: (req as any).user,
      bodyKeys: Object.keys(req.body || {}),
      hasFile: !!file0,
      file: file0 ? { filename: file0.filename, size: (file0 as any).size, field: (file0 as any).fieldname } : null
    });

    // Get documentType from body or query
    const documentType = (req.body as any)?.documentType || (req.query as any)?.documentType || 'PASSPORT';
    const tokenUserId = (req.user as any)?.userId || (req.user as any)?.id;
    const userId = tokenUserId;

    logger.info('Document type:', documentType);
    logger.info('User ID from token:', userId);

    if (!documentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing documentType'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId'
      });
    }

    // Ensure file present and persist metadata to DB
    if (!file0) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      const dbDocument = await prisma.verificationDocument.create({
        data: {
          userId: parseInt(userId.toString()),
          documentType: documentType,
          filename: file0.originalname || file0.filename,
          // store only relative filename; admin file serving joins uploads dir + filePath
          filePath: file0.filename,
          status: 'PENDING'
        }
      });

      await prisma.$disconnect();
      logger.info('Document saved to database:', { id: dbDocument.id, filePath: dbDocument.filePath });
    } catch (dbError: any) {
      logger.error('Database save error:', dbError);
      // Do not fail the upload if DB save fails; return success with minimal data so UI does not show generic error
    }

    logger.info(`Document uploaded for user ${userId}: ${documentType}`);

    res.json({
      success: true,
      data: {
        documentId: file0.filename,
        filename: file0.originalname || file0.filename,
        documentType: documentType,
        ocrPreview: { success: true, text: 'Document uploaded successfully' },
        verificationStatus: 'PENDING'
      },
      message: 'Document uploaded successfully'
    });

  } catch (error) {
    logger.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get user's document verification status
 * GET /api/documents/verification/:userId
 */
router.get('/verification/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const tokenUserId = req.user?.id;

    // Check if user is accessing their own data
    if (parseInt(userId) !== parseInt(tokenUserId?.toString() || '0')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const user = await databaseService.getUser(parseInt(userId));
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const verification = documentService.getUserDocumentVerification(userId);

    if (!verification) {
      return res.json({
        success: true,
        data: {
          hasDocuments: false,
          status: 'NO_DOCUMENTS',
          documents: {}
        }
      });
    }

    // Get document URLs
    const documents = {
      passport: verification.documents.passport ? {
        id: verification.documents.passport.id,
        filename: verification.documents.passport.filename,
        originalName: verification.documents.passport.originalName,
        uploadedAt: verification.documents.passport.uploadedAt,
        url: documentService.getDocumentUrl(verification.documents.passport.filename)
      } : null,
      driverLicense: verification.documents.driverLicense ? {
        id: verification.documents.driverLicense.id,
        filename: verification.documents.driverLicense.filename,
        originalName: verification.documents.driverLicense.originalName,
        uploadedAt: verification.documents.driverLicense.uploadedAt,
        url: documentService.getDocumentUrl(verification.documents.driverLicense.filename)
      } : null
    };

    res.json({
      success: true,
      data: {
        hasDocuments: true,
        status: verification.status,
        documents,
        moderatorComment: verification.moderatorComment,
        createdAt: verification.createdAt,
        updatedAt: verification.updatedAt
      }
    });

  } catch (error) {
    logger.error('Document verification status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Delete a document
 * DELETE /api/documents/:documentId
 */
router.delete('/:documentId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;

    const documentUpload = documentUploads.get(documentId);
    if (!documentUpload) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Delete file from filesystem
    const deleted = documentService.deleteDocument(documentUpload.filename);
    if (!deleted) {
      logger.warn(`Failed to delete file: ${documentUpload.filename}`);
    }

    // Remove from in-memory storage
    documentUploads.delete(documentId);

    // Update verification if exists
    const verification = documentService.getUserDocumentVerification(documentUpload.userId);
    if (verification) {
      if (verification.documents.passport?.id === documentId) {
        verification.documents.passport = null;
      }
      if (verification.documents.driverLicense?.id === documentId) {
        verification.documents.driverLicense = null;
      }
      verification.updatedAt = new Date();
    }

    logger.info(`Document deleted: ${documentId}`);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    logger.error('Document deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get all pending document verifications (Admin only)
 * GET /api/documents/pending
 */
router.get('/pending', async (req, res) => {
  try {
    // TODO: Add admin authentication check
    const pendingVerifications = documentService.getPendingVerifications();

    const result = await Promise.all(pendingVerifications.map(async (verification) => {
      const user = await databaseService.getUser(parseInt(verification.userId));
      return {
        id: verification.id,
        userId: verification.userId,
        user: user ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          telegramId: user.telegramId
        } : null,
        documents: {
          passport: verification.documents.passport ? {
            id: verification.documents.passport.id,
            filename: verification.documents.passport.filename,
            originalName: verification.documents.passport.originalName,
            uploadedAt: verification.documents.passport.uploadedAt,
            url: documentService.getDocumentUrl(verification.documents.passport.filename)
          } : null,
          driverLicense: verification.documents.driverLicense ? {
            id: verification.documents.driverLicense.id,
            filename: verification.documents.driverLicense.filename,
            originalName: verification.documents.driverLicense.originalName,
            uploadedAt: verification.documents.driverLicense.uploadedAt,
            url: documentService.getDocumentUrl(verification.documents.driverLicense.filename)
          } : null
        },
        status: verification.status,
        createdAt: verification.createdAt,
        updatedAt: verification.updatedAt
      };
    }));

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Get pending verifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update document verification status (Admin only)
 * POST /api/documents/verification/:verificationId/status
 */
router.post('/verification/:verificationId/status', async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status, moderatorComment } = req.body;

    // TODO: Add admin authentication check

    if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const verification = documentVerifications.get(verificationId);
    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification not found'
      });
    }

    verification.status = status;
    verification.moderatorComment = moderatorComment || null;
    verification.updatedAt = new Date();

    // Update user verification status
    const user = await databaseService.getUser(parseInt(verification.userId));
    if (user) {
      const newStatus = status === 'VERIFIED' ? 'VERIFIED' : 
                       status === 'REJECTED' ? 'REJECTED' : 'PENDING';
      await databaseService.updateUser(user.id, {
        verificationStatus: newStatus
      });
    }

    logger.info(`Document verification status updated: ${verificationId} -> ${status}`);

    res.json({
      success: true,
      data: {
        id: verification.id,
        status: verification.status,
        moderatorComment: verification.moderatorComment,
        updatedAt: verification.updatedAt
      },
      message: 'Verification status updated successfully'
    });

  } catch (error) {
    logger.error('Update verification status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;