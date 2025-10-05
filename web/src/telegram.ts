// Telegram WebApp utilities
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_bot?: boolean;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
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
}

/**
 * Get Telegram WebApp instance
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp || null;
}

/**
 * Get Telegram initData
 */
export function getTelegramInitData(): string | null {
  return window.Telegram?.WebApp?.initData || null;
}

/**
 * Get Telegram user data (unsafe - for development only)
 */
export function getTelegramUserUnsafe(): TelegramUser | null {
  return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
}

/**
 * Initialize Telegram WebApp
 */
export function initTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  
  if (webApp) {
    webApp.ready();
    webApp.expand();
    console.log('✅ Telegram WebApp initialized');
  } else {
    console.log('⚠️ Telegram WebApp not available - running in dev mode');
  }
}

/**
 * Request contact from user
 */
export function requestTelegramContact(): Promise<boolean> {
  return new Promise((resolve) => {
    const webApp = getTelegramWebApp();
    
    if (webApp) {
      try {
        webApp.requestContact();
        // Note: In a real implementation, you would listen for a webhook
        // or custom event after the user interacts with the contact request
        resolve(true);
      } catch (error) {
        console.error('Error requesting contact:', error);
        resolve(false);
      }
    } else {
      console.warn('Telegram WebApp not available for contact request');
      resolve(false);
    }
  });
}

/**
 * Show Telegram alert
 */
export function showTelegramAlert(message: string): void {
  try {
    const webApp = getTelegramWebApp();
    
    if (webApp && webApp.showAlert) {
      try {
        webApp.showAlert(message);
      } catch (alertError) {
        console.warn('Telegram showAlert failed, using fallback:', alertError);
        // Fallback for development or unsupported versions
        console.log('Alert:', message);
        alert(message);
      }
    } else {
      // Fallback for development
      console.log('Alert:', message);
      alert(message);
    }
  } catch (error) {
    console.error('Error showing alert:', error);
    // Fallback
    alert(message);
  }
}

/**
 * Show Telegram confirmation dialog
 */
export function showTelegramConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const webApp = getTelegramWebApp();
    
    if (webApp) {
      webApp.showConfirm(message, (confirmed) => {
        resolve(confirmed);
      });
    } else {
      // Fallback for development
      resolve(confirm(message));
    }
  });
}

/**
 * Setup Telegram Main Button
 */
export function setupTelegramMainButton(
  text: string,
  onClick: () => void,
  options: {
    color?: string;
    textColor?: string;
    isActive?: boolean;
  } = {}
): void {
  try {
    const webApp = getTelegramWebApp();
    
    if (webApp && webApp.MainButton) {
      webApp.MainButton.text = text;
      webApp.MainButton.color = options.color || '#2481cc';
      webApp.MainButton.textColor = options.textColor || '#ffffff';
      webApp.MainButton.isActive = options.isActive !== false;
      
      // Remove existing click handlers
      webApp.MainButton.onClick(() => {});
      
      // Add new click handler
      webApp.MainButton.onClick(onClick);
      
      webApp.MainButton.show();
    } else {
      console.log('Telegram MainButton not available, using fallback');
    }
  } catch (error) {
    console.error('Error setting up Telegram MainButton:', error);
  }
}

/**
 * Hide Telegram Main Button
 */
export function hideTelegramMainButton(): void {
  try {
    const webApp = getTelegramWebApp();
    
    if (webApp && webApp.MainButton) {
      webApp.MainButton.hide();
    }
  } catch (error) {
    console.error('Error hiding Telegram MainButton:', error);
  }
}

/**
 * Setup Telegram Back Button
 */
export function setupTelegramBackButton(onClick: () => void): void {
  const webApp = getTelegramWebApp();
  
  if (webApp) {
    // Remove existing click handlers
    webApp.BackButton.onClick(() => {});
    
    // Add new click handler
    webApp.BackButton.onClick(onClick);
    
    webApp.BackButton.show();
  }
}

/**
 * Hide Telegram Back Button
 */
export function hideTelegramBackButton(): void {
  const webApp = getTelegramWebApp();
  
  if (webApp) {
    webApp.BackButton.hide();
  }
}

/**
 * Close Telegram WebApp
 */
export function closeTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  
  if (webApp) {
    webApp.close();
  } else {
    // Fallback for development
    console.log('Would close Telegram WebApp');
  }
}

/**
 * Check if running in Telegram WebApp
 */
export function isTelegramWebApp(): boolean {
  return !!window.Telegram?.WebApp;
}

/**
 * Get current theme (light/dark)
 */
export function getTelegramTheme(): 'light' | 'dark' {
  const webApp = getTelegramWebApp();
  
  if (webApp) {
    // Telegram WebApp provides theme information
    // For now, return light as default
    return 'light';
  }
  
  return 'light';
}
