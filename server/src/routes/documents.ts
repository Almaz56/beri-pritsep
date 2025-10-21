import express from 'express';
import { documentService } from '../services/documentService';
import { documentUploads, documentVerifications } from '../data';
import { databaseService } from '../services/databaseService';
import logger from '../utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

/**
 * Upload documents for verification
 * POST /api/documents/upload
 */
router.post('/upload', authenticateToken, async (req: AuthRequest, res) => {
  logger.info('=== SIMPLE DOCUMENT UPLOAD ROUTE ===');
  
  try {
    logger.info('Processing upload request...');
    
    // Простой ответ без обработки файла
    res.json({
      success: true,
      data: {
        documentId: 'simple_test_123',
        filename: 'test.jpg',
        documentType: 'PASSPORT',
        ocrPreview: { success: true, text: 'Simple test OCR' },
        verificationStatus: 'PENDING'
      },
      message: 'Document uploaded successfully (simple mode)'
    });
    
    logger.info('Response sent successfully');
    
  } catch (error) {
    logger.error('Simple upload error:', error);
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