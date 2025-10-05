// API client for Admin Panel
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Trailer {
  id: string;
  name: string;
  description: string;
  photos: string[];
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  capacity: number;
  hasTent: boolean;
  axles: number;
  brakeType: string;
  weight: number;
  locationId: string;
  location?: Location;
  pricing: {
    minHours: number;
    minCost: number;
    hourPrice: number;
    dayPrice: number;
    deposit: number;
    pickupPrice: number;
  };
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
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

  async getLocation(locationId: string): Promise<ApiResponse<Location>> {
    const response = await fetch(`${API_BASE_URL}/locations/${locationId}`);
    return response.json();
  },

  async createLocation(location: Partial<Location>): Promise<ApiResponse<Location>> {
    const response = await fetch(`${API_BASE_URL}/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(location),
    });
    return response.json();
  },

  async updateLocation(locationId: string, updates: Partial<Location>): Promise<ApiResponse<Location>> {
    const response = await fetch(`${API_BASE_URL}/locations/${locationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    return response.json();
  },

  async deleteLocation(locationId: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/locations/${locationId}`, {
      method: 'DELETE',
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
