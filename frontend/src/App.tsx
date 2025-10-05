import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { TelegramService } from './services/telegramService';

// Components
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import CatalogPage from './pages/CatalogPage';
import BookingPage from './pages/BookingPage';
import ProfilePage from './pages/ProfilePage';
import VerificationPage from './pages/VerificationPage';

// Styles
import './styles/App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const { user, setUser, setIsLoading } = useAuthStore();

  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);

      try {
        // Initialize Telegram WebApp
        const telegramService = new TelegramService();
        const telegramData = telegramService.initialize();

        if (telegramData?.user) {
          // Try to authenticate with backend
          const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              initData: telegramData.initData,
            }),
          });

          if (response.ok) {
            const authResult = await response.json();
            if (authResult.success) {
              setUser(authResult.data.user);
            }
          }
        }
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, [setUser, setIsLoading]);

  if (!isInitialized) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">🚛</div>
        <p>Загрузка Trailer-Go...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </Router>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/booking/:trailerId" element={<BookingPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/verification" element={<VerificationPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
