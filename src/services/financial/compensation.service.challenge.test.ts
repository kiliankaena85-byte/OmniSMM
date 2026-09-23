/**
 * MANDATORY INTEGRITY WARNING:
 * DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompensationService } from './compensation.service';
import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ledgerEntry: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getExchangeRateUSD: vi.fn(),
  },
}));

describe('CompensationService - Adversarial and Edge Case Challenge Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle invalid, negative, or extremely large providerCharge strings', async () => {
    const mockOrder = {
      id: 'order-adv-1',
      status: 'COMPLETED',
      providerCost: BigInt(1000),
      quantity: 1000,
      remains: 0,
      service: { providerCurrency: 'USD' },
    };

    // Case A: Negative charge
    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(SettingsProvider.getExchangeRateUSD).mockResolvedValueOnce(100);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]);
    await CompensationService.trackCompensation('order-adv-1', '-0.05');
    expect(db.order.update).toHaveBeenLastCalledWith({
      where: { id: 'order-adv-1' },
      data: {
        actualProviderCost: BigInt(-500), // -0.05 * 100 * 100
        realMarginDelta: BigInt(1500), // 1000 - 0 - (-500) = 1500
      },
    });

    // Case B: Scientific notation
    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(SettingsProvider.getExchangeRateUSD).mockResolvedValueOnce(100);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]);
    await CompensationService.trackCompensation('order-adv-1', '1.5e-1'); // 0.15 USD
    expect(db.order.update).toHaveBeenLastCalledWith({
      where: { id: 'order-adv-1' },
      data: {
        actualProviderCost: BigInt(1500), // 0.15 * 100 * 100
        realMarginDelta: BigInt(-500), // 1000 - 0 - 1500 = -500
      },
    });

    // Case C: Invalid non-numeric strings (should fall back to full providerCost for COMPLETED status)
    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]);
    await CompensationService.trackCompensation('order-adv-1', 'not-a-number');
    expect(db.order.update).toHaveBeenLastCalledWith({
      where: { id: 'order-adv-1' },
      data: {
        actualProviderCost: BigInt(1000), // fall back to order.providerCost
        realMarginDelta: BigInt(0),
      },
    });

    // Case D: Empty or blank strings (should fall back to full providerCost)
    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]);
    await CompensationService.trackCompensation('order-adv-1', '   ');
    expect(db.order.update).toHaveBeenLastCalledWith({
      where: { id: 'order-adv-1' },
      data: {
        actualProviderCost: BigInt(1000),
        realMarginDelta: BigInt(0),
      },
    });
  });

  it('should fall back to RUB rate (charge * 100) if currency is not USD', async () => {
    const mockOrder = {
      id: 'order-adv-2',
      status: 'COMPLETED',
      providerCost: BigInt(500),
      quantity: 1000,
      remains: 0,
      service: { providerCurrency: 'EUR' }, // Neither USD nor RUB
    };

    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]);

    await CompensationService.trackCompensation('order-adv-2', '2.50');

    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-adv-2' },
      data: {
        actualProviderCost: BigInt(250), // 2.50 * 100 = 250 cents
        realMarginDelta: BigInt(250), // 500 - 0 - 250 = 250 cents
      },
    });
  });

  describe('Proportional fallback edge cases on PARTIAL status', () => {
    it('should handle remains greater than quantity (over-delivery remains/bad state)', async () => {
      const mockOrder = {
        id: 'order-partial-edge-1',
        status: 'PARTIAL',
        providerCost: BigInt(1000),
        quantity: 100,
        remains: 150, // remains > quantity
        service: { providerCurrency: 'RUB' },
      };

      vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
      vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]);

      await CompensationService.trackCompensation('order-partial-edge-1', null);

      expect(db.order.update).toHaveBeenCalledWith({
        where: { id: 'order-partial-edge-1' },
        data: {
          actualProviderCost: BigInt(0), // completedQty = Math.max(0, 100 - 150) = 0
          realMarginDelta: BigInt(1000), // 1000 - 0 - 0 = 1000
        },
      });
    });

    it('should handle negative remains gracefully', async () => {
      const mockOrder = {
        id: 'order-partial-edge-2',
        status: 'PARTIAL',
        providerCost: BigInt(1000),
        quantity: 100,
        remains: -50, // negative remains
        service: { providerCurrency: 'RUB' },
      };

      vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
      vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]);

      await CompensationService.trackCompensation('order-partial-edge-2', null);

      // completedQty = Math.max(0, 100 - (-50)) = 150
      // actualCost = Math.round(1000 * 150 / 100) = 1500
      expect(db.order.update).toHaveBeenCalledWith({
        where: { id: 'order-partial-edge-2' },
        data: {
          actualProviderCost: BigInt(1500),
          realMarginDelta: BigInt(-500), // 1000 - 0 - 1500 = -500
        },
      });
    });

    it('should handle quantity = 0 gracefully to avoid Division by Zero', async () => {
      const mockOrder = {
        id: 'order-partial-edge-3',
        status: 'PARTIAL',
        providerCost: BigInt(1000),
        quantity: 0,
        remains: 10,
        service: { providerCurrency: 'RUB' },
      };

      vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
      vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]);

      await CompensationService.trackCompensation('order-partial-edge-3', null);

      expect(db.order.update).toHaveBeenCalledWith({
        where: { id: 'order-partial-edge-3' },
        data: {
          actualProviderCost: BigInt(0), // Division by zero guard resolves to 0
          realMarginDelta: BigInt(1000),
        },
      });
    });

    it('should handle providerCost = 0 gracefully', async () => {
      const mockOrder = {
        id: 'order-partial-edge-4',
        status: 'PARTIAL',
        providerCost: BigInt(0),
        quantity: 100,
        remains: 30,
        service: { providerCurrency: 'RUB' },
      };

      vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
      vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]);

      await CompensationService.trackCompensation('order-partial-edge-4', null);

      expect(db.order.update).toHaveBeenCalledWith({
        where: { id: 'order-partial-edge-4' },
        data: {
          actualProviderCost: BigInt(0),
          realMarginDelta: BigInt(0),
        },
      });
    });
  });

  it('should bubble up error when SettingsProvider.getExchangeRateUSD throws', async () => {
    const mockOrder = {
      id: 'order-error-1',
      status: 'COMPLETED',
      providerCost: BigInt(1000),
      quantity: 100,
      remains: 0,
      service: { providerCurrency: 'USD' },
    };

    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(SettingsProvider.getExchangeRateUSD).mockRejectedValueOnce(new Error('Settings DB connection failure'));

    await expect(CompensationService.trackCompensation('order-error-1', '2.50')).rejects.toThrow('Settings DB connection failure');
  });

  it('should correctly sum all types of ledger refunds including positive and negative ones', async () => {
    const mockOrder = {
      id: 'order-refunds-1',
      status: 'CANCELED',
      providerCost: BigInt(1000),
      quantity: 100,
      remains: 100,
      service: { providerCurrency: 'RUB' },
    };

    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    // Mimicking a partial refund, a full refund, and then some adjustment ledger entry
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([
      { amount: BigInt(400) },
      { amount: BigInt(600) },
      { amount: BigInt(-200) }, // Negative ledger adjustment
    ] as any);

    await CompensationService.trackCompensation('order-refunds-1', null);

    // totalRefundedCents = 400 + 600 - 200 = 800
    // CANCELED status means actualProviderCost = 0
    // realMarginDelta = 1000 - 800 - 0 = 200
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-refunds-1' },
      data: {
        actualProviderCost: BigInt(0),
        realMarginDelta: BigInt(200),
      },
    });
  });

  it('should query ledger entries matching ticket refunds (endsWith _order_${order.id})', async () => {
    const mockOrder = {
      id: 'order-ticket-1',
      status: 'PARTIAL',
      providerCost: BigInt(1000),
      quantity: 100,
      remains: 50,
      service: { providerCurrency: 'RUB' },
    };

    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]);
    await CompensationService.trackCompensation('order-ticket-1', null);

    expect(db.ledgerEntry.findMany).toHaveBeenLastCalledWith({
      where: {
        OR: [
          { idempotencyKey: { startsWith: 'refund_order-ticket-1_' } },
          { idempotencyKey: { endsWith: '_order_order-ticket-1' } },
          { idempotencyKey: { endsWith: '-order-ticket-1' } }
        ]
      }
    });
  });

  it('should query and sum ledger entries matching refund keys ending with -${order.id}', async () => {
    const mockOrder = {
      id: 'order-dash-refund-1',
      status: 'PARTIAL',
      providerCost: BigInt(1000),
      quantity: 100,
      remains: 50,
      service: { providerCurrency: 'RUB' },
    };

    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([
      { amount: BigInt(150), idempotencyKey: 'refund-ttl-order-dash-refund-1' },
      { amount: BigInt(200), idempotencyKey: 'refund-client-cancel-order-dash-refund-1' },
    ] as any);

    await CompensationService.trackCompensation('order-dash-refund-1', null);

    expect(db.ledgerEntry.findMany).toHaveBeenLastCalledWith({
      where: {
        OR: [
          { idempotencyKey: { startsWith: 'refund_order-dash-refund-1_' } },
          { idempotencyKey: { endsWith: '_order_order-dash-refund-1' } },
          { idempotencyKey: { endsWith: '-order-dash-refund-1' } }
        ]
      }
    });

    expect(db.order.update).toHaveBeenLastCalledWith({
      where: { id: 'order-dash-refund-1' },
      data: {
        actualProviderCost: BigInt(500),
        realMarginDelta: BigInt(150),
      },
    });
  });
});
