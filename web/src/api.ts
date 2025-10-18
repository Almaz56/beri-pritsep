// API client for Trailer-Go backend
// IMPORTANT: base URL WITHOUT trailing "/api"; paths below add "/api/..."
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface User {
  id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
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
  dimensions?: {
    length: number;
    width: number;
    height: number;
  } | null;
  capacity: number;
  dailyRate: number;
  minRentalHours: number;
  minRentalPrice: number;
  extraHourPrice: number;
  pickupPrice: number;
  depositAmount: number;
  features: string[];
  locationId: string | null;
  location?: Location | null;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
  createdAt: string;
  updatedAt: string;
}

export interface PricingBreakdown {
  baseCost: number;
  additionalCost: number;
  deposit: number;
  total: number;
  breakdown: {
    rental: string;
    pickup?: string;
    deposit: string;
  };
}

export interface QuoteRequest {
  trailerId: string;
  startTime: string;
  endTime: string;
  rentalType: 'HOURLY' | 'DAILY';
  additionalServices?: {
    pickup?: boolean;
  };
}

export interface QuoteResponse {
  trailerId: string;
  startTime: string;
  endTime: string;
  rentalType: 'HOURLY' | 'DAILY';
  additionalServices: {
    pickup: boolean;
  };
  pricing: PricingBreakdown;
}

export interface BookingRequest {
  trailerId: string;
  startTime: string;
  endTime: string;
  rentalType: 'HOURLY' | 'DAILY';
  additionalServices?: {
    pickup?: boolean;
  };
}

export interface BookingResponse {
  bookingId: string;
  status: string;
  totalAmount: number;
  depositAmount: number;
}

export interface Booking {
  id: string;
  userId: string;
  trailerId: string;
  startTime: string;
  endTime: string;
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
  status: 'PENDING_PAYMENT' | 'PAID' | 'ACTIVE' | 'RETURNED' | 'CLOSED' | 'CANCELLED';
  trailer?: Trailer;
  createdAt: string;
  updatedAt: string;
}

export interface SupportChat {
  id: number;
  userId: number;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  user: User;
  messages: SupportMessage[];
  isAdminTyping?: boolean;
}

export interface SupportMessage {
  id: number;
  chatId: number;
  senderId?: number;
  senderType: 'USER' | 'ADMIN';
  content: string;
  attachments: string[];
  isRead: boolean;
  createdAt: string;
  admin?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

// Auth API
export const authApi = {
  /**
   * Authenticate with Telegram initData
   */
  async telegramLogin(initData: string): Promise<ApiResponse<{ user: User; token: string }>> {
    const response = await fetch(`${API_BASE_URL}/api/auth/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ initData }),
    });

    return response.json();
  },

  /**
   * Development authentication (for testing without Telegram)
   */
  async devLogin(userId?: string): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/dev`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Dev login error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Get user profile
   */
  async getProfile(token: string | null): Promise<ApiResponse<User>> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const initData = (window as any)?.Telegram?.WebApp?.initData;
    if (!token && initData) headers['X-Telegram-Init-Data'] = initData;
    const response = await fetch(`${API_BASE_URL}/api/profile`, { headers });

    return response.json();
  },
};

// Trailers API
export const trailersApi = {
  /**
   * Get all trailers (optionally filtered by location)
   */
  async getTrailers(locationId?: string): Promise<ApiResponse<Trailer[]>> {
    const url = locationId 
      ? `${API_BASE_URL}/api/trailers?location_id=${locationId}`
      : `${API_BASE_URL}/api/trailers`;
    
    const response = await fetch(url);
    return response.json();
  },

  /**
   * Get trailer by ID
   */
  async getTrailer(trailerId: string): Promise<ApiResponse<Trailer>> {
    const response = await fetch(`${API_BASE_URL}/api/trailers/${trailerId}`);
    return response.json();
  },
};

// Quote API
export const quoteApi = {
  /**
   * Calculate rental quote
   */
  async calculateQuote(request: QuoteRequest): Promise<ApiResponse<QuoteResponse>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Quote calculation error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },
};

// Bookings API
export const bookingsApi = {
  /**
   * Create new booking
   */
  async createBooking(request: BookingRequest, token: string): Promise<ApiResponse<BookingResponse>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Create booking error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Get user bookings
   */
  async getUserBookings(token: string | null): Promise<ApiResponse<Booking[]>> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const initData = (window as any)?.Telegram?.WebApp?.initData;
    if (!token && initData) headers['X-Telegram-Init-Data'] = initData;
    const response = await fetch(`${API_BASE_URL}/api/bookings`, { headers });

    return response.json();
  },
};

// Health check API
export const healthApi = {
  /**
   * Check API health
   */
  async checkHealth(): Promise<ApiResponse<{
    status: string;
    timestamp: string;
    uptime: number;
    memory: any;
    data: {
      users: number;
      trailers: number;
      bookings: number;
      payments: number;
    };
  }>> {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.json();
  },
};

// Utility functions
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('auth_token');
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

// Error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: any): never {
  if (error instanceof ApiError) {
    throw error;
  }

  if (error.response) {
    throw new ApiError(
      error.response.data?.error || 'API request failed',
      error.response.status,
      error.response.data
    );
  }

  throw new ApiError(error.message || 'Network error');
}

