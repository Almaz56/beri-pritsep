import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
  user?: {
    id: string;
    telegramId: number;
    firstName: string;
    lastName: string;
    username: string;
  };
}

import { verifyInitData, getDevUser } from './verifyInitData';
import { calculatePricing } from './pricing';
import { tinkoffService } from './services/tinkoffService';
import { depositService } from './services/depositService';
import { photoService } from './services/photoService';
import { chatService } from './services/chatService';
import phoneRoutes from './routes/phone';
import documentRoutes from './routes/documents';
import qrRoutes from './routes/qr';
import photoComparisonRoutes from './routes/photoComparison';
import logger from './utils/logger';
import { databaseService } from './services/databaseService';
import { adminService } from './services/adminService';
import { authenticateAdmin, AdminRequest, requireAdmin } from './middleware/adminAuth';
import { telegramBotService } from './bot/telegramBot';
import { bookings, photoChecks, photoUploads } from './data';
import { photoComparisonService } from './services/photoComparisonService';

// Load environment variables
dotenv.config({ path: '.env' });

const app = express();
const PORT = process.env['PORT'] || 8080;
const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-secret-key';
const ALLOW_DEV_AUTH = process.env['ALLOW_DEV_AUTH'] === 'true';

// Debug environment variables
console.log('🔧 Environment variables loaded:');
console.log('  BOT_TOKEN:', process.env['BOT_TOKEN'] ? '✅ Set' : '❌ Not set');
console.log('  ALLOW_DEV_AUTH:', ALLOW_DEV_AUTH);
console.log('  NODE_ENV:', process.env['NODE_ENV']);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env['NODE_ENV'] === 'production' 
    ? ['https://app.beripritsep.ru', 'https://admin.beripritsep.ru']
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3003'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded photos
app.use('/uploads', express.static(process.env['UPLOAD_PATH'] || './uploads'));

// Phone verification routes
app.use('/api/phone', phoneRoutes);

// Document verification routes
app.use('/api/documents', documentRoutes);

// QR code generation routes
app.use('/api/qr', qrRoutes);

// Photo comparison routes
app.use('/api/photo-comparison', photoComparisonRoutes);

// Initialize database connection
// Database is automatically connected via Prisma client

// Initialize Telegram Bot
telegramBotService.initialize();

// Initialize default admin
adminService.createDefaultAdmin();

