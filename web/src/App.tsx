import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import LocationPage from './pages/LocationPage';
import TrailerPage from './pages/TrailerPage';
import ProfilePage from './pages/ProfilePage';
import BookingPage from './pages/BookingPage';
import BookingsPage from './pages/BookingsPage';
import PhotoUploadPage from './pages/PhotoUploadPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import TestPage from './pages/TestPage';
import './styles/App.css';
import NavBar from './components/NavBar';
import './styles/navbar.css';

function App() {
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
                      <Route path="/test" element={<TestPage />} />
        </Routes>
        <NavBar />
      </div>
    </ErrorBoundary>
  );
}

export default App;
