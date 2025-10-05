import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { photoComparisonService } from '../services/photoComparisonService';
import { photoUploads, photoChecks } from '../data';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Compare photos for a specific booking and side
 * POST /api/photo-comparison/compare
 */
router.post('/compare', authenticateToken, async (req, res) => {
  try {
    const { bookingId, side, beforePhotoId, afterPhotoId, options } = req.body;

    if (!bookingId || !side || !beforePhotoId || !afterPhotoId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: bookingId, side, beforePhotoId, afterPhotoId'
      });
    }

    const validSides = ['FRONT', 'REAR', 'LEFT', 'RIGHT'];
    if (!validSides.includes(side)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid side. Must be one of: FRONT, REAR, LEFT, RIGHT'
      });
    }

    const result = await photoComparisonService.comparePhotos(
      bookingId,
      side,
      beforePhotoId,
      afterPhotoId,
      options || {}
    );

    res.json({
      success: true,
      data: result,
      message: 'Photo comparison completed successfully'
    });

  } catch (error) {
    logger.error('Photo comparison error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare photos'
    });
  }
});

/**
 * Auto-compare all photos for a booking
 * POST /api/photo-comparison/auto-compare/:bookingId
 */
router.post('/auto-compare/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const results = await photoComparisonService.autoCompareBooking(bookingId);

    res.json({
      success: true,
      data: results,
      message: `Auto-comparison completed: ${results.length} comparisons`
    });

  } catch (error) {
    logger.error('Auto-comparison error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-compare photos'
    });
  }
});

/**
 * Get comparison result by ID
 * GET /api/photo-comparison/:comparisonId
 */
router.get('/:comparisonId', authenticateToken, async (req, res) => {
  try {
    const { comparisonId } = req.params;

    const comparison = photoComparisonService.getComparison(comparisonId);

    if (!comparison) {
      return res.status(404).json({
        success: false,
        error: 'Comparison not found'
      });
    }

    res.json({
      success: true,
      data: comparison,
      message: 'Comparison retrieved successfully'
    });

  } catch (error) {
    logger.error('Get comparison error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get comparison'
    });
  }
});

/**
 * Get all comparisons for a booking
 * GET /api/photo-comparison/booking/:bookingId
 */
router.get('/booking/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const comparisons = photoComparisonService.getBookingComparisons(bookingId);

    res.json({
      success: true,
      data: comparisons,
      message: `Found ${comparisons.length} comparisons for booking`
    });

  } catch (error) {
    logger.error('Get booking comparisons error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get booking comparisons'
    });
  }
});

/**
 * Get all comparisons with damage
 * GET /api/photo-comparison/damage
 */
router.get('/damage', authenticateToken, async (req, res) => {
  try {
    const comparisons = photoComparisonService.getDamageComparisons();

    res.json({
      success: true,
      data: comparisons,
      message: `Found ${comparisons.length} comparisons with damage`
    });

  } catch (error) {
    logger.error('Get damage comparisons error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get damage comparisons'
    });
  }
});

/**
 * Get comparison statistics
 * GET /api/photo-comparison/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = photoComparisonService.getComparisonStats();

    res.json({
      success: true,
      data: stats,
      message: 'Comparison statistics retrieved successfully'
    });

  } catch (error) {
    logger.error('Get comparison stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get comparison statistics'
    });
  }
});

/**
 * Update comparison result (for manual review)
 * PUT /api/photo-comparison/:comparisonId
 */
router.put('/:comparisonId', authenticateToken, async (req, res) => {
  try {
    const { comparisonId } = req.params;
    const updates = req.body;

    const updatedComparison = photoComparisonService.updateComparison(comparisonId, updates);

    if (!updatedComparison) {
      return res.status(404).json({
        success: false,
        error: 'Comparison not found'
      });
    }

    res.json({
      success: true,
      data: updatedComparison,
      message: 'Comparison updated successfully'
    });

  } catch (error) {
    logger.error('Update comparison error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update comparison'
    });
  }
});

/**
 * Delete comparison
 * DELETE /api/photo-comparison/:comparisonId
 */
router.delete('/:comparisonId', authenticateToken, async (req, res) => {
  try {
    const { comparisonId } = req.params;

    const deleted = photoComparisonService.deleteComparison(comparisonId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Comparison not found'
      });
    }

    res.json({
      success: true,
      message: 'Comparison deleted successfully'
    });

  } catch (error) {
    logger.error('Delete comparison error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete comparison'
    });
  }
});

/**
 * Get photos for comparison (before/after for a side)
 * GET /api/photo-comparison/photos/:bookingId/:side
 */
router.get('/photos/:bookingId/:side', authenticateToken, async (req, res) => {
  try {
    const { bookingId, side } = req.params;

    const validSides = ['FRONT', 'REAR', 'LEFT', 'RIGHT'];
    if (!validSides.includes(side)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid side. Must be one of: FRONT, REAR, LEFT, RIGHT'
      });
    }

    // Get photo checks for this booking
    const bookingPhotoChecks = Array.from(photoChecks.values())
      .filter(check => check.bookingId === bookingId);

    const checkInPhotos = bookingPhotoChecks.find(check => check.type === 'CHECK_IN')?.photos;
    const checkOutPhotos = bookingPhotoChecks.find(check => check.type === 'CHECK_OUT')?.photos;

    const beforePhoto = checkInPhotos?.[side as keyof typeof checkInPhotos];
    const afterPhoto = checkOutPhotos?.[side as keyof typeof checkOutPhotos];

    res.json({
      success: true,
      data: {
        bookingId,
        side,
        beforePhoto: beforePhoto ? {
          id: beforePhoto.id,
          filename: beforePhoto.filename,
          url: `${process.env.BACKEND_URL || 'http://localhost:8080'}/uploads/${beforePhoto.filename}`,
          uploadedAt: beforePhoto.uploadedAt
        } : null,
        afterPhoto: afterPhoto ? {
          id: afterPhoto.id,
          filename: afterPhoto.filename,
          url: `${process.env.BACKEND_URL || 'http://localhost:8080'}/uploads/${afterPhoto.filename}`,
          uploadedAt: afterPhoto.uploadedAt
        } : null,
        hasBothPhotos: !!(beforePhoto && afterPhoto)
      },
      message: 'Photos retrieved successfully'
    });

  } catch (error) {
    logger.error('Get photos for comparison error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get photos for comparison'
    });
  }
});

export default router;
