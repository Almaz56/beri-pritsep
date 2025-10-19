import prisma from '../database';
import { 
  User, 
  Trailer, 
  Location, 
  Booking, 
  Payment, 
  VerificationDocument,
  PhotoCheck,
  PhotoUpload,
  SupportChat,
  SupportMessage,
  VerificationStatus,
  TrailerStatus,
  BookingStatus,
  PaymentStatus,
  DocumentType,
  PhotoCheckType,
  PhotoSide,
  MessageSenderType
} from '@prisma/client';

export class DatabaseService {
  // Initialize database connection
  async initialize(): Promise<void> {
    await prisma.$connect();
    // quick sanity query to ensure connectivity
    await prisma.$queryRaw`SELECT 1`;
  }
  // User operations
  async createUser(userData: {
    telegramId: bigint;
    firstName: string;
    lastName?: string;
    username?: string;
    phoneNumber?: string;
  }): Promise<User> {
    return await prisma.user.create({
      data: {
        telegramId: userData.telegramId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
        phoneNumber: userData.phoneNumber,
        verificationStatus: VerificationStatus.PENDING
      }
    });
  }

  async getUserByTelegramId(telegramId: bigint): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { telegramId }
    });
  }

  async getUserById(userId: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User> {
    return await prisma.user.update({
      where: { id: userId },
      data: updates
    });
  }

  async getAllUsers(): Promise<User[]> {
    return await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  // Trailer operations

  async getTrailer(trailerId: number): Promise<Trailer | null> {
    return await prisma.trailer.findUnique({
      where: { id: trailerId },
      include: { location: true }
    });
  }

  async getAllTrailers(): Promise<Trailer[]> {
    return await prisma.trailer.findMany({
      include: { location: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  // update/delete are implemented below with the new pricing model

  // Location operations
  async createLocation(locationData: {
    name: string;
    address: string;
    photos?: string[];
    latitude?: number;
    longitude?: number;
    city: string;
    region: string;
    description?: string;
  }): Promise<Location> {
    return await prisma.location.create({
      data: {
        name: locationData.name,
        address: locationData.address,
        photos: locationData.photos || [],
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        city: locationData.city,
        region: locationData.region,
        description: locationData.description
      }
    });
  }

  async getAllLocations(): Promise<Location[]> {
    return await prisma.location.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getLocation(id: number): Promise<Location | null> {
    return await prisma.location.findUnique({
      where: { id }
    });
  }

  async updateLocation(id: number, data: {
    name?: string;
    address?: string;
    photos?: string[];
    latitude?: number;
    longitude?: number;
    city?: string;
    region?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<Location | null> {
    return await prisma.location.update({
      where: { id },
      data: {
        name: data.name,
        address: data.address,
        photos: data.photos,
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city,
        region: data.region,
        description: data.description,
        isActive: data.isActive
      }
    });
  }

  async deleteLocation(id: number): Promise<Location | null> {
    return await prisma.location.update({
      where: { id },
      data: { isActive: false }
    });
  }

  // Booking operations
  async createBooking(bookingData: {
    userId: number;
    trailerId: number;
    startTime: Date;
    endTime: Date;
    rentalType: 'HOURLY' | 'DAILY';
    additionalServices: any;
    pricing: any;
    totalAmount: number;
    depositAmount: number;
  }): Promise<Booking> {
    return await prisma.booking.create({
      data: {
        userId: bookingData.userId,
        trailerId: bookingData.trailerId,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        rentalType: bookingData.rentalType as any,
        additionalServices: bookingData.additionalServices,
        pricing: bookingData.pricing,
        totalAmount: bookingData.totalAmount,
        depositAmount: bookingData.depositAmount,
        status: BookingStatus.PENDING_PAYMENT
      },
      include: {
        user: true,
        trailer: {
          include: { location: true }
        }
      }
    });
  }

  async getBooking(bookingId: number): Promise<Booking | null> {
    return await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        trailer: {
          include: { location: true }
        },
        payments: true
      }
    });
  }

  async getAllBookings(): Promise<Booking[]> {
    return await prisma.booking.findMany({
      include: {
        user: true,
        trailer: {
          include: { location: true }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateBookingStatus(bookingId: number, status: BookingStatus): Promise<Booking> {
    return await prisma.booking.update({
      where: { id: bookingId },
      data: { status }
    });
  }

  // Payment operations
  async createPayment(paymentData: {
    bookingId: number;
    userId: number;
    paymentId: string;
    orderId: string;
    amount: number;
    type: 'RENTAL' | 'DEPOSIT_HOLD';
  }): Promise<Payment> {
    return await prisma.payment.create({
      data: {
        bookingId: paymentData.bookingId,
        userId: paymentData.userId,
        paymentId: paymentData.paymentId,
        orderId: paymentData.orderId,
        amount: paymentData.amount,
        type: paymentData.type as any,
        status: PaymentStatus.PENDING
      }
    });
  }

  async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<Payment> {
    return await prisma.payment.update({
      where: { paymentId },
      data: { status }
    });
  }

  async getAllPayments(): Promise<Payment[]> {
    return await prisma.payment.findMany({
      include: {
        user: true,
        booking: {
          include: {
            trailer: {
              include: { location: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Verification Document operations
  async createVerificationDocument(docData: {
    userId: number;
    documentType: DocumentType;
    filename: string;
    filePath: string;
  }): Promise<VerificationDocument> {
    return await prisma.verificationDocument.create({
      data: {
        userId: docData.userId,
        documentType: docData.documentType,
        filename: docData.filename,
        filePath: docData.filePath,
        status: VerificationStatus.PENDING
      }
    });
  }

  async updateVerificationStatus(userId: number, status: VerificationStatus, comment?: string): Promise<User> {
    return await prisma.user.update({
      where: { id: userId },
      data: { 
        verificationStatus: status,
        verificationDocs: {
          updateMany: {
            where: { userId },
            data: { 
              status,
              moderatorComment: comment
            }
          }
        }
      }
    });
  }

  // Statistics
  async getStats() {
    const [
      totalUsers,
      pendingVerifications,
      totalBookings,
      activeBookings,
      totalRevenue,
      pendingPayments,
      totalTrailers,
      availableTrailers,
      totalLocations,
      totalTransactions
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: BookingStatus.ACTIVE } }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.COMPLETED },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.PENDING },
        _sum: { amount: true }
      }),
      prisma.trailer.count(),
      prisma.trailer.count({ where: { status: TrailerStatus.AVAILABLE } }),
      prisma.location.count({ where: { isActive: true } }),
      prisma.payment.count()
    ]);

    return {
      totalUsers,
      pendingVerifications,
      totalBookings,
      activeBookings,
      totalRevenue: totalRevenue._sum.amount || 0,
      pendingPayments: pendingPayments._sum.amount || 0,
      totalTrailers,
      availableTrailers,
      totalLocations,
      totalTransactions
    };
  }

  async getBookingById(bookingId: number): Promise<Booking | null> {
    return await prisma.booking.findUnique({
      where: { id: bookingId }
    });
  }

  async getAllPhotoChecks(): Promise<any[]> {
    return await prisma.photoCheck.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAllPhotoUploads(): Promise<any[]> {
    return await prisma.photoUpload.findMany({
      orderBy: { uploadedAt: 'desc' }
    });
  }

  async createTrailer(data: any): Promise<Trailer> {
    return await prisma.trailer.create({
      data: {
        name: data.name,
        description: data.description,
        capacity: data.capacity,
        dailyRate: data.dailyRate,
        minRentalHours: data.minRentalHours,
        minRentalPrice: data.minRentalPrice,
        extraHourPrice: data.extraHourPrice,
        pickupPrice: data.pickupPrice,
        depositAmount: data.depositAmount,
        locationId: data.locationId ? parseInt(data.locationId) : null,
        features: data.features || [],
        status: data.status || 'AVAILABLE'
      },
      include: { location: true }
    });
  }

  async updateTrailer(id: number, data: any): Promise<Trailer | null> {
    return await prisma.trailer.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        capacity: data.capacity,
        dailyRate: data.dailyRate,
        minRentalHours: data.minRentalHours,
        minRentalPrice: data.minRentalPrice,
        extraHourPrice: data.extraHourPrice,
        pickupPrice: data.pickupPrice,
        depositAmount: data.depositAmount,
        locationId: data.locationId ? parseInt(data.locationId) : null,
        features: data.features,
        status: data.status,
        photos: data.photos,
        dimensions: data.dimensions
      },
      include: { location: true }
    });
  }

  async deleteTrailer(id: number): Promise<boolean> {
    try {
      await prisma.trailer.delete({
        where: { id }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Support Chat operations
  async createSupportChat(data: {
    userId: number;
  }): Promise<SupportChat> {
    return await prisma.supportChat.create({
      data: {
        userId: data.userId
      },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }

  async getSupportChat(chatId: number): Promise<SupportChat | null> {
    return await prisma.supportChat.findUnique({
      where: { id: chatId },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            admin: true
          }
        }
      }
    });
  }

  async getAllSupportChats(): Promise<SupportChat[]> {
    return await prisma.supportChat.findMany({
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });
  }

  async getUserSupportChat(userId: number): Promise<SupportChat | null> {
    return await prisma.supportChat.findFirst({
      where: { userId },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            admin: true
          }
        }
      }
    });
  }

  async createSupportMessage(data: {
    chatId: number;
    senderId?: number;
    senderType: MessageSenderType;
    content: string;
    attachments?: string[];
  }): Promise<SupportMessage> {
    const message = await prisma.supportMessage.create({
      data: {
        chatId: data.chatId,
        senderId: data.senderId,
        senderType: data.senderType,
        content: data.content,
        attachments: data.attachments || []
      },
      include: {
        admin: true
      }
    });

    // Update lastMessageAt in chat
    await prisma.supportChat.update({
      where: { id: data.chatId },
      data: { lastMessageAt: new Date() }
    });

    return message;
  }

  async getSupportMessages(chatId: number): Promise<SupportMessage[]> {
    return await prisma.supportMessage.findMany({
      where: { chatId },
      include: {
        admin: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async markMessagesAsRead(chatId: number): Promise<void> {
    await prisma.supportMessage.updateMany({
      where: { 
        chatId,
        senderType: MessageSenderType.USER
      },
      data: { isRead: true }
    });
  }

  async getSupportStats() {
    const [
      totalChats,
      unreadMessages
    ] = await Promise.all([
      prisma.supportChat.count(),
      prisma.supportMessage.count({ 
        where: { 
          senderType: MessageSenderType.USER,
          isRead: false 
        } 
      })
    ]);

    return {
      totalChats,
      unreadMessages
    };
  }

  async getUser(userId: number): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id: userId }
    });
  }
}

export const databaseService = new DatabaseService();
