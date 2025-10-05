import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/bookings
 * Get user bookings
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Bookings endpoint ready for implementation'
  });
}));

/**
 * POST /api/bookings
 * Create new booking
 */
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: null,
    message: 'Booking creation endpoint ready for implementation'
  });
}));

export default router;
