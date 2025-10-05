// Telegram WebApp типы
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: TelegramUser;
          authDate?: number;
          hash?: string;
        };
        version: string;
        colorScheme: 'light' | 'dark';
        themeParams: TelegramThemeParams;
        
        ready(): void;
        expand(): void;
        close(): void;
        sendData(data: string): void;
        requestContact(): Promise<boolean>;
        
        setHeaderColor(color: string): void;
        setBackgroundColor(color: string): void;
        
        BackButton: {
          show(): void;
          hide(): void;
          onClick(callback: () => void): void;
        };
        
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          
          show(): void;
          hide(): void;
          enable(): void;
          disable(): void;
          setText(text: string): void;
          onClick(callback: () => void): void;
        };
      };
    };
  }
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
}

// Основные типы приложения
export interface User {
  id: number;
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  verificationStatus: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface Trailer {
  id: number;
  name: string;
  description: string;
  locationId: number;
  location: Location;
  photos: string[];
  hourlyRate: number;
  dailyRate: number;
  depositAmount: number;
  status: TrailerStatus;
  features: string[];
  created_at: string;
}

export type TrailerStatus = 'available' | 'rented' | 'maintenance' | 'unavailable';

export interface Location {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  region: string;
}

export interface Booking {
  id: number;
  userId: number;
  trailerId: number;
  user: User;
  trailer: Trailer;
  startTime: string;
  endTime: string;
  rentalType: RentalType;
  totalAmount: number;
  depositAmount: number;
  status: BookingStatus;
  paymentId?: string;
  created_at: string;
}

export type RentalType = 'hourly' | 'daily';

export type BookingStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled' 
  | 'disputed';

export interface Payment {
  id: string;
  bookingId: number;
  userId: number;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  tinkoffPaymentId?: string;
  refundId?: string;
  created_at: string;
}

export type PaymentType = 'rental' | 'deposit' | 'refund';

export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'refunded';

export interface VerificationDocument {
  id: number;
  userId: number;
  documentType: DocumentType;
  fileUrl: string;
  status: DocumentStatus;
  moderatorNotes?: string;
  created_at: string;
}

export type DocumentType = 'passport' | 'driving_license';

export type DocumentStatus = 'pending' | 'approved' | 'rejected';

// API Response типы
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

// Формы типы
export interface BookingFormData {
  trailerId: number;
  startTime: string;
  endTime: string;
  rentalType: RentalType;
}

export interface UserProfileFormData {
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
}

// Store типы
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isVerified: boolean;
  telegramData: TelegramUser | null;
}

export interface BookingState {
  bookings: Booking[];
  currentBooking: Booking | null;
  isLoading: boolean;
}

export interface TrailerState {
  trailers: Trailer[];
  filteredTrailers: Trailer[];
  selectedLocation: Location | null;
  isLoading: boolean;
}
