import logger from '../utils/logger';
import { tinkoffService } from './tinkoffService';
import { databaseService } from './databaseService';
import { photoComparisonService } from './photoComparisonService';

export interface DepositRefund {
  id: string;
  bookingId: string;
  userId: string;
  originalPaymentId: string;
  refundAmount: number;
  refundType: 'FULL' | 'PARTIAL' | 'NONE';
  damageAmount?: number;
  reason: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  completedAt?: Date;
}

class DepositService {
  private refunds = new Map<string, DepositRefund>();

  /**
   * Process automatic deposit refund after photo comparison
   */
  async processDepositRefund(bookingId: string): Promise<DepositRefund | null> {
    try {
      logger.info(`Processing deposit refund for booking ${bookingId}`);

      // Get booking details
      const booking = await databaseService.getBooking(parseInt(bookingId));
      if (!booking) {
        logger.error(`Booking ${bookingId} not found`);
        return null;
      }

      // Get deposit payment
      const allPayments = await databaseService.getAllPayments();
      const depositPayment = allPayments.find(p => 
        p.bookingId === parseInt(bookingId) && 
        p.type === 'DEPOSIT_HOLD' && 
        p.status === 'COMPLETED'
      );

      if (!depositPayment) {
        logger.error(`Deposit payment not found for booking ${bookingId}`);
        return null;
      }

      // Get photo comparison results
      const comparisons = await photoComparisonService.getBookingComparisons(bookingId);
      
      if (comparisons.length === 0) {
        logger.warn(`No photo comparisons found for booking ${bookingId}`);
        return null;
      }

      // Analyze damage
      const damageAnalysis = this.analyzeDamage(comparisons);
      
      // Create refund record
      const refund: DepositRefund = {
        id: `refund_${Date.now()}`,
        bookingId: bookingId,
        userId: booking.userId.toString(),
        originalPaymentId: depositPayment.paymentId,
        refundAmount: damageAnalysis.refundAmount,
        refundType: damageAnalysis.refundType,
        damageAmount: damageAnalysis.damageAmount,
        reason: damageAnalysis.reason,
        status: 'PENDING',
        createdAt: new Date()
      };

      this.refunds.set(refund.id, refund);

      // Process refund based on damage analysis
      if (damageAnalysis.refundType === 'FULL') {
        await this.processFullRefund(refund);
      } else if (damageAnalysis.refundType === 'PARTIAL') {
        await this.processPartialRefund(refund);
      } else {
        await this.processNoRefund(refund);
      }

      logger.info(`Deposit refund processed for booking ${bookingId}: ${damageAnalysis.refundType}`);
      return refund;

    } catch (error) {
      logger.error(`Error processing deposit refund for booking ${bookingId}:`, error);
      throw error;
    }
  }

  /**
   * Analyze damage from photo comparisons
   */
  private analyzeDamage(comparisons: any[]): {
    refundType: 'FULL' | 'PARTIAL' | 'NONE';
    refundAmount: number;
    damageAmount?: number;
    reason: string;
  } {
    let totalDamage = 0;
    let hasDamage = false;
    let hasSevereDamage = false;

    for (const comparison of comparisons) {
      if (comparison.comparison.hasDamage) {
        hasDamage = true;
        
        // Calculate damage cost based on severity
        const damageCost = this.calculateDamageCost(comparison.comparison.damageLevel);
        totalDamage += damageCost;

        if (comparison.comparison.damageLevel === 'SEVERE') {
          hasSevereDamage = true;
        }
      }
    }

    const depositAmount = 5000; // Fixed deposit amount

    if (!hasDamage) {
      return {
        refundType: 'FULL',
        refundAmount: depositAmount,
        reason: 'No damage detected - full refund'
      };
    } else if (hasSevereDamage || totalDamage >= depositAmount) {
      return {
        refundType: 'NONE',
        refundAmount: 0,
        damageAmount: totalDamage,
        reason: `Severe damage detected - deposit retained. Damage cost: ${totalDamage}₽`
      };
    } else {
      return {
        refundType: 'PARTIAL',
        refundAmount: depositAmount - totalDamage,
        damageAmount: totalDamage,
        reason: `Minor damage detected - partial refund. Damage cost: ${totalDamage}₽`
      };
    }
  }

