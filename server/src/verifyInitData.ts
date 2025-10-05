import crypto from 'crypto';

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

export interface TelegramInitData {
  query_id: string;
  user: TelegramUser;
  auth_date: number;
  hash: string;
}

/**
 * Verifies Telegram WebApp initData using HMAC SHA256
 * @param initData - Raw initData string from Telegram WebApp
 * @returns Parsed user data if valid, null if invalid
 */
export async function verifyInitData(initData: string): Promise<TelegramUser | null> {
  try {
    // Parse initData
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      console.error('No hash found in initData');
      return null;
    }

    // Remove hash from params for verification
    params.delete('hash');
    
    // Sort parameters alphabetically
    const sortedParams = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    
    // Create data check string
    const dataCheckString = sortedParams
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Get bot token from environment
    const botToken = process.env['BOT_TOKEN'];
    if (!botToken) {
      console.error('BOT_TOKEN not found in environment variables');
      return null;
    }

    // Create secret key using WebAppData
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash
    if (calculatedHash !== hash) {
      console.error('Hash verification failed');
      return null;
    }

    // Check auth_date (should be within 24 hours)
    const authDate = params.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate) * 1000; // Convert to milliseconds
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (now - authTimestamp > maxAge) {
        console.error('initData is too old');
        return null;
      }
    }

    // Parse user data
    const userParam = params.get('user');
    if (!userParam) {
      console.error('No user data found in initData');
      return null;
    }

    const userData: TelegramUser = JSON.parse(userParam);
    
    // Validate required fields
    if (!userData.id || !userData.first_name) {
      console.error('Invalid user data: missing required fields');
      return null;
    }

    console.log(`✅ Telegram initData verified for user: ${userData.first_name} (ID: ${userData.id})`);
    return userData;

  } catch (error) {
    console.error('Error verifying initData:', error);
    return null;
  }
}

/**
 * Development mode verification (bypasses HMAC check)
 * @param initData - Raw initData string
 * @returns Mock user data for development
 */
export function verifyInitDataDev(initData: string): TelegramUser | null {
  if (process.env['ALLOW_DEV_AUTH'] !== 'true') {
    return null;
  }

  try {
    const params = new URLSearchParams(initData);
    const userParam = params.get('user');
    
    if (userParam) {
      const userData: TelegramUser = JSON.parse(userParam);
      console.log(`🔧 Dev mode: Using mock user data for ${userData.first_name}`);
      return userData;
    }

    // Return mock data if no user param
    return {
      id: 123456789,
      first_name: 'Dev',
      last_name: 'User',
      username: 'devuser',
      language_code: 'ru',
      is_bot: false,
      is_premium: false
    };

  } catch (error) {
    console.error('Error in dev mode verification:', error);
    return null;
  }
}

/**
 * Simple dev mode verification without initData
 * @returns Mock user data for development
 */
export function getDevUser(): TelegramUser {
  return {
    id: 123456789,
    first_name: 'Dev',
    last_name: 'User',
    username: 'devuser',
    language_code: 'ru',
    is_bot: false,
    is_premium: false
  };
}
