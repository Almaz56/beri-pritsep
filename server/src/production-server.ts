import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

interface AuthRequest extends Request {
  user?: {
    id: string;
    telegramId: number;
    firstName: string;
    lastName: string;
    username: string;
  };
}
import { adminService } from './services/adminService';
import { databaseService } from './services/databaseService';
import { authenticateAdmin, AdminRequest, requireAdmin } from './middleware/adminAuth';
import jwt from 'jsonwebtoken';
import { verifyInitData, getDevUser } from './verifyInitData';
import { calculatePricing } from './pricing';
import { tinkoffService } from './services/tinkoffService';
import { photoService } from './services/photoService';
import { chatService } from './services/chatService';
import phoneRoutes from './routes/phone';
import documentRoutes from './routes/documents';
import qrRoutes from './routes/qr';
import photoComparisonRoutes from './routes/photoComparison';
import logger from './utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env' });

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://app.beripritsep.ru", "https://admin.beripritsep.ru"]
      : ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env['PORT'] || 8080;
const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-secret-key';
const ALLOW_DEV_AUTH = process.env['ALLOW_DEV_AUTH'] === 'true';

// Configure multer for trailer photo uploads
const uploadPath = process.env['UPLOAD_PATH'] || './uploads';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const trailerPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `trailer_${uniqueSuffix}${ext}`);
  }
});

const trailerPhotoUpload = multer({
  storage: trailerPhotoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS is handled by Nginx in production
if (process.env['NODE_ENV'] !== 'production') {
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001', 'http://localhost:3003'],
    credentials: true,
  }));
}

// Rate limiting disabled in production (Nginx handles it)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100 // limit each IP to 100 requests per windowMs
// });
// app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(uploadPath));

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


// Middleware for JWT authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Fallback: allow X-Telegram-Init-Data when no Bearer token (TWA auto-login)
  const telegramInitData = req.headers['x-telegram-init-data'];
  console.log('Auth middleware - token:', !!token, 'telegramInitData:', !!telegramInitData);
  
  if (!token && telegramInitData) {
    console.log('Allowing request with Telegram initData');
    // accept request but attach a synthetic user from verified initData at auth endpoint layer
    // here we just skip to handler; handlers that require req.user should first ensure JWT flow used
    return next();
  }

  if (!token) {
    console.log('No token and no Telegram initData - rejecting');
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.log('JWT verification failed:', err.message);
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }

    console.log('JWT verification successful, user:', user);
    req.user = user;
    console.log('req.user set to:', req.user);
    next();
  });
};

