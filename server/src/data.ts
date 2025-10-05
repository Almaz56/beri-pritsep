// In-memory data storage for MVP
export interface User {
  id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  phone?: string;
  phoneVerificationStatus: 'REQUIRED' | 'VERIFIED';
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  workingHours: {
    open: string;
    close: string;
  };
  phone: string;
  description: string;
  qrCode: string;
}

export interface Trailer {
  id: string;
  name: string;
  description: string;
  photos: string[];
  dimensions: {
    length: number; // mm
    width: number;  // mm
    height: number; // mm
  };
  capacity: number; // kg
  hasTent: boolean;
  axles: number;
  brakeType: string;
  weight: number; // kg
  locationId: string;
  pricing: {
    minHours: number;
    minCost: number;
    hourPrice: number;
    dayPrice: number;
    deposit: number;
    pickupPrice: number;
  };
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  userId: string;
  trailerId: string;
  startTime: Date;
  endTime: Date;
  rentalType: 'HOURLY' | 'DAILY';
  additionalServices: {
    pickup: boolean;
  };
  pricing: {
    baseCost: number;
    additionalCost: number;
    deposit: number;
    total: number;
  };
  totalAmount: number;
  depositAmount: number;
  status: 'PENDING_PAYMENT' | 'PAID' | 'ACTIVE' | 'RETURNED' | 'CLOSED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  paymentId: string;
  orderId: string;
  type: 'RENTAL' | 'DEPOSIT_HOLD';
  amount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  tinkoffPaymentId?: string;
  tinkoffHoldId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PhotoUpload {
  id: string;
  bookingId: string;
  userId: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  side: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT';
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export interface PhotoCheck {
  id: string;
  bookingId: string;
  userId: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  photos: {
    FRONT?: PhotoUpload;
    REAR?: PhotoUpload;
    LEFT?: PhotoUpload;
    RIGHT?: PhotoUpload;
  };
  status: 'PENDING' | 'COMPLETED' | 'MISSING';
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage
export const users = new Map<string, User>();
export const locations = new Map<string, Location>();
export const trailers = new Map<string, Trailer>();
export const bookings = new Map<string, Booking>();
export const payments = new Map<string, Payment>();
export const photoUploads = new Map<string, PhotoUpload>();
export const photoChecks = new Map<string, PhotoCheck>();

/**
 * Initialize sample data for development
 */
export function initializeData(): void {
  console.log('🔄 Initializing in-memory data...');

  // Clear existing data
  users.clear();
  locations.clear();
  trailers.clear();
  bookings.clear();
  payments.clear();

  // Sample locations
  const location1: Location = {
    id: 'loc_1',
    name: 'Парковка "Центральная"',
    address: 'г. Москва, ул. Тверская, д. 1',
    coordinates: {
      lat: 55.7558,
      lng: 37.6176
    },
    workingHours: {
      open: '08:00',
      close: '22:00'
    },
    phone: '+7 (495) 123-45-67',
    description: 'Центральная парковка в самом сердце Москвы. Удобное расположение, круглосуточная охрана.',
    qrCode: 'QR_LOC_1_CENTRAL'
  };

  const location2: Location = {
    id: 'loc_2',
    name: 'Терминал "Северный"',
    address: 'г. Москва, Ленинградское ш., д. 100',
    coordinates: {
      lat: 55.8500,
      lng: 37.5000
    },
    workingHours: {
      open: '06:00',
      close: '23:00'
    },
    phone: '+7 (495) 987-65-43',
    description: 'Северный терминал с большим количеством прицепов. Идеально для дальних поездок.',
    qrCode: 'QR_LOC_2_NORTH'
  };

  locations.set(location1.id, location1);
  locations.set(location2.id, location2);

  // Sample trailers
  const trailer1: Trailer = {
    id: 'trailer_1',
    name: 'Прицеп-фургон 2т с тентом',
    description: 'Универсальный прицеп-фургон грузоподъемностью 2000 кг. Оснащен тентом для защиты груза от непогоды. Идеально подходит для перевозки мебели, строительных материалов, товаров.',
    photos: [
      'https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Trailer+1+Front',
      'https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Trailer+1+Side',
      'https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Trailer+1+Rear',
      'https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Trailer+1+Interior'
    ],
    dimensions: {
      length: 4000,
      width: 2000,
      height: 2200
    },
    capacity: 2000,
    hasTent: true,
    axles: 2,
    brakeType: 'Инерционный',
    weight: 800,
    locationId: location1.id,
    pricing: {
      minHours: 2,
      minCost: 500,
      hourPrice: 100,
      dayPrice: 900,
      deposit: 5000,
      pickupPrice: 500
    },
    status: 'AVAILABLE',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const trailer2: Trailer = {
    id: 'trailer_2',
    name: 'Прицеп-платформа 1.5т без тента',
    description: 'Открытая платформа для перевозки крупногабаритных грузов. Отсутствие тента обеспечивает удобство погрузки сверху. Подходит для перевозки техники, стройматериалов, лодок.',
    photos: [
      'https://via.placeholder.com/800x600/7ED321/FFFFFF?text=Trailer+2+Front',
      'https://via.placeholder.com/800x600/7ED321/FFFFFF?text=Trailer+2+Side',
      'https://via.placeholder.com/800x600/7ED321/FFFFFF?text=Trailer+2+Rear',
      'https://via.placeholder.com/800x600/7ED321/FFFFFF?text=Trailer+2+Top'
    ],
    dimensions: {
      length: 3500,
      width: 1800,
      height: 400
    },
    capacity: 1500,
    hasTent: false,
    axles: 1,
    brakeType: 'Инерционный',
    weight: 600,
    locationId: location1.id,
    pricing: {
      minHours: 2,
      minCost: 500,
      hourPrice: 100,
      dayPrice: 900,
      deposit: 5000,
      pickupPrice: 500
    },
    status: 'AVAILABLE',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const trailer3: Trailer = {
    id: 'trailer_3',
    name: 'Прицеп-фургон 3т с тентом',
    description: 'Большой прицеп-фургон повышенной грузоподъемности. Оснащен тентом и дополнительными креплениями. Идеален для коммерческих перевозок и крупных грузов.',
    photos: [
      'https://via.placeholder.com/800x600/F5A623/FFFFFF?text=Trailer+3+Front',
      'https://via.placeholder.com/800x600/F5A623/FFFFFF?text=Trailer+3+Side',
      'https://via.placeholder.com/800x600/F5A623/FFFFFF?text=Trailer+3+Rear',
      'https://via.placeholder.com/800x600/F5A623/FFFFFF?text=Trailer+3+Interior',
      'https://via.placeholder.com/800x600/F5A623/FFFFFF?text=Trailer+3+Details',
      'https://via.placeholder.com/800x600/F5A623/FFFFFF?text=Trailer+3+Loading'
    ],
    dimensions: {
      length: 5000,
      width: 2200,
      height: 2500
    },
    capacity: 3000,
    hasTent: true,
    axles: 2,
    brakeType: 'Пневматический',
    weight: 1200,
    locationId: location2.id,
    pricing: {
      minHours: 2,
      minCost: 500,
      hourPrice: 100,
      dayPrice: 900,
      deposit: 5000,
      pickupPrice: 500
    },
    status: 'AVAILABLE',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  trailers.set(trailer1.id, trailer1);
  trailers.set(trailer2.id, trailer2);
  trailers.set(trailer3.id, trailer3);

  // Sample user for development
  const devUser: User = {
    id: 'user_dev_1',
    telegramId: 123456789,
    firstName: 'Иван',
    lastName: 'Петров',
    username: 'ivan_petrov',
    phoneNumber: '+7 (900) 123-45-67',
    phone: '+7 (900) 123-45-67',
    phoneVerificationStatus: 'VERIFIED',
    verificationStatus: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  users.set(devUser.id, devUser);

  console.log('✅ In-memory data initialized:');
  console.log(`   📍 Locations: ${locations.size}`);
  console.log(`   🚛 Trailers: ${trailers.size}`);
  console.log(`   👤 Users: ${users.size}`);
  console.log(`   📋 Bookings: ${bookings.size}`);
  console.log(`   💳 Payments: ${payments.size}`);
}

/**
 * Get all trailers for a specific location
 */
export function getTrailersByLocation(locationId: string): Trailer[] {
  return Array.from(trailers.values()).filter(trailer => trailer.locationId === locationId);
}

/**
 * Get trailer availability for a specific time period
 */
export function getTrailerAvailability(trailerId: string, startTime: Date, endTime: Date): boolean {
  const trailer = trailers.get(trailerId);
  if (!trailer || trailer.status !== 'AVAILABLE') {
    return false;
  }

  // Check for conflicting bookings
  const conflictingBookings = Array.from(bookings.values()).filter(booking => 
    booking.trailerId === trailerId &&
    booking.status !== 'CLOSED' &&
    booking.status !== 'CANCELLED' &&
    (
      (booking.startTime <= endTime && booking.endTime >= startTime)
    )
  );

  return conflictingBookings.length === 0;
}

/**
 * Create a new booking
 */
export function createBooking(
  userId: string,
  trailerId: string,
  startTime: Date,
  endTime: Date,
  rentalType: 'HOURLY' | 'DAILY',
  additionalServices: { pickup: boolean },
  pricing: { baseCost: number; additionalCost: number; deposit: number; total: number }
): Booking {
  const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const booking: Booking = {
    id: bookingId,
    userId,
    trailerId,
    startTime,
    endTime,
    rentalType,
    additionalServices,
    pricing,
    totalAmount: pricing.total,
    depositAmount: pricing.deposit,
    status: 'PENDING_PAYMENT',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  bookings.set(bookingId, booking);
  return booking;
}

/**
 * Update booking status
 */
export function updateBookingStatus(bookingId: string, status: Booking['status']): boolean {
  const booking = bookings.get(bookingId);
  if (!booking) {
    return false;
  }

  booking.status = status;
  booking.updatedAt = new Date();
  return true;
}

// Document verification interfaces
export interface DocumentUpload {
  id: string;
  userId: string;
  type: 'PASSPORT' | 'DRIVER_LICENSE' | 'OTHER';
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export interface DocumentVerification {
  id: string;
  userId: string;
  documents: {
    passport?: DocumentUpload;
    driverLicense?: DocumentUpload;
  };
  status: 'PENDING_MODERATION' | 'APPROVED' | 'REJECTED';
  moderatorId?: string;
  moderatorComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage for documents
export const documentUploads = new Map<string, DocumentUpload>();
export const documentVerifications = new Map<string, DocumentVerification>();
