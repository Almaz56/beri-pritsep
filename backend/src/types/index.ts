// Telegram API types
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramInitData {
  query_id: string;
  user?: TelegramUser;
  auth_date: number;
  hash: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Database enum types
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type TrailerStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'UNAVAILABLE';
export type RentalType = 'HOURLY' | 'DAILY';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
export type PaymentType = 'RENTAL' | 'DEPOSIT' | 'REFUND';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
export type DocumentType = 'PASSPORT' | 'DRIVING_LICENSE';
export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PhotoType = 'TRAILER_BEFORE' | 'TRAILER_AFTER' | 'INSIDE_BEFORE' | 'INSIDE_AFTER';

// Request body types
export interface CreateBookingRequest {
  trailerId: number;
  startTime: string;
  endTime: string;
  rentalType: RentalType;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export interface TelegramAuthRequest {
  initData: string;
}

export interface UpdatePhoneRequest {
  phoneNumber: string;
}
