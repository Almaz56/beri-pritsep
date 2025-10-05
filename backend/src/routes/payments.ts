import { Router } from 'express';

const router = Router();

/**
 * POST /api/payments
 * Initialize payment
 */
router.post('/', (req, res) => {
  res.json({
    success: true,
    data: null,
    message: 'Payment endpoint ready for implementation'
  });
});

export default router;
