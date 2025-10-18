import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { adminService } from './services/adminService';
import { databaseService } from './services/databaseService';
import { authenticateAdmin, AdminRequest, requireAdmin } from './middleware/adminAuth';

// Load environment variables
dotenv.config({ path: '.env' });

const app = express();
const PORT = process.env['PORT'] || 8080;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env['NODE_ENV'] === 'production' 
    ? ['https://beripritsep.ru', 'https://admin.beripritsep.ru']
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3003'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const stats = await databaseService.getStats();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected',
      data: {
        users: stats.totalUsers,
        trailers: stats.totalTrailers,
        bookings: stats.totalBookings,
        payments: stats.totalTransactions
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Admin Authentication endpoints
app.post('/api/admin/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const result = await adminService.authenticateAdmin({ email, password });
    
    if (!result) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    res.json({
      success: true,
      data: {
        admin: {
          id: result.admin.id,
          email: result.admin.email,
          firstName: result.admin.firstName,
          lastName: result.admin.lastName,
          role: result.admin.role
        },
        token: result.token
      },
      message: 'Admin login successful'
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/admin/auth/me', authenticateAdmin, async (req: AdminRequest, res) => {
  try {
    const admin = await adminService.getAdminById(req.admin!.id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt
      },
      message: 'Admin profile retrieved successfully'
    });

  } catch (error) {
    console.error('Admin profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Admin API endpoints
app.get('/api/admin/users', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const usersList = await databaseService.getAllUsers();
    res.json({ success: true, data: usersList, message: 'Users retrieved successfully' });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/admin/bookings', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const bookingsList = await databaseService.getAllBookings();
    res.json({ success: true, data: bookingsList, message: 'Bookings retrieved successfully' });
  } catch (error) {
    console.error('Admin bookings error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/admin/payments', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const paymentsList = await databaseService.getAllPayments();
    res.json({ success: true, data: paymentsList, message: 'Payments retrieved successfully' });
  } catch (error) {
    console.error('Admin payments error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/admin/stats', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const stats = await databaseService.getStats();
    res.json({ success: true, data: stats, message: 'Stats retrieved successfully' });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Trailer Management endpoints
app.get('/api/admin/trailers', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const trailers = await databaseService.getAllTrailers();
    res.json({ success: true, data: trailers, message: 'Trailers retrieved successfully' });
  } catch (error) {
    console.error('Admin trailers error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/admin/trailers/:id', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const trailer = await databaseService.getTrailer(parseInt(id));
    
    if (!trailer) {
      return res.status(404).json({ success: false, error: 'Trailer not found' });
    }
    
    res.json({ success: true, data: trailer, message: 'Trailer retrieved successfully' });
  } catch (error) {
    console.error('Admin trailer error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/admin/trailers', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const trailerData = req.body;
    const trailer = await databaseService.createTrailer(trailerData);
    res.json({ success: true, data: trailer, message: 'Trailer created successfully' });
  } catch (error) {
    console.error('Admin create trailer error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.put('/api/admin/trailers/:id', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const trailerData = req.body;
    const trailer = await databaseService.updateTrailer(parseInt(id), trailerData);
    
    if (!trailer) {
      return res.status(404).json({ success: false, error: 'Trailer not found' });
    }
    
    res.json({ success: true, data: trailer, message: 'Trailer updated successfully' });
  } catch (error) {
    console.error('Admin update trailer error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.delete('/api/admin/trailers/:id', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const success = await databaseService.deleteTrailer(parseInt(id));
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Trailer not found' });
    }
    
    res.json({ success: true, message: 'Trailer deleted successfully' });
  } catch (error) {
    console.error('Admin delete trailer error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Initialize default admin
adminService.createDefaultAdmin();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Admin server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Admin login: http://localhost:${PORT}/api/admin/auth/login`);
});

export default app;
