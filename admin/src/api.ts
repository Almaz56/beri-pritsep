// API client for Admin Panel
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 
  (window.location.hostname === 'admin.beripritsep.ru' 
    ? 'https://api.beripritsep.ru/api' 
    : 'http://localhost:8080/api');

// Helper function to get auth headers
const getAuthHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Trailer {
  id: number;
  name: string;
  description: string;
  photos: string[];
  capacity: number;
  dailyRate: number;
  minRentalHours: number;
  minRentalPrice: number;
  extraHourPrice: number;
  pickupPrice: number;
  depositAmount: number;
  locationId?: number;
  location?: Location;
  features: string[];
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  photos: string[];
  latitude?: number;
  longitude?: number;
  city: string;
  region: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  type: 'RENTAL' | 'DEPOSIT_HOLD';
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  paymentId: string;
  orderId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoComparison {
  id: string;
  bookingId: string;
  side: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT';
  beforePhotoId: string;
  afterPhotoId: string;
  damageLevel: 'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE';
  damageTypes: string[];
  confidence: number;
  manualReview: boolean;
  moderatorComment?: string;
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
  isUserTyping?: boolean;
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

// Trailers API
export const trailersApi = {
  async getTrailers(): Promise<ApiResponse<Trailer[]>> {
    const response = await fetch(`${API_BASE_URL}/trailers`);
    return response.json();
  },

  async getTrailer(trailerId: string): Promise<ApiResponse<Trailer>> {
    const response = await fetch(`${API_BASE_URL}/trailers/${trailerId}`);
    return response.json();
  },

  async createTrailer(trailer: Partial<Trailer>): Promise<ApiResponse<Trailer>> {
    const response = await fetch(`${API_BASE_URL}/trailers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(trailer),
    });
    return response.json();
  },

  async updateTrailer(trailerId: string, updates: Partial<Trailer>): Promise<ApiResponse<Trailer>> {
    const response = await fetch(`${API_BASE_URL}/trailers/${trailerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    return response.json();
  },

  async deleteTrailer(trailerId: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/trailers/${trailerId}`, {
      method: 'DELETE',
    });
    return response.json();
  },
};

// Locations API
export const locationsApi = {
  async getLocations(): Promise<ApiResponse<Location[]>> {
    const response = await fetch(`${API_BASE_URL}/locations`);
    return response.json();
  },

  async getAdminLocations(token: string): Promise<ApiResponse<Location[]>> {
    const response = await fetch(`${API_BASE_URL}/admin/locations`, {
      headers: getAuthHeaders(token)
    });
    return response.json();
  },

  async getLocation(locationId: number): Promise<ApiResponse<Location>> {
    const response = await fetch(`${API_BASE_URL}/locations/${locationId}`);
    return response.json();
  },

  async createLocation(token: string, location: Partial<Location>): Promise<ApiResponse<Location>> {
    const response = await fetch(`${API_BASE_URL}/admin/locations`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(location),
    });
    return response.json();
  },

  async updateLocation(token: string, locationId: number, updates: Partial<Location>): Promise<ApiResponse<Location>> {
    const response = await fetch(`${API_BASE_URL}/admin/locations/${locationId}`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(updates),
    });
    return response.json();
  },

  async deleteLocation(token: string, locationId: number): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/admin/locations/${locationId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    });
    return response.json();
  },
};

// Users API
export const usersApi = {
  async getUsers(): Promise<ApiResponse<User[]>> {
    const response = await fetch(`${API_BASE_URL}/users`);
    return response.json();
  },

  async getUser(userId: string): Promise<ApiResponse<User>> {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`);
    return response.json();
  },

  async updateUserVerification(userId: string, status: 'VERIFIED' | 'REJECTED', comment?: string): Promise<ApiResponse<User>> {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/verification`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, comment }),
    });
    return response.json();
  },
};

// Bookings API
export const bookingsApi = {
  async getBookings(): Promise<ApiResponse<Booking[]>> {
    const response = await fetch(`${API_BASE_URL}/bookings`);
    return response.json();
  },

  async getBooking(bookingId: string): Promise<ApiResponse<Booking>> {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`);
    return response.json();
  },

  async updateBookingStatus(bookingId: string, status: string): Promise<ApiResponse<Booking>> {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    return response.json();
  },
};

// Payments API
export const paymentsApi = {
  async getPayments(): Promise<ApiResponse<Payment[]>> {
    const response = await fetch(`${API_BASE_URL}/payments`);
    return response.json();
  },

  async getPayment(paymentId: string): Promise<ApiResponse<Payment>> {
    const response = await fetch(`${API_BASE_URL}/payments/${paymentId}`);
    return response.json();
  },
};

// Photo Comparison API
export const photoComparisonApi = {
  async getPhotoComparisons(): Promise<ApiResponse<PhotoComparison[]>> {
    const response = await fetch(`${API_BASE_URL}/photo-comparison`);
    return response.json();
  },

  async getPhotoComparison(comparisonId: string): Promise<ApiResponse<PhotoComparison>> {
    const response = await fetch(`${API_BASE_URL}/photo-comparison/${comparisonId}`);
    return response.json();
  },

  async updatePhotoComparison(comparisonId: string, updates: Partial<PhotoComparison>): Promise<ApiResponse<PhotoComparison>> {
    const response = await fetch(`${API_BASE_URL}/photo-comparison/${comparisonId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    return response.json();
  },
};

// Admin API
export const adminApi = {
  async getStats(token: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/admin/stats`, {
      headers: getAuthHeaders(token)
    });
    return response.json();
  },

  async getUsers(token: string): Promise<ApiResponse<User[]>> {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: getAuthHeaders(token)
    });
    return response.json();
  },

  async getBookings(token: string): Promise<ApiResponse<Booking[]>> {
    const response = await fetch(`${API_BASE_URL}/admin/bookings`, {
      headers: getAuthHeaders(token)
    });
    return response.json();
  },

  async getPayments(token: string): Promise<ApiResponse<Payment[]>> {
    const response = await fetch(`${API_BASE_URL}/admin/payments`, {
      headers: getAuthHeaders(token)
    });
    return response.json();
  },

  // Trailer Management
  async getTrailers(token: string): Promise<ApiResponse<Trailer[]>> {
    const response = await fetch(`${API_BASE_URL}/admin/trailers`, {
      headers: getAuthHeaders(token)
    });
    return response.json();
  },

  async getTrailer(token: string, id: number): Promise<ApiResponse<Trailer>> {
    const response = await fetch(`${API_BASE_URL}/admin/trailers/${id}`, {
      headers: getAuthHeaders(token)
    });
    return response.json();
  },

  async createTrailer(token: string, trailerData: Partial<Trailer>): Promise<ApiResponse<Trailer>> {
    const response = await fetch(`${API_BASE_URL}/admin/trailers`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(trailerData)
    });
    return response.json();
  },

  async updateTrailer(token: string, id: number, trailerData: Partial<Trailer>): Promise<ApiResponse<Trailer>> {
    const response = await fetch(`${API_BASE_URL}/admin/trailers/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(trailerData)
    });
    return response.json();
  },

  async deleteTrailer(token: string, id: number): Promise<ApiResponse<void>> {
    const response = await fetch(`${API_BASE_URL}/admin/trailers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(token)
    });
    return response.json();
  },

  async uploadTrailerPhotos(token: string, trailerId: number, photos: File[]): Promise<ApiResponse<{trailer: Trailer, uploadedPhotos: string[]}>> {
    const formData = new FormData();
    photos.forEach(photo => {
      formData.append('photos', photo);
    });

    const response = await fetch(`${API_BASE_URL}/admin/trailers/${trailerId}/photos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    return response.json();
  },

  async updateTrailerPhotos(token: string, trailerId: number, photos: string[]): Promise<ApiResponse<Trailer>> {
    const response = await fetch(`${API_BASE_URL}/admin/trailers/${trailerId}/photos`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ photos })
    });
    return response.json();
  },
};

// QR Code API
export const qrApi = {
  async generateLocationQR(locationId: string): Promise<ApiResponse<{ qrCode: string; url: string }>> {
    const response = await fetch(`${API_BASE_URL}/qr/location/${locationId}`);
    return response.json();
  },

  async generateTrailerQR(trailerId: string): Promise<ApiResponse<{ qrCode: string; url: string }>> {
    const response = await fetch(`${API_BASE_URL}/qr/trailer/${trailerId}`);
    return response.json();
  },
};

// Support Chat API
export const supportApi = {
  async getSupportChats(token: string): Promise<ApiResponse<SupportChat[]>> {
    const response = await fetch(`${API_BASE_URL}/admin/support/chats`, {
      headers: getAuthHeaders(token)
    });
    return response.json();
  },


  async getSupportChat(token: string, chatId: number): Promise<ApiResponse<SupportChat>> {
    const response = await fetch(`${API_BASE_URL}/admin/support/chats/${chatId}`, {
      headers: getAuthHeaders(token)
    });
    return response.json();
  },


  async sendSupportMessage(token: string, chatId: number, content: string, attachments?: string[]): Promise<ApiResponse<SupportMessage>> {
    const response = await fetch(`${API_BASE_URL}/admin/support/chats/${chatId}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ content, attachments })
    });
    return response.json();
  },

  async markMessagesAsRead(token: string, chatId: number): Promise<ApiResponse<void>> {
    const response = await fetch(`${API_BASE_URL}/admin/support/chats/${chatId}/read`, {
      method: 'PUT',
      headers: getAuthHeaders(token)
    });
    return response.json();
  },

  async getSupportStats(token: string): Promise<ApiResponse<{
    totalChats: number;
    unreadMessages: number;
  }>> {
    const response = await fetch(`${API_BASE_URL}/admin/support/stats`, {
      headers: getAuthHeaders(token)
    });
    return response.json();
  },
};