// Telegram Authentication endpoint
app.post('/api/auth/telegram', async (req, res) => {
  try {
    let { initData } = req.body as any;
    if (!initData) {
      const headerInit = req.headers['x-telegram-init-data'];
      if (headerInit) initData = headerInit;
    }

    if (!initData) {
      return res.status(400).json({
        success: false,
        error: 'Telegram initData is required'
      });
    }

    // Verify Telegram initData
    let userData = await verifyInitData(initData);
    if (!userData && ALLOW_DEV_AUTH) {
      console.warn('verifyInitData failed; falling back to dev verification');
      const { verifyInitDataDev } = await import('./verifyInitData');
      userData = verifyInitDataDev(initData) as any;
    }
    
    if (!userData) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Telegram authentication data'
      });
    }

    // Find or create user
    let user = await databaseService.getUserByTelegramId(BigInt(userData.id));
    
    if (!user) {
      user = await databaseService.createUser({
        telegramId: BigInt(userData.id),
        firstName: userData.first_name,
        lastName: userData.last_name || '',
        username: userData.username || '',
        phoneNumber: ''
      });
    } else {
      // Update existing user
      user = await databaseService.updateUser(user.id, {
        firstName: userData.first_name,
        lastName: userData.last_name || '',
        username: userData.username || ''
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id.toString(), telegramId: user.telegramId.toString() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          telegramId: user.telegramId.toString(),
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          verificationStatus: user.verificationStatus
        },
        token
      },
      message: 'Authentication successful'
    });

  } catch (error) {
    console.error('Telegram auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Development Authentication endpoint
app.post('/api/auth/dev', async (req, res) => {
  try {
    if (!ALLOW_DEV_AUTH) {
      return res.status(403).json({
        success: false,
        error: 'Development authentication is disabled in production'
      });
    }

    const { userId } = req.body;
    const devUser = getDevUser();

    // Find or create user
    let user = await databaseService.getUserByTelegramId(BigInt(devUser.id));
    
    if (!user) {
      user = await databaseService.createUser({
        telegramId: BigInt(devUser.id),
        firstName: devUser.first_name,
        lastName: devUser.last_name || '',
        username: devUser.username || '',
        phoneNumber: ''
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id.toString(), telegramId: user.telegramId.toString() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          telegramId: user.telegramId.toString(),
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          verificationStatus: user.verificationStatus
        },
        token
      },
      message: 'Development authentication successful'
    });
  } catch (error) {
    console.error('Dev auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
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
    const trailerId = parseInt(req.params.id);
    const trailer = await databaseService.getTrailer(trailerId);
    
    if (!trailer) {
      return res.status(404).json({
        success: false,
        error: 'Trailer not found'
      });
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

  // Upload trailer photos
  app.post('/api/admin/trailers/:id/photos', authenticateAdmin, requireAdmin, trailerPhotoUpload.array('photos', 10), async (req: AdminRequest, res) => {
    try {
      const trailerId = parseInt(req.params.id);
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No photos uploaded'
        });
      }

      // Generate URLs for uploaded photos
      const photoUrls = files.map(file => {
        const baseUrl = process.env['BACKEND_URL'] || 'http://localhost:8080';
        return `${baseUrl}/uploads/${file.filename}`;
      });

      // Update trailer with new photos
      const trailer = await databaseService.getTrailer(trailerId);
      if (!trailer) {
        return res.status(404).json({
          success: false,
          error: 'Trailer not found'
        });
      }

      // Filter out placeholder URLs and merge with new photos
      const existingPhotos = (trailer.photos || []).filter(photo => 
        !photo.includes('via.placeholder.com') && !photo.includes('placeholder')
      );
      const updatedPhotos = [...existingPhotos, ...photoUrls];

      const updatedTrailer = await databaseService.updateTrailer(trailerId, {
        photos: updatedPhotos
      });

      res.json({
        success: true,
        data: {
          trailer: updatedTrailer,
          uploadedPhotos: photoUrls
        },
        message: 'Photos uploaded successfully'
      });
    } catch (error) {
      console.error('Trailer photo upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload photos'
      });
    }
  });

  // Update trailer photos (replace all photos)
  app.put('/api/admin/trailers/:id/photos', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
    try {
      const trailerId = parseInt(req.params.id);
      const { photos } = req.body;

      if (!Array.isArray(photos)) {
        return res.status(400).json({
          success: false,
          error: 'Photos must be an array'
        });
      }

      // Update trailer with new photos array
      const updatedTrailer = await databaseService.updateTrailer(trailerId, {
        photos: photos
      });

      if (!updatedTrailer) {
        return res.status(404).json({
          success: false,
          error: 'Trailer not found'
        });
      }

      res.json({
        success: true,
        data: updatedTrailer,
        message: 'Photos updated successfully'
      });
    } catch (error) {
      console.error('Trailer photos update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update photos'
      });
    }
  });

