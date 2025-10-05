import { TelegramUser, TelegramThemeParams } from '../types';

export class TelegramService {
  private webApp: any;

  constructor() {
    this.webApp = (window as any).Telegram?.WebApp;
  }

  /**
   * Initialize Telegram WebApp and configure theme
   */
  initialize(): { user?: TelegramUser; initData: string } | null {
    if (!this.webApp) {
      console.warn('Telegram WebApp not available');
      return null;
    }

    // Configure main button
    this.webApp.MainButton.text = 'Продолжить';
    this.webApp.MainButton.color = '#1976d2';

    // Configure back button
    this.webApp.BackButton.onClick(() => {
      this.webApp.close();
    });

    // Expand webapp to fullscreen
    this.webApp.expand();

    return {
      user: this.webApp.initDataUnsafe?.user,
      initData: this.webApp.initData,
    };
  }

  /**
   * Show Telegram main button
   */
  showMainButton(text: string, handler: () => void): void {
    if (!this.webApp) return;

    this.webApp.MainButton.text = text;
    this.webApp.MainButton.show();
    this.webApp.MainButton.onClick(handler);
  }

  /**
   * Hide Telegram main button
   */
  hideMainButton(): void {
    if (!this.webApp) return;
    this.webApp.MainButton.hide();
  }

  /**
   * Enable/disable main button
   */
  setMainButtonState(enabled: boolean): void {
    if (!this.webApp) return;

    if (enabled) {
      this.webApp.MainButton.enable();
    } else {
      this.webApp.MainButton.disable();
    }
  }

  /**
   * Set main button text
   */
  setMainButtonText(text: string): void {
    if (!this.webApp) return;
    this.webApp.MainButton.setText(text);
  }

  /**
   * Show back button
   */
  showBackButton(): void {
    if (!this.webApp) return;
    this.webApp.BackButton.show();
  }

  /**
   * Hide back button
   */
  hideBackButton(): void {
    if (!this.webApp) return;
    this.webApp.BackButton.hide();
  }

  /**
   * Request user contact
   */
  requestContact(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.webApp) {
        resolve(false);
        return;
      }

      try {
        resolve(this.webApp.requestContact());
      } catch (error) {
        console.error('Error requesting contact:', error);
        resolve(false);
      }
    });
  }

  /**
   * Send data back to bot
   */
  sendData(data: string): void {
    if (!this.webApp) return;
    this.webApp.sendData(data);
  }

  /**
   * Close webapp
   */
  close(): void {
    if (!this.webApp) return;
    this.webApp.close();
  }

  /**
   * Get current theme
   */
  getTheme(): TelegramThemeParams {
    return this.webApp?.themeParams || {};
  }

  /**
   * Get color scheme (light/dark)
   */
  getColorScheme(): 'light' | 'dark' {
    return this.webApp?.colorScheme || 'light';
  }

  /**
   * Set header color
   */
  setHeaderColor(color: string): void {
    if (!this.webApp) return;
    this.webApp.setHeaderColor(color);
  }

  /**
   * Set background color
   */
  setBackgroundColor(color: string): void {
    if (!this.webApp) return;
    this.webApp.setBackgroundColor(color);
  }

  /**
   * Check if app is ready
   */
  isReady(): boolean {
    return !!this.webApp && this.webApp.isReady;
  }

  /**
   * Get app version
   */
  getVersion(): string {
    return this.webApp?.version || '6.0+';
  }
}
