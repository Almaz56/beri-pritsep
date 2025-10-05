import { create } from 'zustand';
import { User, TelegramUser } from '../types';

interface AuthState {
  user: User | null;
  telegramData: TelegramUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setTelegramData: (data: TelegramUser | null) => void;
  setIsLoading: (loading: boolean) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  telegramData: null,
  isLoading: false,
  isAuthenticated: false,
  isVerified: false,

  setUser: (user) => set((state) => ({
    user,
    isAuthenticated: !!user,
    isVerified: user?.verificationStatus === 'VERIFIED'
  })),

  setTelegramData: (data) => set({ telegramData: data }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  logout: () => set({
    user: null,
    telegramData: null,
    isAuthenticated: false,
    isVerified: false
  }),

  updateUser: (updates) => set((state) => ({
    user: state.user ? { ...state.user, ...updates } : null
  })),
}));