// Admin Authentication endpoints
app.post('/api/admin/auth/login', async (req: Request, res: Response) => {
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
    logger.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/admin/auth/me', authenticateAdmin, async (req: AdminRequest, res: Response) => {
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
    logger.error('Admin profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

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

// Auth endpoints
app.post('/api/auth/telegram', async (req: Request, res: Response) => {
  try {
    let { initData } = req.body as any;
    if (!initData) {
      const headerInit = req.header('x-telegram-init-data');
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
          id: user.id.toString(),
          telegramId: user.telegramId.toString(),
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          phoneNumber: user.phoneNumber,
          verificationStatus: user.verificationStatus
        },
        token
      },
      message: 'Authentication successful'
    });

  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Dev auth endpoint (for development without Telegram)
if (ALLOW_DEV_AUTH) {
  app.post('/api/auth/dev', (req: Request, res: Response) => {
    try {
      const { userId = 'dev-user-1' } = req.body;
      
      // Get dev user data
      const devUserData = getDevUser();
      
      const user = {
        id: userId,
        telegramId: devUserData.id,
        firstName: devUserData.first_name,
        lastName: devUserData.last_name || '',
        username: devUserData.username || '',
        phoneNumber: '+7900123456',
        phone: '+7900123456',
        phoneVerificationStatus: 'VERIFIED' as const,
        verificationStatus: 'VERIFIED' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // User is already created in database

      const token = jwt.sign(
        { userId: user.id, telegramId: user.telegramId },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log(`🔧 Dev auth successful for user: ${user.firstName} ${user.lastName}`);

      res.json({
        success: true,
        data: { user, token },
        message: 'Dev authentication successful'
      });
    } catch (error) {
      console.error('Dev auth error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}

// Middleware for JWT authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = decoded;
    next();
  });
};

// Trailers endpoints
app.get('/api/trailers', async (req: Request, res: Response) => {
  try {
    const locationId = req.query['location_id'] as string;
    
    let trailersList = await databaseService.getAllTrailers();
    
    if (locationId) {
      trailersList = trailersList.filter(trailer => trailer.locationId.toString() === locationId);
    }

    res.json({
      success: true,
      data: trailersList,
      message: 'Trailers retrieved successfully'
    });
  } catch (error) {
    logger.error('Trailers error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/trailers/:id', async (req: Request, res: Response) => {
  try {
    const trailerId = parseInt(req.params['id']);
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
    logger.error('Trailer error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Locations endpoints
app.get('/api/locations', async (req: Request, res: Response) => {
  try {
    const locations = await databaseService.getAllLocations();
    res.json({
      success: true,
      data: locations,
      message: 'Locations retrieved successfully'
    });
  } catch (error) {
    logger.error('Locations error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/locations/:id', async (req: Request, res: Response) => {
  try {
    const locationId = parseInt(req.params['id']);
    const location = await databaseService.getLocation(locationId);

    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    res.json({
      success: true,
      data: location,
      message: 'Location retrieved successfully'
    });
  } catch (error) {
    logger.error('Location error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Quote calculation endpoint
app.post('/api/quote', async (req: Request, res: Response) => {
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
      additionalServices || {}
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
app.post('/api/bookings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { trailerId, startTime, endTime, rentalType, additionalServices } = req.body;
    const userId = parseInt(req.user?.id!);

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
      additionalServices || {}
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

app.get('/api/bookings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    let userId = req.user?.id;
    
    // If no JWT user but we have X-Telegram-Init-Data, try to authenticate
    if (!userId) {
      const initData = req.header('x-telegram-init-data');
      if (initData) {
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
    const userBookings = allBookings.filter(booking => booking.userId.toString() === userId);

    res.json({
      success: true,
      data: userBookings,
      message: 'User bookings retrieved successfully'
    });
  } catch (error) {
    console.error('Bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// User profile endpoint
app.get('/api/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    let userId = req.user?.id;
    
    // If no JWT user but we have X-Telegram-Init-Data, try to authenticate
    if (!userId) {
      const initData = req.header('x-telegram-init-data');
      if (initData) {
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

    const user = await databaseService.getUserByTelegramId(BigInt(userId));
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user,
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

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Payment endpoints
app.post('/api/payments/create', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId, paymentType } = req.body; // 'rental' or 'deposit'

    if (!bookingId || !paymentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId, paymentType'
      });
    }

    const booking = bookings.get(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.userId !== req.user?.id!) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const user = await databaseService.getUserByTelegramId(BigInt(req.user?.id!));
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const amount = paymentType === 'rental' ? booking.totalAmount : booking.depositAmount;
    const orderId = `${paymentType}_${bookingId}_${Date.now()}`;
    const description = paymentType === 'rental' 
      ? `Оплата аренды прицепа ${bookingId}`
      : `Залог за прицеп ${bookingId}`;

    const paymentRequest = {
      OrderId: orderId,
      Amount: amount * 100, // Tinkoff expects kopecks
      Description: description,
      CustomerKey: user.id.toString(),
      SuccessURL: `${process.env['FRONTEND_URL'] || 'http://localhost:5173'}/payment/success`,
      FailURL: `${process.env['FRONTEND_URL'] || 'http://localhost:5173'}/payment/fail`,
      NotificationURL: `${process.env['BACKEND_URL'] || 'http://localhost:8080'}/api/payments/webhook`,
      DATA: {
        bookingId,
        paymentType,
        userId: user.id.toString()
      }
    };

    let paymentResponse;
    if (paymentType === 'rental') {
      paymentResponse = await tinkoffService.createPayment(paymentRequest);
    } else {
      paymentResponse = await tinkoffService.createHold(paymentRequest);
    }

    if (paymentResponse.Success && paymentResponse.PaymentId) {
      // Save payment record
      const payment = {
        id: `payment_${Date.now()}`,
        bookingId,
        userId: user.id,
        paymentId: paymentResponse.PaymentId,
        orderId: orderId,
        amount,
        type: paymentType,
        status: 'PENDING' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Payment is already created in database

      logger.info('Payment created:', payment);

      res.json({
        success: true,
        data: {
          paymentId: payment.id,
          tinkoffPaymentId: paymentResponse.PaymentId,
          paymentURL: paymentResponse.PaymentURL,
          amount,
          type: paymentType
        },
        message: 'Payment created successfully'
      });
    } else {
      logger.error('Payment creation failed:', paymentResponse);
      res.status(500).json({
        success: false,
        error: paymentResponse.Message || 'Payment creation failed'
      });
    }

  } catch (error) {
    logger.error('Payment creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Tinkoff webhook endpoint
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const webhookData = JSON.parse(req.body.toString());
    
    logger.info('Received webhook:', webhookData);

    // Verify webhook token
    if (!tinkoffService.verifyWebhookToken(webhookData)) {
      logger.error('Invalid webhook token');
      return res.status(400).json({ success: false, error: 'Invalid token' });
    }

    const { PaymentId, Status, OrderId, Amount } = webhookData;

    // Find payment by Tinkoff PaymentId
    const allPayments = await databaseService.getAllPayments();
    const payment = allPayments.find(p => p.paymentId === PaymentId);
    
    if (!payment) {
      logger.error('Payment not found:', PaymentId);
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Update payment status
    payment.status = Status === 'CONFIRMED' ? 'COMPLETED' : 
                    Status === 'CANCELLED' ? 'CANCELLED' : 
                    Status === 'REJECTED' ? 'FAILED' : 'PENDING';
    payment.updatedAt = new Date();

    // Update booking status
    const booking = await databaseService.getBooking(payment.bookingId);
    if (booking) {
      if (payment.type === 'RENTAL' && payment.status === 'COMPLETED') {
        booking.status = 'PAID';
      } else if (payment.type === 'DEPOSIT_HOLD' && payment.status === 'COMPLETED') {
        booking.status = 'ACTIVE';
      }
      booking.updatedAt = new Date();
    }

    logger.info('Payment status updated:', { paymentId: payment.id, status: payment.status });

    res.json({ success: true });

  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

// Get payment status
app.get('/api/payments/:paymentId/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { paymentId } = req.params as { paymentId: string };
    const allPayments = await databaseService.getAllPayments();
    const payment = allPayments.find(p => p.id.toString() === paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.userId !== parseInt(req.user?.id!)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get fresh status from Tinkoff
    const tinkoffStatus = await tinkoffService.getPaymentStatus(payment.paymentId);
    
    if (tinkoffStatus.Success) {
      payment.status = tinkoffStatus.Status === 'CONFIRMED' ? 'COMPLETED' : 
                      tinkoffStatus.Status === 'CANCELLED' ? 'CANCELLED' : 
                      tinkoffStatus.Status === 'REJECTED' ? 'FAILED' : 'PENDING';
      payment.updatedAt = new Date();
    }

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        type: payment.type,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      }
    });

  } catch (error) {
    logger.error('Payment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user payments
app.get('/api/payments/user/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params as { userId: string };
    
    if (parseInt(userId) !== parseInt(req.user?.id!)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const allPayments = await databaseService.getAllPayments();
    const userPayments = allPayments.filter(p => p.userId === parseInt(userId));

    res.json({
      success: true,
      data: userPayments.map(payment => ({
        id: payment.id,
        bookingId: payment.bookingId,
        amount: payment.amount,
        type: payment.type,
        status: payment.status,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      }))
    });

  } catch (error) {
    logger.error('User payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Photo upload endpoints
app.post('/api/photos/upload', authenticateToken, photoService.getMulterConfig().array('photos', 4), async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId, type, sides } = req.body; // sides: "FRONT,REAR,LEFT,RIGHT"
    const files = req.files as Express.Multer.File[];

    if (!bookingId || !type || !sides || !files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId, type, sides, photos'
      });
    }

    const booking = bookings.get(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.userId !== req.user?.id!) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const sideArray = sides.split(',');
    if (files.length !== sideArray.length) {
      return res.status(400).json({
        success: false,
        error: 'Number of photos must match number of sides'
      });
    }

    const photoUploads = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const side = sideArray[i].trim() as 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT';

      const validation = photoService.validatePhotoUpload(file);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const photoUpload = photoService.createPhotoUpload(
        bookingId,
        req.user?.id!,
        type as 'CHECK_IN' | 'CHECK_OUT',
        side,
        file
      );

      photoUploads.push(photoUpload);
    }

    // Create or update photo check
    const existingCheck = Array.from(photoChecks.values())
      .find(check => (check as any).bookingId === bookingId && (check as any).type === type);

    let photoCheck;
    if (existingCheck) {
      // Update existing check
      photoUploads.forEach(photo => {
        (existingCheck as any).photos[photo.side] = photo;
      });
      (existingCheck as any).updatedAt = new Date();
      photoCheck = existingCheck;
    } else {
      // Create new check
      photoCheck = photoService.createPhotoCheck(
        bookingId,
        req.user?.id!,
        type as 'CHECK_IN' | 'CHECK_OUT',
        photoUploads
      );
      // Photo check is already created in database
    }

    // Update validation status
    const validation = photoService.validatePhotoCheck(photoUploads);
    photoCheck.status = validation.valid ? 'COMPLETED' : 'MISSING';

    // If this is CHECK_OUT photos and validation is complete, trigger deposit refund
    if (type === 'CHECK_OUT' && validation.valid) {
      try {
        // Auto-compare photos first
        await photoComparisonService.autoCompareBooking(bookingId);
        
        // Process deposit refund
        const refund = await depositService.processDepositRefund(bookingId);
        if (refund) {
          logger.info(`Deposit refund initiated for booking ${bookingId}: ${refund.refundType}`);
        }
      } catch (error) {
        logger.error(`Error processing deposit refund for booking ${bookingId}:`, error);
        // Don't fail the photo upload if refund processing fails
      }
    }

    logger.info('Photos uploaded:', { bookingId, type, count: files.length });

    res.json({
      success: true,
      data: {
        photoCheckId: photoCheck.id,
        uploadedPhotos: photoUploads.map(photo => ({
          id: photo.id,
          side: photo.side,
          filename: photo.filename,
          url: photoService.getPhotoUrl(photo.filename)
        })),
        status: photoCheck.status,
        missing: validation.valid ? [] : validation.missing
      },
      message: 'Photos uploaded successfully'
    });

  } catch (error) {
    logger.error('Photo upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Photo upload failed'
    });
  }
});

// Get photo check status
app.get('/api/photos/check/:bookingId/:type', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId, type } = req.params as { bookingId: string; type: string };

    const booking = bookings.get(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.userId !== req.user?.id!) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const photoCheck = Array.from(photoChecks.values())
      .find(check => (check as any).bookingId === bookingId && (check as any).type === type);

    if (!photoCheck) {
      return res.json({
        success: true,
        data: {
          status: 'MISSING',
          photos: {},
          missing: ['FRONT', 'REAR', 'LEFT', 'RIGHT']
        }
      });
    }

    const photos = Object.entries((photoCheck as any).photos).map(([side, photo]) => ({
      side,
      id: (photo as any)?.id,
      filename: (photo as any)?.filename,
      url: photo ? photoService.getPhotoUrl((photo as any).filename) : null,
      uploadedAt: (photo as any)?.uploadedAt
    }));

    const validation = photoService.validatePhotoCheck(
      Object.values((photoCheck as any).photos).filter(Boolean) as any[]
    );

    res.json({
      success: true,
      data: {
        photoCheckId: (photoCheck as any).id,
        status: (photoCheck as any).status,
        photos: photos.reduce((acc, photo) => {
          acc[photo.side] = photo;
          return acc;
        }, {} as any),
        missing: validation.valid ? [] : validation.missing,
        createdAt: (photoCheck as any).createdAt,
        updatedAt: (photoCheck as any).updatedAt
      }
    });

  } catch (error) {
    logger.error('Photo check status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get photo check status'
    });
  }
});

// Delete photo
app.delete('/api/photos/:photoId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { photoId } = req.params as { photoId: string };

    const photo = photoUploads.get(photoId);
    if (!photo) {
      return res.status(404).json({
        success: false,
        error: 'Photo not found'
      });
    }

    if (photo.userId !== req.user?.id!) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Delete file
    const deleted = photoService.deletePhoto(photo.filename);
    if (!deleted) {
      logger.warn(`Photo file not found: ${photo.filename}`);
    }

    // Remove from storage
    photoUploads.delete(photoId);

    // Update photo check
    const photoCheck = Array.from(photoChecks.values())
      .find(check => (check as any).bookingId === photo.bookingId && (check as any).type === photo.type);

    if (photoCheck && (photoCheck as any).photos[photo.side]) {
      delete (photoCheck as any).photos[photo.side];
      (photoCheck as any).updatedAt = new Date();
      
      const remainingPhotos = Object.values((photoCheck as any).photos).filter(Boolean);
      const validation = photoService.validatePhotoCheck(remainingPhotos as any[]);
      (photoCheck as any).status = validation.valid ? 'COMPLETED' : 'MISSING';
    }

    logger.info('Photo deleted:', { photoId, filename: photo.filename });

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });

  } catch (error) {
    logger.error('Photo deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete photo'
    });
  }
});

// Chat endpoints
app.post('/api/chat/sessions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, priority } = req.body;
    
    const session = chatService.createSession(
      req.user?.id,
      subject,
      priority || 'MEDIUM'
    );

    res.json({
      success: true,
      data: session,
      message: 'Chat session created successfully'
    });

  } catch (error) {
    logger.error('Chat session creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat session'
    });
  }
});

app.get('/api/chat/sessions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = chatService.getUserSessions(req.user?.id!);
    
    res.json({
      success: true,
      data: sessions,
      message: 'Chat sessions retrieved successfully'
    });

  } catch (error) {
    logger.error('Chat sessions retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chat sessions'
    });
  }
});

app.get('/api/chat/sessions/:sessionId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const session = chatService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }

    if (session.userId !== req.user?.id!) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: session,
      message: 'Chat session retrieved successfully'
    });

  } catch (error) {
    logger.error('Chat session retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chat session'
    });
  }
});

app.post('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const session = chatService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }

    if (session.userId !== req.user?.id!) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const chatMessage = chatService.addMessage(sessionId, 'USER', message.trim());
    
    res.json({
      success: true,
      data: chatMessage,
      message: 'Message sent successfully'
    });

  } catch (error) {
    logger.error('Chat message sending error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

app.post('/api/chat/sessions/:sessionId/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    
    const success = chatService.markAsRead(sessionId, req.user?.id!);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }

    res.json({
      success: true,
      message: 'Messages marked as read'
    });

  } catch (error) {
    logger.error('Chat read marking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read'
    });
  }
});

app.get('/api/chat/unread-count', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const unreadCount = chatService.getUnreadCount(req.user?.id!);
    
    res.json({
      success: true,
      data: { unreadCount },
      message: 'Unread count retrieved successfully'
    });

  } catch (error) {
    logger.error('Unread count retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve unread count'
    });
  }
});

// Admin chat endpoints
app.get('/api/admin/chat/sessions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // TODO: Add admin role check
    const sessions = chatService.getOpenSessions();
    
    res.json({
      success: true,
      data: sessions,
      message: 'Open chat sessions retrieved successfully'
    });

  } catch (error) {
    logger.error('Admin chat sessions retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chat sessions'
    });
  }
});

