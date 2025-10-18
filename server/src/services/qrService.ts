import QRCode from 'qrcode';
import logger from '../utils/logger';

interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

interface QRCodeData {
  type: 'LOCATION' | 'TRAILER';
  id: string;
  name: string;
  url: string;
  timestamp: Date;
}

class QRService {
  private baseUrl: string;
  private defaultOptions: QRCodeOptions;

  constructor() {
    this.baseUrl = process.env['FRONTEND_URL'] || 'https://app.beripritsep.ru';
    this.defaultOptions = {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    };
  }

  /**
   * Generate QR code for a location
   */
  async generateLocationQR(locationId: string, locationName: string): Promise<{ dataUrl: string; url: string }> {
    // Use Telegram Mini App URL format
    const botUsername = process.env['BOT_USERNAME'] || 'beripritsep_bot';
    const url = `https://t.me/${botUsername}?startapp=location_${locationId}`;
    const qrData: QRCodeData = {
      type: 'LOCATION',
      id: locationId,
      name: locationName,
      url,
      timestamp: new Date()
    };

    try {
      const dataUrl = await QRCode.toDataURL(url, this.defaultOptions);
      logger.info(`Generated location QR code for ${locationName} (${locationId})`);
      
      return {
        dataUrl,
        url
      };
    } catch (error) {
      logger.error('Error generating location QR code:', error);
      throw new Error('Failed to generate location QR code');
    }
  }

  /**
   * Generate QR code for a trailer
   */
  async generateTrailerQR(trailerId: string, trailerName: string): Promise<{ dataUrl: string; url: string }> {
    // Use Telegram Mini App URL format
    const botUsername = process.env['BOT_USERNAME'] || 'beripritsep_bot';
    const url = `https://t.me/${botUsername}?startapp=trailer_${trailerId}`;
    const qrData: QRCodeData = {
      type: 'TRAILER',
      id: trailerId,
      name: trailerName,
      url,
      timestamp: new Date()
    };

    try {
      const dataUrl = await QRCode.toDataURL(url, this.defaultOptions);
      logger.info(`Generated trailer QR code for ${trailerName} (${trailerId})`);
      
      return {
        dataUrl,
        url
      };
    } catch (error) {
      logger.error('Error generating trailer QR code:', error);
      throw new Error('Failed to generate trailer QR code');
    }
  }

  /**
   * Generate QR code with custom options
   */
  async generateCustomQR(
    data: string, 
    options: QRCodeOptions = {}
  ): Promise<{ dataUrl: string; url: string }> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      const dataUrl = await QRCode.toDataURL(data, mergedOptions);
      logger.info(`Generated custom QR code for data: ${data.substring(0, 50)}...`);
      
      return {
        dataUrl,
        url: data
      };
    } catch (error) {
      logger.error('Error generating custom QR code:', error);
      throw new Error('Failed to generate custom QR code');
    }
  }

  /**
   * Generate QR code as SVG
   */
  async generateQRSVG(data: string, options: QRCodeOptions = {}): Promise<string> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      const svg = await QRCode.toString(data, { 
        ...mergedOptions, 
        type: 'svg' 
      });
      logger.info(`Generated QR SVG for data: ${data.substring(0, 50)}...`);
      
      return svg;
    } catch (error) {
      logger.error('Error generating QR SVG:', error);
      throw new Error('Failed to generate QR SVG');
    }
  }

  /**
   * Generate QR code as PNG buffer
   */
  async generateQRBuffer(data: string, options: QRCodeOptions = {}): Promise<Buffer> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      const buffer = await QRCode.toBuffer(data, mergedOptions);
      logger.info(`Generated QR buffer for data: ${data.substring(0, 50)}...`);
      
      return buffer;
    } catch (error) {
      logger.error('Error generating QR buffer:', error);
      throw new Error('Failed to generate QR buffer');
    }
  }

  /**
   * Validate QR code data
   */
  validateQRData(data: string): { valid: boolean; type?: 'LOCATION' | 'TRAILER'; id?: string } {
    try {
      // Check if it's a Telegram Mini App location URL
      const locationMatch = data.match(/startapp=location_([^&]+)/);
      if (locationMatch) {
        return {
          valid: true,
          type: 'LOCATION',
          id: locationMatch[1]
        };
      }

      // Check if it's a Telegram Mini App trailer URL
      const trailerMatch = data.match(/startapp=trailer_([^&]+)/);
      if (trailerMatch) {
        return {
          valid: true,
          type: 'TRAILER',
          id: trailerMatch[1]
        };
      }

      // Legacy support for old format
      const legacyLocationMatch = data.match(/\?location_id=([^&]+)/);
      if (legacyLocationMatch) {
        return {
          valid: true,
          type: 'LOCATION',
          id: legacyLocationMatch[1]
        };
      }

      const legacyTrailerMatch = data.match(/\/trailer\/([^?]+)/);
      if (legacyTrailerMatch) {
        return {
          valid: true,
          type: 'TRAILER',
          id: legacyTrailerMatch[1]
        };
      }

      return { valid: false };
    } catch (error) {
      logger.error('Error validating QR data:', error);
      return { valid: false };
    }
  }

  /**
   * Get QR code info from URL
   */
  getQRInfo(url: string): { type: 'LOCATION' | 'TRAILER' | 'UNKNOWN'; id?: string; name?: string } {
    const validation = this.validateQRData(url);
    
    if (!validation.valid) {
      return { type: 'UNKNOWN' };
    }

    return {
      type: validation.type!,
      id: validation.id,
      name: validation.type === 'LOCATION' ? 'Локация' : 'Прицеп'
    };
  }

  /**
   * Generate multiple QR codes for locations
   */
  async generateLocationQRs(locations: Array<{ id: string; name: string }>): Promise<Array<{ id: string; name: string; dataUrl: string; url: string }>> {
    const results = [];
    
    for (const location of locations) {
      try {
        const qr = await this.generateLocationQR(location.id, location.name);
        results.push({
          id: location.id,
          name: location.name,
          ...qr
        });
      } catch (error) {
        logger.error(`Failed to generate QR for location ${location.id}:`, error);
        // Continue with other locations
      }
    }

    return results;
  }

  /**
   * Generate multiple QR codes for trailers
   */
  async generateTrailerQRs(trailers: Array<{ id: string; name: string }>): Promise<Array<{ id: string; name: string; dataUrl: string; url: string }>> {
    const results = [];
    
    for (const trailer of trailers) {
      try {
        const qr = await this.generateTrailerQR(trailer.id, trailer.name);
        results.push({
          id: trailer.id,
          name: trailer.name,
          ...qr
        });
      } catch (error) {
        logger.error(`Failed to generate QR for trailer ${trailer.id}:`, error);
        // Continue with other trailers
      }
    }

    return results;
  }
}

export const qrService = new QRService();
