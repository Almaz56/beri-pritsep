export interface PricingConfig {
  minHours: number;
  minCost: number;
  hourPrice: number;
  dayPrice: number;
  deposit: number;
  pickupPrice: number;
}

export interface AdditionalServices {
  pickup?: boolean;
}

export interface PricingBreakdown {
  baseCost: number;
  additionalCost: number;
  deposit: number;
  total: number;
  breakdown: {
    rental: string;
    pickup?: string;
    deposit: string;
  };
}

export interface PricingResult {
  rentalType: 'HOURLY' | 'DAILY';
  duration: {
    hours: number;
    days: number;
  };
  pricing: PricingBreakdown;
}

// Default pricing configuration
const DEFAULT_PRICING: PricingConfig = {
  minHours: 2,
  minCost: 500,
  hourPrice: 100,
  dayPrice: 900,
  deposit: 5000,
  pickupPrice: 500
};

/**
 * Calculate pricing for trailer rental
 * @param startTime - Start time of rental
 * @param endTime - End time of rental
 * @param rentalType - Type of rental (HOURLY or DAILY)
 * @param additionalServices - Additional services requested
 * @param customPricing - Custom pricing config (optional)
 * @returns Pricing calculation result
 */
export function calculatePricing(
  startTime: Date,
  endTime: Date,
  rentalType: 'HOURLY' | 'DAILY',
  additionalServices: AdditionalServices = {},
  customPricing?: Partial<PricingConfig>
): PricingResult {
  const pricing = { ...DEFAULT_PRICING, ...customPricing };
  
  // Calculate duration
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));
  const durationDays = Math.ceil(durationHours / 24);

  let baseCost = 0;
  let rentalDescription = '';

  if (rentalType === 'HOURLY') {
    // Hourly pricing logic
    if (durationHours <= pricing.minHours) {
      // Minimum rental period
      baseCost = pricing.minCost;
      rentalDescription = `${pricing.minHours} часа (минимум) = ${pricing.minCost}₽`;
    } else {
      // Minimum + additional hours
      const additionalHours = durationHours - pricing.minHours;
      const additionalCost = additionalHours * pricing.hourPrice;
      baseCost = pricing.minCost + additionalCost;
      rentalDescription = `${pricing.minHours} часа (минимум) = ${pricing.minCost}₽ + ${additionalHours} часа × ${pricing.hourPrice}₽ = ${additionalCost}₽`;
    }
  } else {
    // Daily pricing logic
    baseCost = durationDays * pricing.dayPrice;
    rentalDescription = `${durationDays} ${durationDays === 1 ? 'день' : 'дня'} × ${pricing.dayPrice}₽ = ${baseCost}₽`;
  }

  // Calculate additional services cost
  let additionalCost = 0;
  let pickupDescription = '';

  if (additionalServices.pickup) {
    additionalCost = pricing.pickupPrice;
    pickupDescription = `Забор прицепа = ${pricing.pickupPrice}₽`;
  }

  // Calculate total
  const total = baseCost + additionalCost;

  const breakdown: PricingBreakdown = {
    baseCost,
    additionalCost,
    deposit: pricing.deposit,
    total,
    breakdown: {
      rental: rentalDescription,
      deposit: `Залог = ${pricing.deposit}₽`
    }
  };

  // Add pickup to breakdown if applicable
  if (additionalServices.pickup) {
    breakdown.breakdown.pickup = pickupDescription;
  }

  // Ensure all required fields are present
  if (!breakdown.breakdown.rental) {
    breakdown.breakdown.rental = 'Расчет недоступен';
  }
  if (!breakdown.breakdown.deposit) {
    breakdown.breakdown.deposit = `Залог = ${pricing.deposit}₽`;
  }

  return {
    rentalType,
    duration: {
      hours: durationHours,
      days: durationDays
    },
    pricing: breakdown
  };
}

/**
 * Validate rental parameters
 * @param startTime - Start time
 * @param endTime - End time
 * @param rentalType - Rental type
 * @returns Validation result with errors if any
 */
export function validateRentalParams(
  startTime: Date,
  endTime: Date,
  rentalType: 'HOURLY' | 'DAILY'
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if end time is after start time
  if (endTime <= startTime) {
    errors.push('Время окончания должно быть позже времени начала');
  }

  // Check minimum rental period for hourly
  if (rentalType === 'HOURLY') {
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    
    if (durationHours < DEFAULT_PRICING.minHours) {
      errors.push(`Минимальная аренда составляет ${DEFAULT_PRICING.minHours} часа`);
    }
  }

  // Check if rental is not too far in the future (e.g., max 30 days)
  const maxFutureDate = new Date();
  maxFutureDate.setDate(maxFutureDate.getDate() + 30);
  
  if (startTime > maxFutureDate) {
    errors.push('Бронирование возможно максимум на 30 дней вперед');
  }

  // Check if rental is not in the past
  const now = new Date();
  if (startTime < now) {
    errors.push('Время начала аренды не может быть в прошлом');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get pricing configuration for a specific trailer
 * @param trailerId - Trailer ID
 * @returns Pricing configuration
 */
export function getTrailerPricing(trailerId: string): PricingConfig {
  // In a real application, this would fetch from database
  // For now, return default pricing
  return DEFAULT_PRICING;
}