  /**
   * Calculate damage cost based on severity level
   */
  private calculateDamageCost(damageLevel: string): number {
    switch (damageLevel) {
      case 'MINOR':
        return 500; // Minor scratches, small dents
      case 'MODERATE':
        return 1500; // Significant damage, multiple issues
      case 'SEVERE':
        return 3000; // Major damage, structural issues
      default:
        return 0;
    }
  }

  /**
   * Process full refund (no damage)
   */
  private async processFullRefund(refund: DepositRefund): Promise<void> {
    try {
      refund.status = 'PROCESSING';
      
      // Release HOLD through Tinkoff
      const result = await tinkoffService.releaseHold(refund.originalPaymentId, refund.refundAmount);
      
      if (result.Success) {
        refund.status = 'COMPLETED';
        refund.completedAt = new Date();
        
        // Update booking status
        const booking = await databaseService.getBooking(parseInt(refund.bookingId));
        if (booking) {
          (booking as any).status = 'COMPLETED';
          (booking as any).updatedAt = new Date();
        }

        logger.info(`Full refund completed for booking ${refund.bookingId}: ${refund.refundAmount}₽`);
      } else {
        refund.status = 'FAILED';
        logger.error(`Full refund failed for booking ${refund.bookingId}:`, result.Message);
      }
    } catch (error) {
      refund.status = 'FAILED';
      logger.error(`Error processing full refund for booking ${refund.bookingId}:`, error);
    }
  }

  /**
   * Process partial refund (minor damage)
   */
  private async processPartialRefund(refund: DepositRefund): Promise<void> {
    try {
      refund.status = 'PROCESSING';
      
      // Release partial HOLD through Tinkoff
      const result = await tinkoffService.releaseHold(refund.originalPaymentId, refund.refundAmount);
      
      if (result.Success) {
        refund.status = 'COMPLETED';
        refund.completedAt = new Date();
        
        // Update booking status
        const booking = await databaseService.getBooking(parseInt(refund.bookingId));
        if (booking) {
          (booking as any).status = 'COMPLETED';
          (booking as any).updatedAt = new Date();
        }

        logger.info(`Partial refund completed for booking ${refund.bookingId}: ${refund.refundAmount}₽ (damage: ${refund.damageAmount}₽)`);
      } else {
        refund.status = 'FAILED';
        logger.error(`Partial refund failed for booking ${refund.bookingId}:`, result.Message);
      }
    } catch (error) {
      refund.status = 'FAILED';
      logger.error(`Error processing partial refund for booking ${refund.bookingId}:`, error);
    }
  }

  /**
   * Process no refund (severe damage)
   */
  private async processNoRefund(refund: DepositRefund): Promise<void> {
    try {
      refund.status = 'PROCESSING';
      
      // Confirm HOLD (no release) through Tinkoff
      const result = await tinkoffService.confirmHold(refund.originalPaymentId);
      
      if (result.Success) {
        refund.status = 'COMPLETED';
        refund.completedAt = new Date();
        
        // Update booking status
        const booking = await databaseService.getBooking(parseInt(refund.bookingId));
        if (booking) {
          (booking as any).status = 'COMPLETED';
          (booking as any).updatedAt = new Date();
        }

        logger.info(`No refund processed for booking ${refund.bookingId} - deposit retained due to damage: ${refund.damageAmount}₽`);
      } else {
        refund.status = 'FAILED';
        logger.error(`No refund processing failed for booking ${refund.bookingId}:`, result.Message);
      }
    } catch (error) {
      refund.status = 'FAILED';
      logger.error(`Error processing no refund for booking ${refund.bookingId}:`, error);
    }
  }

  /**
   * Get refund status for a booking
   */
  getRefundStatus(bookingId: string): DepositRefund | null {
    const refunds = Array.from(this.refunds.values());
    return refunds.find(r => r.bookingId === bookingId) || null;
  }

  /**
   * Get all refunds for a user
   */
  getUserRefunds(userId: string): DepositRefund[] {
    const refunds = Array.from(this.refunds.values());
    return refunds.filter(r => r.userId === userId);
  }

  /**
   * Get all refunds (admin)
   */
  getAllRefunds(): DepositRefund[] {
    return Array.from(this.refunds.values());
  }
}

export const depositService = new DepositService();
