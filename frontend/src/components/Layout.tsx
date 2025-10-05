import React, { useState, useEffect } from 'react';
import { TelegramService } from '../services/telegramService';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [theme, setTheme] = useState<any>({});
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const telegramService = new TelegramService();
    const telegramTheme = telegramService.getTheme();
    const scheme = telegramService.getColorScheme();

    setTheme(telegramTheme);
    setColorScheme(scheme);

    // Apply Telegram theme variables
    const root = document.documentElement;
    Object.entries(telegramTheme).forEach(([key, value]) => {
      root.style.setProperty(`--tg-theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, String(value));
    });
  }, []);

  return (
    <div 
      className={`layout ${colorScheme}`}
      style={{
        backgroundColor: theme.bg_color || '#ffffff',
        color: theme.text_color || '#000000',
        minHeight: '100vh',
        padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
      }}
    >
      <header className="app-header">
        <div className="header-content">
          <h1>🚛 Trailer-Go</h1>
          <div className="header-subtitle">Аренда прицепов</div>
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>© 2024 Trailer-Go. Безопасная аренда прицепов.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
