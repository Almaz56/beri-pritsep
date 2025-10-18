import express from 'express';
import { qrService } from '../services/qrService';
import { databaseService } from '../services/databaseService';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Generate QR code for a location
 * GET /api/qr/location/:locationId
 */
router.get('/location/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;

    const location = await databaseService.getLocation(parseInt(locationId));
    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    const qrResult = await qrService.generateLocationQR(locationId, location.name);

    res.json({
      success: true,
      data: {
        locationId,
        locationName: location.name,
        qrCode: qrResult.dataUrl,
        url: qrResult.url,
        type: 'LOCATION'
      },
      message: 'QR code generated successfully'
    });

  } catch (error) {
    logger.error('Location QR generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate location QR code'
    });
  }
});

/**
 * Generate QR code for a trailer
 * GET /api/qr/trailer/:trailerId
 */
router.get('/trailer/:trailerId', async (req, res) => {
  try {
    const { trailerId } = req.params;

    const trailer = await databaseService.getTrailer(parseInt(trailerId));
    if (!trailer) {
      return res.status(404).json({
        success: false,
        error: 'Trailer not found'
      });
    }

    const qrResult = await qrService.generateTrailerQR(trailerId, trailer.name);

    res.json({
      success: true,
      data: {
        trailerId,
        trailerName: trailer.name,
        qrCode: qrResult.dataUrl,
        url: qrResult.url,
        type: 'TRAILER'
      },
      message: 'QR code generated successfully'
    });

  } catch (error) {
    logger.error('Trailer QR generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate trailer QR code'
    });
  }
});

/**
 * Generate QR code for custom data
 * POST /api/qr/custom
 */
router.post('/custom', async (req, res) => {
  try {
    const { data, options } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing data parameter'
      });
    }

    const qrResult = await qrService.generateCustomQR(data, options);

    res.json({
      success: true,
      data: {
        qrCode: qrResult.dataUrl,
        url: qrResult.url,
        type: 'CUSTOM'
      },
      message: 'Custom QR code generated successfully'
    });

  } catch (error) {
    logger.error('Custom QR generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate custom QR code'
    });
  }
});

/**
 * Generate QR code as SVG
 * POST /api/qr/svg
 */
router.post('/svg', async (req, res) => {
  try {
    const { data, options } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing data parameter'
      });
    }

    const svg = await qrService.generateQRSVG(data, options);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);

  } catch (error) {
    logger.error('QR SVG generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate QR SVG'
    });
  }
});

/**
 * Generate QR code as PNG buffer
 * POST /api/qr/png
 */
router.post('/png', async (req, res) => {
  try {
    const { data, options } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing data parameter'
      });
    }

    const buffer = await qrService.generateQRBuffer(data, options);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="qrcode.png"');
    res.send(buffer);

  } catch (error) {
    logger.error('QR PNG generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate QR PNG'
    });
  }
});

/**
 * Generate multiple QR codes for all locations
 * GET /api/qr/locations/all
 */
router.get('/locations/all', async (req, res) => {
  try {
    const locationsList = await databaseService.getAllLocations();
    const locationsForQR = locationsList.map(loc => ({
      id: loc.id.toString(),
      name: loc.name
    }));

    const qrResults = await qrService.generateLocationQRs(locationsForQR);

    res.json({
      success: true,
      data: qrResults,
      message: `Generated ${qrResults.length} location QR codes`
    });

  } catch (error) {
    logger.error('All locations QR generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate location QR codes'
    });
  }
});

/**
 * Generate multiple QR codes for all trailers
 * GET /api/qr/trailers/all
 */
router.get('/trailers/all', async (req, res) => {
  try {
    const trailersList = await databaseService.getAllTrailers();
    const trailersForQR = trailersList.map(trailer => ({
      id: trailer.id.toString(),
      name: trailer.name
    }));

    const qrResults = await qrService.generateTrailerQRs(trailersForQR);

    res.json({
      success: true,
      data: qrResults,
      message: `Generated ${qrResults.length} trailer QR codes`
    });

  } catch (error) {
    logger.error('All trailers QR generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate trailer QR codes'
    });
  }
});

/**
 * Generate QR codes for trailers in a specific location
 * GET /api/qr/location/:locationId/trailers
 */
router.get('/location/:locationId/trailers', async (req, res) => {
  try {
    const { locationId } = req.params;

    const location = await databaseService.getLocation(parseInt(locationId));
    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    const allTrailers = await databaseService.getAllTrailers();
    const trailersList = allTrailers
      .filter(trailer => trailer.locationId === parseInt(locationId))
      .map(trailer => ({
        id: trailer.id.toString(),
        name: trailer.name
      }));

    const qrResults = await qrService.generateTrailerQRs(trailersList);

    res.json({
      success: true,
      data: {
        locationId,
        locationName: location.name,
        trailers: qrResults
      },
      message: `Generated ${qrResults.length} trailer QR codes for location ${location.name}`
    });

  } catch (error) {
    logger.error('Location trailers QR generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate trailer QR codes for location'
    });
  }
});

/**
 * Validate QR code data
 * POST /api/qr/validate
 */
router.post('/validate', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing data parameter'
      });
    }

    const validation = qrService.validateQRData(data);
    const info = qrService.getQRInfo(data);

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        type: info.type,
        id: info.id,
        name: info.name
      },
      message: validation.valid ? 'QR data is valid' : 'QR data is invalid'
    });

  } catch (error) {
    logger.error('QR validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate QR data'
    });
  }
});

export default router;
