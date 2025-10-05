import { Router } from 'express';

const router = Router();

/**
 * GET /api/trailers
 * Get list of available trailers
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Trailers endpoint ready for implementation'
  });
});

/**
 * GET /api/trailers/:id
 * Get trailer by ID
 */
router.get('/:id', (req, res) => {
  res.json({
    success: true,
    data: null,
    message: 'Trailer details endpoint ready for implementation'
  });
});

export default router;
