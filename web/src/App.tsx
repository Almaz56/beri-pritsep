import React, { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import LocationPage from './pages/LocationPage';
import TrailerPage from './pages/TrailerPage';
import ProfilePage from './pages/ProfilePage';
import BookingPage from './pages/BookingPage';
import BookingsPage from './pages/BookingsPage';
import PhotoUploadPage from './pages/PhotoUploadPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import SupportPage from './pages/SupportPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentFailedPage from './pages/PaymentFailedPage';
import MockPaymentPage from './pages/MockPaymentPage';
import TestPage from './pages/TestPage';
import './styles/App.css';
import NavBar from './components/NavBar';
import './styles/navbar.css';

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const startParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (startParam === 'payment_success') {
      navigate('/payment/success');
    } else if (startParam === 'payment_fail') {
      navigate('/payment/failed');
    }
  }, [navigate]);

  return (
    <ErrorBoundary>
      <div className="app app-container">
        <Routes>
          <Route path="/" element={<LocationPage />} />
          <Route path="/trailer/:id" element={
            <ErrorBoundary>
              <TrailerPage />
            </ErrorBoundary>
          } />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/booking" element={
            <ErrorBoundary>
              <BookingPage />
            </ErrorBoundary>
          } />
          <Route path="/bookings" element={
            <ErrorBoundary>
              <BookingsPage />
            </ErrorBoundary>
          } />
          <Route path="/support" element={
            <ErrorBoundary>
              <SupportPage />
            </ErrorBoundary>
          } />
                      <Route path="/photos/:bookingId/:type" element={
                        <ErrorBoundary>
                          <PhotoUploadPage />
                        </ErrorBoundary>
                      } />
                      <Route path="/documents/upload" element={
                        <ErrorBoundary>
                          <DocumentUploadPage />
                        </ErrorBoundary>
                      } />
                      <Route path="/payment/success" element={
                        <ErrorBoundary>
                          <PaymentSuccessPage />
                        </ErrorBoundary>
                      } />
                      <Route path="/payment/failed" element={
                        <ErrorBoundary>
                          <PaymentFailedPage />
                        </ErrorBoundary>
                      } />
          <Route path="/payment/mock" element={
            <ErrorBoundary>
              <MockPaymentPage />
            </ErrorBoundary>
          } />
                      <Route path="/test" element={<TestPage />} />
        </Routes>
        <NavBar />
      </div>
    </ErrorBoundary>
  );
}

export default App;
