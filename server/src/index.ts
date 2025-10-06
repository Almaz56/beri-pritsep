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
import { photoService } from './services/photoService';
import { chatService } from './services/chatService';
import phoneRoutes from './routes/phone';
import documentRoutes from './routes/documents';
import qrRoutes from './routes/qr';
import photoComparisonRoutes from './routes/photoComparison';
import logger from './utils/logger';
import { 
  users, 
  trailers, 
  locations, 
  bookings, 
  payments,
  photoUploads,
  photoChecks,
  initializeData 
} from './data';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env['PORT'] || 8080;
const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-secret-key';
const ALLOW_DEV_AUTH = process.env['ALLOW_DEV_AUTH'] === 'true';

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env['NODE_ENV'] === 'production' 
    ? ['https://your-webapp-domain.com']
    : ['http://localhost:3000', 'http://localhost:5173'],
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

// Initialize in-memory data
initializeData();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    data: {
      users: users.size,
      trailers: trailers.size,
      bookings: bookings.size,
      payments: payments.size
    }
  });
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
    let user = users.get(userData.id.toString());
    
    if (!user) {
      user = {
        id: userData.id.toString(),
        telegramId: userData.id,
        firstName: userData.first_name,
        lastName: userData.last_name || '',
        username: userData.username || '',
        phoneNumber: '',
        phoneVerificationStatus: 'REQUIRED',
        verificationStatus: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      users.set(user.id, user);
    } else {
      // Update existing user
      user.firstName = userData.first_name;
      user.lastName = userData.last_name || '';
      user.username = userData.username || '';
      user.updatedAt = new Date();
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, telegramId: user.telegramId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          telegramId: user.telegramId,
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

      users.set(user.id, user);

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
app.get('/api/trailers', (req: Request, res: Response) => {
  const locationId = req.query['location_id'] as string;
  
  let trailersList = Array.from(trailers.values());
  
  if (locationId) {
    trailersList = trailersList.filter(trailer => trailer.locationId === locationId);
  }

  res.json({
    success: true,
    data: trailersList,
    message: 'Trailers retrieved successfully'
  });
});

app.get('/api/trailers/:id', (req: Request, res: Response) => {
  const trailerId = req.params['id'];
  const trailer = trailers.get(trailerId);

  if (!trailer) {
    return res.status(404).json({
      success: false,
      error: 'Trailer not found'
    });
  }

  const location = locations.get(trailer.locationId);

  res.json({
    success: true,
    data: {
      ...trailer,
      location
    },
    message: 'Trailer retrieved successfully'
  });
});

// Quote calculation endpoint
app.post('/api/quote', (req: Request, res: Response) => {
  try {
    const { trailerId, startTime, endTime, rentalType, additionalServices } = req.body;

    console.log('Quote request:', { trailerId, startTime, endTime, rentalType, additionalServices });

    if (!trailerId || !startTime || !endTime || !rentalType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: trailerId, startTime, endTime, rentalType'
      });
    }

    const trailer = trailers.get(trailerId);
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
app.post('/api/bookings', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { trailerId, startTime, endTime, rentalType, additionalServices } = req.body;
    const userId = req.user?.id!;

    const trailer = trailers.get(trailerId);
    if (!trailer) {
      return res.status(404).json({
        success: false,
        error: 'Trailer not found'
      });
    }

    // Check availability
    const conflictingBookings = Array.from(bookings.values()).filter(booking => 
      booking.trailerId === trailerId &&
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
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const booking = {
      id: bookingId,
      userId: userId!,
      trailerId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      rentalType,
      additionalServices: additionalServices || {},
      pricing: pricing.pricing,
      totalAmount: pricing.pricing.total,
      depositAmount: pricing.pricing.deposit,
      status: 'PENDING_PAYMENT' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    bookings.set(bookingId, booking);

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
          let user = users.get(userData.id.toString());
          if (!user) {
            user = {
              id: userData.id.toString(),
              telegramId: userData.id,
              firstName: userData.first_name,
              lastName: userData.last_name || '',
              username: userData.username || '',
              phoneNumber: '',
              phoneVerificationStatus: 'REQUIRED',
              verificationStatus: 'PENDING',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            users.set(user.id, user);
          }
          userId = user.id;
        }
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const userBookings = Array.from(bookings.values())
      .filter(booking => booking.userId === userId)
      .map(booking => {
        const trailer = trailers.get(booking.trailerId);
        return {
          ...booking,
          trailer
        };
      });

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
          let user = users.get(userData.id.toString());
          if (!user) {
            user = {
              id: userData.id.toString(),
              telegramId: userData.id,
              firstName: userData.first_name,
              lastName: userData.last_name || '',
              username: userData.username || '',
              phoneNumber: '',
              phoneVerificationStatus: 'REQUIRED',
              verificationStatus: 'PENDING',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            users.set(user.id, user);
          }
          userId = user.id;
        }
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const user = users.get(userId);
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

    const user = users.get(req.user?.id!);
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
      CustomerKey: user.id,
      SuccessURL: `${process.env['FRONTEND_URL'] || 'http://localhost:5173'}/payment/success`,
      FailURL: `${process.env['FRONTEND_URL'] || 'http://localhost:5173'}/payment/fail`,
      NotificationURL: `${process.env['BACKEND_URL'] || 'http://localhost:8080'}/api/payments/webhook`,
      DATA: {
        bookingId,
        paymentType,
        userId: user.id
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

      payments.set(payment.id, payment);

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
    const payment = Array.from(payments.values()).find(p => p.paymentId === PaymentId);
    
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
    const booking = bookings.get(payment.bookingId);
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
    const payment = payments.get(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.userId !== req.user?.id!) {
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
      .find(check => check.bookingId === bookingId && check.type === type);

    let photoCheck;
    if (existingCheck) {
      // Update existing check
      photoUploads.forEach(photo => {
        existingCheck.photos[photo.side] = photo;
      });
      existingCheck.updatedAt = new Date();
      photoCheck = existingCheck;
    } else {
      // Create new check
      photoCheck = photoService.createPhotoCheck(
        bookingId,
        req.user?.id!,
        type as 'CHECK_IN' | 'CHECK_OUT',
        photoUploads
      );
      photoChecks.set(photoCheck.id, photoCheck);
    }

    // Update validation status
    const validation = photoService.validatePhotoCheck(photoUploads);
    photoCheck.status = validation.valid ? 'COMPLETED' : 'MISSING';

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
      .find(check => check.bookingId === bookingId && check.type === type);

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

    const photos = Object.entries(photoCheck.photos).map(([side, photo]) => ({
      side,
      id: photo?.id,
      filename: photo?.filename,
      url: photo ? photoService.getPhotoUrl(photo.filename) : null,
      uploadedAt: photo?.uploadedAt
    }));

    const validation = photoService.validatePhotoCheck(
      Object.values(photoCheck.photos).filter(Boolean) as any[]
    );

    res.json({
      success: true,
      data: {
        photoCheckId: photoCheck.id,
        status: photoCheck.status,
        photos: photos.reduce((acc, photo) => {
          acc[photo.side] = photo;
          return acc;
        }, {} as any),
        missing: validation.valid ? [] : validation.missing,
        createdAt: photoCheck.createdAt,
        updatedAt: photoCheck.updatedAt
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
      .find(check => check.bookingId === photo.bookingId && check.type === photo.type);

    if (photoCheck && photoCheck.photos[photo.side]) {
      delete photoCheck.photos[photo.side];
      photoCheck.updatedAt = new Date();
      
      const remainingPhotos = Object.values(photoCheck.photos).filter(Boolean);
      const validation = photoService.validatePhotoCheck(remainingPhotos as any[]);
      photoCheck.status = validation.valid ? 'COMPLETED' : 'MISSING';
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

// Start server
app.listen(PORT, () => {
  logger.info(`Beri Pritsep API Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
  logger.info(`Dev auth enabled: ${ALLOW_DEV_AUTH}`);
  logger.info(`In-memory data initialized: ${users.size} users, ${trailers.size} trailers`);
});

export default app;
