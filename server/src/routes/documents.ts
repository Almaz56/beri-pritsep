import express from 'express';
import { documentService } from '../services/documentService';
import { documentUploads, documentVerifications, users } from '../data';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Upload documents for verification
 * POST /api/documents/upload
 */
router.post('/upload', async (req, res) => {
  try {
    const { userId, documentType } = req.body;

    if (!userId || !documentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId or documentType'
      });
    }

    // Check if user exists
    const user = users.get(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Use multer middleware for file upload
    documentService.getMulterConfig().single('document')(req, res, async (err) => {
      if (err) {
        logger.error('Document upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Validate file
      const validation = documentService.validateDocumentUpload(file);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      // Create document upload record
      const documentUpload = documentService.createDocumentUpload(userId, documentType, file);
      documentUploads.set(documentUpload.id, documentUpload);

      // OCR preview simulation
      const ocrResult = documentService.simulateOCRPreview(file);

      // Check if user already has a document verification
      let verification = documentService.getUserDocumentVerification(userId);
      
      if (!verification) {
        // Create new verification
        verification = documentService.createDocumentVerification(userId, [documentUpload]);
        documentVerifications.set(verification.id, verification);
      } else {
        // Update existing verification
        if (documentType === 'PASSPORT') {
          verification.documents.passport = documentUpload;
        } else if (documentType === 'DRIVER_LICENSE') {
          verification.documents.driverLicense = documentUpload;
        }
        verification.updatedAt = new Date();
      }

      logger.info(`Document uploaded for user ${userId}: ${documentType}`);

      res.json({
        success: true,
        data: {
          documentId: documentUpload.id,
          filename: documentUpload.filename,
          documentType: documentUpload.type,
          ocrPreview: ocrResult,
          verificationStatus: verification.status
        },
        message: 'Document uploaded successfully'
      });
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
router.get('/verification/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = users.get(userId);
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
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = documentUploads.get(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Delete file from filesystem
    const deleted = documentService.deleteDocument(document.filename);
    if (!deleted) {
      logger.warn(`Failed to delete file for document ${documentId}`);
    }

    // Remove from memory
    documentUploads.delete(documentId);

    // Update verification if needed
    const verification = documentService.getUserDocumentVerification(document.userId);
    if (verification) {
      if (verification.documents.passport?.id === documentId) {
        delete verification.documents.passport;
      }
      if (verification.documents.driverLicense?.id === documentId) {
        delete verification.documents.driverLicense;
      }
      verification.updatedAt = new Date();
    }

    logger.info(`Document ${documentId} deleted`);

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

    const result = pendingVerifications.map(verification => {
      const user = users.get(verification.userId);
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
    });

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
    const { status, moderatorId, comment } = req.body;

    if (!status || !moderatorId) {
      return res.status(400).json({
        success: false,
        error: 'Missing status or moderatorId'
      });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be APPROVED or REJECTED'
      });
    }

    // TODO: Add admin authentication check

    const success = documentService.updateDocumentVerification(
      verificationId,
      status,
      moderatorId,
      comment
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Document verification not found'
      });
    }

    logger.info(`Document verification ${verificationId} updated to ${status} by moderator ${moderatorId}`);

    res.json({
      success: true,
      message: 'Document verification status updated successfully'
    });

  } catch (error) {
    logger.error('Update document verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
