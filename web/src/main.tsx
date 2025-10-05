import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/App.css';

// Initialize Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_bot?: boolean;
            is_premium?: boolean;
            photo_url?: string;
          };
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          onClick: (callback: () => void) => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        requestContact: () => void;
        close: () => void;
        showAlert: (message: string) => void;
        showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
      };
    };
  }
}

// Initialize Telegram WebApp if available
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  console.log('✅ Telegram WebApp initialized');
} else {
  console.log('⚠️ Telegram WebApp not available - running in dev mode');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
