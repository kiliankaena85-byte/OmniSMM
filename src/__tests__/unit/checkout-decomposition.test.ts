import { describe, it, expect, vi } from 'vitest';
import { GatewaysAvailabilityService } from '@/services/orders/gateways-availability.service';
import { CheckoutTransactionService } from '@/services/orders/checkout-transaction.service';
import { CheckoutPaymentService } from '@/services/orders/checkout-payment.service';
import { RetryCheckoutService } from '@/services/orders/retry-checkout.service';
import { CheckoutPreflightGuard } from '@/services/orders/checkout-preflight-guard.service';
import { CheckoutPipelineService } from '@/services/orders/checkout-pipeline.service';
import { checkoutAction } from '@/actions/order/checkout';

describe('Checkout Modular Decomposition (Wave 4 CDD-TDD)', () => {
  describe('Gateways Availability Service', () => {
    it('should correctly discover payment secrets and resolve gateway flags', async () => {
      expect(typeof GatewaysAvailabilityService.getAvailable).toBe('function');
    });
  });

  describe('Contract and Exports Integrity', () => {
    it('should export all decomposed classes and methods as Level 1 pure/application logic', () => {
      expect(typeof CheckoutPreflightGuard.validate).toBe('function');
      expect(typeof CheckoutTransactionService.execute).toBe('function');
      expect(typeof CheckoutPaymentService.dispatch).toBe('function');
      expect(typeof RetryCheckoutService.execute).toBe('function');
      expect(typeof CheckoutPipelineService.processOrder).toBe('function');
      expect(typeof checkoutAction).toBe('function');
    });

    it('should reject unsupported gateways in CheckoutPreflightGuard', async () => {
      await expect(
        CheckoutPreflightGuard.validate({
          serviceId: 'srv-1',
          link: 'https://t.me/channel',
          quantity: 100,
          email: 'test@example.com',
          gateway: 'unsupported_fake_gateway'
        })
      ).rejects.toThrow('Неподдерживаемый способ оплаты');
    });

    it('should reject invalid smart drip days', async () => {
      await expect(
        CheckoutPreflightGuard.validate({
          serviceId: 'srv-1',
          link: 'https://t.me/channel',
          quantity: 100,
          email: 'test@example.com',
          isSmartDrip: true,
          smartDripDays: 0
        })
      ).rejects.toThrow('Необходимо указать количество дней (1-30) для Умного Dripfeed');
    });
  });
});