app.post('/api/admin/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // TODO: Add admin role check
    const adminId = req.user?.id!;
    
    const chatMessage = chatService.addMessage(sessionId, 'ADMIN', message.trim(), adminId);
    
    res.json({
      success: true,
      data: chatMessage,
      message: 'Admin message sent successfully'
    });

  } catch (error) {
    logger.error('Admin chat message sending error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send admin message'
    });
  }
});

app.post('/api/admin/chat/sessions/:sessionId/assign', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const adminId = req.user?.id!;
    
    const success = chatService.assignAdmin(sessionId, adminId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }

    res.json({
      success: true,
      message: 'Admin assigned to chat session'
    });

  } catch (error) {
    logger.error('Admin assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign admin'
    });
  }
});

app.post('/api/admin/chat/sessions/:sessionId/close', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const adminId = req.user?.id!;
    
    const success = chatService.closeSession(sessionId, adminId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }

    res.json({
      success: true,
      message: 'Chat session closed'
    });

  } catch (error) {
    logger.error('Chat session closing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close chat session'
    });
  }
});

// Admin Authentication endpoints
app.post('/api/admin/auth/login', async (req: Request, res: Response) => {
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
    logger.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/admin/auth/me', authenticateAdmin, async (req: AdminRequest, res: Response) => {
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
    logger.error('Admin profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Admin API endpoints
app.get('/api/admin/users', authenticateAdmin, requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    // TODO: Add admin role check
    const usersList = await databaseService.getAllUsers();
    
    res.json({
      success: true,
      data: usersList,
      message: 'Users retrieved successfully'
    });
  } catch (error) {
    logger.error('Admin users error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/admin/bookings', authenticateAdmin, requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    // TODO: Add admin role check
    const bookingsList = await databaseService.getAllBookings();
    
    res.json({
      success: true,
      data: bookingsList,
      message: 'Bookings retrieved successfully'
    });
  } catch (error) {
    logger.error('Admin bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/admin/payments', authenticateAdmin, requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    // TODO: Add admin role check
    const paymentsList = await databaseService.getAllPayments();
    
    res.json({
      success: true,
      data: paymentsList,
      message: 'Payments retrieved successfully'
    });
  } catch (error) {
    logger.error('Admin payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

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
    res.status(500).json({
      success: false,
      error: 'Internal server error'
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

app.get('/api/admin/stats', authenticateAdmin, requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    // TODO: Add admin role check
    const stats = await databaseService.getStats();
    
    res.json({
      success: true,
      data: stats,
      message: 'Stats retrieved successfully'
    });
  } catch (error) {
    logger.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Deposit refund endpoints
app.get('/api/deposits/refund/:bookingId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.params as { bookingId: string };
    
    // Check if user owns this booking
    const booking = await databaseService.getBooking(parseInt(bookingId));
    if (!booking || booking.userId !== parseInt(req.user?.id!)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const refund = depositService.getRefundStatus(bookingId);
    
    res.json({
      success: true,
      data: refund
    });
  } catch (error) {
    logger.error('Get refund status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/deposits/refunds', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const refunds = depositService.getUserRefunds(req.user?.id!);
    
    res.json({
      success: true,
      data: refunds
    });
  } catch (error) {
    logger.error('Get user refunds error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Admin endpoint for all refunds
app.get('/api/admin/deposits/refunds', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is admin (you might want to add proper admin check)
    const refunds = depositService.getAllRefunds();
    
    res.json({
      success: true,
      data: refunds
    });
  } catch (error) {
    logger.error('Get all refunds error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Start server
app.listen(PORT, async () => {
  logger.info(`Beri Pritsep API Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
  logger.info(`Dev auth enabled: ${ALLOW_DEV_AUTH}`);
  
  try {
    const stats = await databaseService.getStats();
    logger.info(`Database connected: ${stats.totalUsers} users, ${stats.totalTrailers} trailers`);
  } catch (error) {
    logger.error('Failed to connect to database:', error);
  }
});

export default app;
