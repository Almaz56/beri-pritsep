import { Router } from 'express';

const router = Router();

/**
 * GET /api/admin/dashboard
 * Get admin dashboard data
 */
router.get('/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {},
    message: 'Admin dashboard endpoint ready for implementation'
  });
});

export default router;