app.put('/api/admin/trailers/:id', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const trailerId = parseInt(req.params.id);
    const trailerData = req.body;
    const trailer = await databaseService.updateTrailer(trailerId, trailerData);
    
    if (!trailer) {
      return res.status(404).json({
        success: false,
        error: 'Trailer not found'
      });
    }

    res.json({ success: true, data: trailer, message: 'Trailer updated successfully' });
  } catch (error) {
    console.error('Admin update trailer error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.delete('/api/admin/trailers/:id', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const trailerId = parseInt(req.params.id);
    const success = await databaseService.deleteTrailer(trailerId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Trailer not found'
      });
    }

    res.json({ success: true, message: 'Trailer deleted successfully' });
  } catch (error) {
    console.error('Admin delete trailer error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Location Management endpoints
app.get('/api/admin/locations', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const locations = await databaseService.getAllLocations();
    res.json({ success: true, data: locations, message: 'Locations retrieved successfully' });
  } catch (error) {
    console.error('Admin locations error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/admin/locations', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { name, address, photos, latitude, longitude, city, region, description } = req.body;
    
    const locationData = {
      name,
      address,
      photos: photos || [],
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      city,
      region,
      description
    };
    
    const location = await databaseService.createLocation(locationData);
    res.json({ success: true, data: location, message: 'Location created successfully' });
  } catch (error) {
    console.error('Admin create location error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.put('/api/admin/locations/:id', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const { name, address, photos, latitude, longitude, city, region, description, isActive } = req.body;
    
    const updateData = {
      name,
      address,
      photos,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      city,
      region,
      description,
      isActive
    };
    
    const location = await databaseService.updateLocation(parseInt(id), updateData);
    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }
    
    res.json({ success: true, data: location, message: 'Location updated successfully' });
  } catch (error) {
    console.error('Admin update location error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.delete('/api/admin/locations/:id', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const location = await databaseService.deleteLocation(parseInt(id));
    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }
    
    res.json({ success: true, data: location, message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Admin delete location error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Public API endpoints for trailers (for frontend)
app.get('/api/trailers', async (req, res) => {
  try {
    const locationId = req.query['location_id'] as string;
    
    let trailersList = await databaseService.getAllTrailers();
    
    if (locationId) {
      trailersList = trailersList.filter(trailer => trailer.locationId?.toString() === locationId);
    }

    res.json({
      success: true,
      data: trailersList,
      message: 'Trailers retrieved successfully'
    });
  } catch (error) {
    console.error('Trailers error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/trailers/:id', async (req, res) => {
  try {
    const trailerId = parseInt(req.params.id);
    const trailer = await databaseService.getTrailer(trailerId);
    
    if (!trailer) {
      return res.status(404).json({
        success: false,
        error: 'Trailer not found'
      });
    }

    res.json({
      success: true,
      data: trailer,
      message: 'Trailer retrieved successfully'
    });
  } catch (error) {
    console.error('Trailer error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Public API endpoints for locations
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await databaseService.getAllLocations();
    res.json({
      success: true,
      data: locations,
      message: 'Locations retrieved successfully'
    });
  } catch (error) {
    console.error('Locations error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Initialize database and default admin
async function initializeServer() {
  try {
    await databaseService.initialize();
    await adminService.createDefaultAdmin();
    console.log('✅ Database and admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

// Quote calculation endpoint
app.post('/api/quote', async (req: any, res: any) => {
  try {
    const { trailerId, startTime, endTime, rentalType, additionalServices } = req.body;

    console.log('Quote request:', { trailerId, startTime, endTime, rentalType, additionalServices });

    if (!trailerId || !startTime || !endTime || !rentalType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: trailerId, startTime, endTime, rentalType'
      });
    }

    const trailer = await databaseService.getTrailer(parseInt(trailerId));
    if (!trailer) {
      return res.status(404).json({
        success: false,
        error: 'Trailer not found'
      });
    }

    const quoteResult = calculatePricing(
      new Date(startTime),
      new Date(endTime),
      rentalType,
      additionalServices || {},
      {
        pickupPrice: trailer.pickupPrice
      }
    );

    console.log('Quote calculated:', quoteResult);

    res.json({
      success: true,
      data: {
        trailerId,
        startTime,
        endTime,
        rentalType,
        additionalServices: additionalServices || {},
        pricing: quoteResult.pricing
      },
      message: 'Quote calculated successfully'
    });

  } catch (error) {
    console.error('Quote calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate quote'
    });
  }
});

// Bookings endpoints
app.post('/api/bookings', authenticateToken, async (req: any, res: any) => {
  try {
    const { trailerId, startTime, endTime, rentalType, additionalServices } = req.body;
    const userId = parseInt(req.user?.userId!);
    console.log('Create booking - userId:', userId, 'req.user:', req.user);

    const trailer = await databaseService.getTrailer(parseInt(trailerId));
    if (!trailer) {
      return res.status(404).json({
        success: false,
        error: 'Trailer not found'
      });
    }

    // Check availability
    const allBookings = await databaseService.getAllBookings();
    const conflictingBookings = allBookings.filter(booking => 
      booking.trailerId === parseInt(trailerId) &&
      booking.status !== 'CLOSED' &&
      booking.status !== 'CANCELLED' &&
      (
        (new Date(booking.startTime) <= new Date(endTime) && 
         new Date(booking.endTime) >= new Date(startTime))
      )
    );

    if (conflictingBookings.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Trailer is not available for the selected time period'
      });
    }

    // Calculate pricing
    const pricing = calculatePricing(
      new Date(startTime),
      new Date(endTime),
      rentalType,
      additionalServices || {},
      {
        pickupPrice: trailer.pickupPrice
      }
    );

    // Create booking
    const booking = await databaseService.createBooking({
      userId,
      trailerId: parseInt(trailerId),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      rentalType,
      additionalServices: additionalServices || {},
      pricing: pricing.pricing,
      totalAmount: pricing.pricing.total,
      depositAmount: pricing.pricing.deposit
    });

    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        status: booking.status,
        totalAmount: pricing.pricing.total,
        depositAmount: pricing.pricing.deposit
      },
      message: 'Booking created successfully'
    });

  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  }
});

app.get('/api/bookings', authenticateToken, async (req: any, res: any) => {
  try {
    console.log('Bookings endpoint - req.user:', req.user);
    let userId = req.user?.userId;
    console.log('Bookings endpoint - userId:', userId);
    
    // If no JWT user but we have X-Telegram-Init-Data, try to authenticate
    if (!userId) {
      const initData = req.headers['x-telegram-init-data'];
      console.log('Bookings endpoint - initData:', !!initData, 'length:', initData?.length);
      if (initData) {
        console.log('Bookings endpoint - initData content:', initData.substring(0, 100));
        const userData = await verifyInitData(initData);
        if (userData) {
          // Find or create user
          let user = await databaseService.getUserByTelegramId(BigInt(userData.id));
          if (!user) {
            user = await databaseService.createUser({
              telegramId: BigInt(userData.id),
              firstName: userData.first_name,
              lastName: userData.last_name || '',
              username: userData.username || '',
              phoneNumber: ''
            });
          }
          userId = user.id.toString();
        }
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const allBookings = await databaseService.getAllBookings();
    const bookings = allBookings.filter(booking => booking.userId === parseInt(userId));
    
    // Convert BigInt to string for JSON serialization
    const bookingsResponse = bookings.map((booking: any) => ({
      ...booking,
      user: booking.user ? {
        ...booking.user,
        telegramId: booking.user.telegramId.toString(),
        id: booking.user.id.toString()
      } : null,
      trailer: booking.trailer ? {
        ...booking.trailer,
        id: booking.trailer.id.toString(),
        locationId: booking.trailer.locationId?.toString() || null
      } : null
    }));
    
    res.json({
      success: true,
      data: bookingsResponse,
      message: 'Bookings retrieved successfully'
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve bookings'
    });
  }
});

// User profile endpoint
app.get('/api/profile', authenticateToken, async (req: any, res: any) => {
  try {
    let userId = req.user?.userId;
    console.log('Profile endpoint - userId:', userId);
    
    // If no JWT user but we have X-Telegram-Init-Data, try to authenticate
    if (!userId) {
      const initData = req.headers['x-telegram-init-data'];
      console.log('Profile endpoint - initData:', !!initData, 'length:', initData?.length);
      if (initData) {
        console.log('Profile endpoint - initData content:', initData.substring(0, 100));
        const userData = await verifyInitData(initData);
        if (userData) {
          // Find or create user
          let user = await databaseService.getUserByTelegramId(BigInt(userData.id));
          if (!user) {
            user = await databaseService.createUser({
              telegramId: BigInt(userData.id),
              firstName: userData.first_name,
              lastName: userData.last_name || '',
              username: userData.username || '',
              phoneNumber: ''
            });
            // User is already created in database
          }
          userId = user.id.toString();
        }
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const user = await databaseService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Convert BigInt to string for JSON serialization
    const userResponse = {
      ...user,
      telegramId: user.telegramId.toString(),
      id: user.id.toString()
    };

    res.json({
      success: true,
      data: userResponse,
      message: 'Profile retrieved successfully'
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Support Chat API endpoints

// Get all support chats (admin only)
app.get('/api/admin/support/chats', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const chats = await databaseService.getAllSupportChats();
    
    // Convert BigInt to string for JSON serialization
    const chatsResponse = chats.map((chat: any) => ({
      ...chat,
      id: chat.id.toString(),
      userId: chat.userId.toString(),
      user: chat.user ? {
        ...chat.user,
        id: chat.user.id.toString(),
        telegramId: chat.user.telegramId.toString()
      } : null,
      messages: chat.messages ? chat.messages.map((message: any) => ({
        ...message,
        id: message.id.toString(),
        chatId: message.chatId.toString(),
        senderId: message.senderId?.toString() || null
      })) : []
    }));
    
    res.json({ success: true, data: chatsResponse, message: 'Support chats retrieved successfully' });
  } catch (error) {
    console.error('Admin support chats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


// Get specific support chat (admin only)
app.get('/api/admin/support/chats/:id', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const chatId = parseInt(req.params.id);
    const chat = await databaseService.getSupportChat(chatId);
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Support chat not found'
      });
    }

    // Convert BigInt to string for JSON serialization
    const chatResponse = {
      ...chat,
      id: chat.id.toString(),
      userId: chat.userId.toString(),
      user: (chat as any).user ? {
        ...(chat as any).user,
        id: (chat as any).user.id.toString(),
        telegramId: (chat as any).user.telegramId.toString()
      } : null,
      messages: (chat as any).messages ? (chat as any).messages.map((message: any) => ({
        ...message,
        id: message.id.toString(),
        chatId: message.chatId.toString(),
        senderId: message.senderId?.toString() || null
      })) : []
    };
    
    res.json({ success: true, data: chatResponse, message: 'Support chat retrieved successfully' });
  } catch (error) {
    console.error('Admin support chat error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


// Send message to support chat (admin only)
app.post('/api/admin/support/chats/:id/messages', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const chatId = parseInt(req.params.id);
    const { content, attachments } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    const message = await databaseService.createSupportMessage({
      chatId,
      senderId: req.admin!.id,
      senderType: 'ADMIN' as any,
      content,
      attachments: attachments || []
    });

    // Convert BigInt to string for JSON serialization
    const messageResponse = {
      ...message,
      id: message.id.toString(),
      chatId: message.chatId.toString(),
      senderId: message.senderId?.toString() || null
    };

    // Broadcast new message via WebSocket
    broadcastNewMessage(chatId, messageResponse);
    
    res.json({ success: true, data: messageResponse, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Admin send support message error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Mark messages as read (admin only)
app.put('/api/admin/support/chats/:id/read', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const chatId = parseInt(req.params.id);
    await databaseService.markMessagesAsRead(chatId);
    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    console.error('Admin mark messages as read error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get support stats (admin only)
app.get('/api/admin/support/stats', authenticateAdmin, requireAdmin, async (req: AdminRequest, res) => {
  try {
    const stats = await databaseService.getSupportStats();
    res.json({ success: true, data: stats, message: 'Support stats retrieved successfully' });
  } catch (error) {
    console.error('Admin support stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// User Support Chat API endpoints

// Create or get support chat (user)
app.post('/api/support/chats', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = parseInt(req.user?.userId!);
    
    // Check if user already has a support chat
    let chat = await databaseService.getUserSupportChat(userId);
    
    // If no chat exists, create one
    if (!chat) {
      chat = await databaseService.createSupportChat({
        userId
      });
    }

    // Convert BigInt to string for JSON serialization
    const chatResponse = {
      ...(chat as any),
      user: (chat as any).user ? {
        ...(chat as any).user,
        telegramId: (chat as any).user.telegramId.toString(),
        id: (chat as any).user.id.toString()
      } : null,
      messages: (chat as any).messages.map((message: any) => ({
        ...message,
        id: message.id.toString(),
        chatId: message.chatId.toString(),
        senderId: message.senderId?.toString() || null
      }))
    };

    res.json({ success: true, data: chatResponse, message: 'Support chat created successfully' });
  } catch (error) {
    console.error('Create support chat error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user's support chats
app.get('/api/support/chats', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = parseInt(req.user?.userId!);
    const chat = await databaseService.getUserSupportChat(userId);
    
    if (!chat) {
      return res.json({ success: true, data: null, message: 'No support chat found' });
    }
    
    // Convert BigInt to string for JSON serialization
    const chatResponse = {
      ...chat,
      id: chat.id.toString(),
      userId: chat.userId.toString(),
      user: (chat as any).user ? {
        ...(chat as any).user,
        telegramId: (chat as any).user.telegramId.toString(),
        id: (chat as any).user.id.toString()
      } : null,
      messages: (chat as any).messages.map((message: any) => ({
        ...message,
        id: message.id.toString(),
        chatId: message.chatId.toString(),
        senderId: message.senderId?.toString() || null
      }))
    };
    
    res.json({ success: true, data: chatResponse, message: 'Support chat retrieved successfully' });
  } catch (error) {
    console.error('Get user support chats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get specific support chat (user)
app.get('/api/support/chats/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const chatId = parseInt(req.params.id);
    const userId = parseInt(req.user?.userId!);
    
    const chat = await databaseService.getSupportChat(chatId);
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Support chat not found'
      });
    }

    // Check if user owns this chat
    if (chat.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Convert BigInt to string for JSON serialization
    const chatResponse = {
      ...(chat as any),
      user: (chat as any).user ? {
        ...(chat as any).user,
        telegramId: (chat as any).user.telegramId.toString(),
        id: (chat as any).user.id.toString()
      } : null,
      messages: (chat as any).messages.map((message: any) => ({
        ...message,
        id: message.id.toString(),
        chatId: message.chatId.toString(),
        senderId: message.senderId?.toString() || null
      }))
    };

    res.json({ success: true, data: chatResponse, message: 'Support chat retrieved successfully' });
  } catch (error) {
    console.error('Get user support chat error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Send message to support chat (user)
app.post('/api/support/chats/:id/messages', authenticateToken, async (req: any, res: any) => {
  try {
    const chatId = parseInt(req.params.id);
    const userId = parseInt(req.user?.userId!);
    const { content, attachments } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    // Verify user owns this chat
    const chat = await databaseService.getSupportChat(chatId);
    if (!chat || chat.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const message = await databaseService.createSupportMessage({
      chatId,
      senderType: 'USER' as any,
      content,
      attachments: attachments || []
    });

    // Convert BigInt to string for JSON serialization
    const messageResponse = {
      ...message,
      id: message.id.toString(),
      chatId: message.chatId.toString(),
      senderId: message.senderId?.toString() || null
    };

    // Broadcast new message via WebSocket
    broadcastNewMessage(chatId, messageResponse);
    
    res.json({ success: true, data: messageResponse, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Send support message error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Routes
app.use('/api/documents', documentRoutes);
app.use('/api/phone', phoneRoutes);
app.use('/api/photo-comparison', photoComparisonRoutes);
app.use('/api/qr', qrRoutes);

// User management endpoints
app.put('/api/admin/users/:userId/verify', authenticateAdmin, requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { status, comment } = req.body;
    
    if (!status || !['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be VERIFIED or REJECTED'
      });
    }
    
    const user = await databaseService.updateVerificationStatus(
      parseInt(userId), 
      status as any, 
      comment
    );
    
    res.json({
      success: true,
      data: user,
      message: `User ${status === 'VERIFIED' ? 'verified' : 'rejected'} successfully`
    });
  } catch (error) {
    logger.error('Admin user verification error:', error);
    logger.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userId: req.params.userId,
      status: req.body.status
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error: ' + error.message
    });
  }
});

app.get('/api/admin/users/:userId', authenticateAdmin, requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await databaseService.getUser(parseInt(userId));
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: user,
      message: 'User retrieved successfully'
    });
  } catch (error) {
    logger.error('Admin get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/admin/document-verifications', authenticateAdmin, requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    // Get all users with their verification documents
    const users = await databaseService.getAllUsers();
    const verifications = users.map(user => ({
      id: `verification-${user.id}`,
      userId: user.id.toString(),
      status: user.verificationStatus === 'PENDING' ? 'PENDING_MODERATION' : 
              user.verificationStatus === 'VERIFIED' ? 'APPROVED' : 'REJECTED',
      moderatorComment: user.verificationStatus === 'REJECTED' ? 'Отклонено администратором' : undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
    
    res.json({
      success: true,
      data: verifications,
      message: 'Document verifications retrieved successfully'
    });
  } catch (error) {
    logger.error('Admin document verifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

initializeServer();

// WebSocket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    socket.data.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 WebSocket connected: ${socket.data.user?.userId || 'unknown'}`);
  
  // Join support chat room
  socket.on('join-support-chat', (chatId) => {
    socket.join(`support-chat-${chatId}`);
    console.log(`👥 User joined support chat: ${chatId}`);
  });
  
  // Leave support chat room
  socket.on('leave-support-chat', (chatId) => {
    socket.leave(`support-chat-${chatId}`);
    console.log(`👋 User left support chat: ${chatId}`);
  });
  
  // Handle typing indicators
  socket.on('typing-start', (data) => {
    console.log(`⌨️ User started typing in chat: ${data.chatId}`);
    // Broadcast typing start to other participants in the chat
    socket.to(`support-chat-${data.chatId}`).emit('typing-start', data);
  });
  
  socket.on('typing-stop', (data) => {
    console.log(`⌨️ User stopped typing in chat: ${data.chatId}`);
    // Broadcast typing stop to other participants in the chat
    socket.to(`support-chat-${data.chatId}`).emit('typing-stop', data);
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 WebSocket disconnected: ${socket.data.user?.userId || 'unknown'}`);
  });
});

// Function to broadcast new message to chat participants
const broadcastNewMessage = (chatId: number, message: any) => {
  io.to(`support-chat-${chatId}`).emit('new-message', message);
};

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Production server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Admin login: http://localhost:${PORT}/api/admin/auth/login`);
  console.log(`🔌 WebSocket server ready`);
});

export default app;