// Phone verification API
export const phoneApi = {
  /**
   * Request phone verification through Telegram Bot
   */
  async requestPhone(telegramId: string, userId: string, token: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/phone/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ telegramId, userId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Phone request error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Check phone verification status
   */
  async getPhoneStatus(userId: string, token: string): Promise<ApiResponse<{ phone: string; phoneVerificationStatus: string; isVerified: boolean }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/phone/status/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Phone status check error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Check phone request status
   */
  async getRequestStatus(telegramId: string, token: string): Promise<ApiResponse<{ hasRequest: boolean; request: any }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/phone/request-status/${telegramId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Phone request status check error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  }
};

// Documents API
export const documentsApi = {
  /**
   * Upload document for verification
   */
  async uploadDocument(formData: FormData, token: string): Promise<ApiResponse<{ documentId: string; filename: string; documentType: string; ocrPreview: any; verificationStatus: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Document upload error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Get user's document verification status
   */
  async getDocumentVerification(userId: string, token: string): Promise<ApiResponse<{ hasDocuments: boolean; status: string; documents: any; moderatorComment?: string; createdAt: string; updatedAt: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/verification/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Document verification status error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string, token: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Document deletion error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  }
};

// QR Code API
export const qrApi = {
  /**
   * Generate QR code for a location
   */
  async generateLocationQR(locationId: string, token: string): Promise<ApiResponse<{ locationId: string; locationName: string; qrCode: string; url: string; type: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/qr/location/${locationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Location QR generation error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Generate QR code for a trailer
   */
  async generateTrailerQR(trailerId: string, token: string): Promise<ApiResponse<{ trailerId: string; trailerName: string; qrCode: string; url: string; type: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/qr/trailer/${trailerId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Trailer QR generation error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Generate custom QR code
   */
  async generateCustomQR(data: string, options: any, token: string): Promise<ApiResponse<{ qrCode: string; url: string; type: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/qr/custom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ data, options }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Custom QR generation error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Generate QR codes for all locations
   */
  async generateAllLocationQRs(token: string): Promise<ApiResponse<Array<{ id: string; name: string; dataUrl: string; url: string }>>> {
    try {
      const response = await fetch(`${API_BASE_URL}/qr/locations/all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('All locations QR generation error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Generate QR codes for all trailers
   */
  async generateAllTrailerQRs(token: string): Promise<ApiResponse<Array<{ id: string; name: string; dataUrl: string; url: string }>>> {
    try {
      const response = await fetch(`${API_BASE_URL}/qr/api/trailers/all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('All trailers QR generation error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Generate QR codes for trailers in a location
   */
  async generateLocationTrailerQRs(locationId: string, token: string): Promise<ApiResponse<{ locationId: string; locationName: string; trailers: Array<{ id: string; name: string; dataUrl: string; url: string }> }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/qr/location/${locationId}/api/trailers`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Location trailers QR generation error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Validate QR code data
   */
  async validateQRData(data: string, token: string): Promise<ApiResponse<{ valid: boolean; type: string; id?: string; name?: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/qr/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('QR validation error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  }
};

// Photo Comparison API
export const photoComparisonApi = {
  /**
   * Compare photos for a specific booking and side
   */
  async comparePhotos(
    bookingId: string,
    side: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT',
    beforePhotoId: string,
    afterPhotoId: string,
    options: any,
    token: string
  ): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${API_BASE_URL}/photo-comparison/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId, side, beforePhotoId, afterPhotoId, options }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Photo comparison error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Auto-compare all photos for a booking
   */
  async autoCompareBooking(bookingId: string, token: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/photo-comparison/auto-compare/${bookingId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Auto-comparison error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Get comparison result by ID
   */
  async getComparison(comparisonId: string, token: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${API_BASE_URL}/photo-comparison/${comparisonId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Get comparison error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Get all comparisons for a booking
   */
  async getBookingComparisons(bookingId: string, token: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/photo-comparison/booking/${bookingId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Get booking comparisons error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Get all comparisons with damage
   */
  async getDamageComparisons(token: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/photo-comparison/damage`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Get damage comparisons error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Get comparison statistics
   */
  async getComparisonStats(token: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${API_BASE_URL}/photo-comparison/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Get comparison stats error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Update comparison result
   */
  async updateComparison(comparisonId: string, updates: any, token: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${API_BASE_URL}/photo-comparison/${comparisonId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Update comparison error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Get photos for comparison
   */
  async getPhotosForComparison(bookingId: string, side: string, token: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${API_BASE_URL}/photo-comparison/photos/${bookingId}/${side}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Get photos for comparison error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  }
};

// Support Chat API
export const supportApi = {
  /**
   * Create or get support chat
   */
  async createSupportChat(token: string, data: {}): Promise<ApiResponse<SupportChat>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Create support chat error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Get user's support chat
   */
  async getSupportChats(token: string): Promise<ApiResponse<SupportChat>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/chats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Get support chat error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Get specific support chat
   */
  async getSupportChat(chatId: number, token: string): Promise<ApiResponse<SupportChat>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/chats/${chatId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Get support chat error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  /**
   * Send message to support chat
   */
  async sendSupportMessage(chatId: number, content: string, attachments: string[], token: string): Promise<ApiResponse<SupportMessage>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content, attachments }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Send support message error:', error);
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },
};
