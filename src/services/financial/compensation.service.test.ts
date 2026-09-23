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

describe('CompensationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should exit early if order is not found', async () => {
    vi.mocked(db.order.findUnique).mockResolvedValueOnce(null);

    await CompensationService.trackCompensation('missing-id');

    expect(db.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing-id' },
      include: { service: true },
    });
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it('should set actualProviderCost to 0 and calculate realMarginDelta for CANCELED status', async () => {
    const mockOrder = {
      id: 'order-1',
      status: 'CANCELED',
      providerCost: BigInt(500), // 500 cents (5 RUB)
      quantity: 1000,
      remains: 1000,
      service: {
        providerCurrency: 'USD',
      },
    };

    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([
      { amount: BigInt(300) }, // partial refund
      { amount: BigInt(200) }, // final cancel refund
    ] as any);

    await CompensationService.trackCompensation('order-1');

    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        actualProviderCost: BigInt(0),
        realMarginDelta: BigInt(0), // 500 - 500 - 0 = 0
      },
    });
  });

  it('should calculate actualProviderCost from USD charge for COMPLETED status', async () => {
    const mockOrder = {
      id: 'order-2',
      status: 'COMPLETED',
      providerCost: BigInt(400),
      quantity: 1000,
      remains: 0,
      service: {
        providerCurrency: 'USD',
      },
    };

    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(SettingsProvider.getExchangeRateUSD).mockResolvedValueOnce(95);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]); // No refunds

    // Provider charged 0.04 USD
    await CompensationService.trackCompensation('order-2', '0.04');

    const expectedCost = Math.round(0.04 * 95 * 100); // 380 cents
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-2' },
      data: {
        actualProviderCost: BigInt(expectedCost),
        realMarginDelta: BigInt(400 - expectedCost), // 400 - 0 - 380 = 20
      },
    });
  });

  it('should use historical usdToRubRate from order if present instead of SettingsProvider', async () => {
    const mockOrder = {
      id: 'order-2-historical',
      status: 'COMPLETED',
      providerCost: BigInt(400),
      quantity: 1000,
      remains: 0,
      usdToRubRate: 88.5, // Historical rate at checkout
      service: {
        providerCurrency: 'USD',
      },
    };

    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]); // No refunds

    // Provider charged 0.04 USD
    await CompensationService.trackCompensation('order-2-historical', '0.04');

    const expectedCost = Math.round(0.04 * 88.5 * 100); // 354 cents (using 88.5 instead of 95)

    expect(SettingsProvider.getExchangeRateUSD).not.toHaveBeenCalled();
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-2-historical' },
      data: {
        actualProviderCost: BigInt(expectedCost),
        realMarginDelta: BigInt(400 - expectedCost),
      },
    });
  });


  it('should calculate actualProviderCost from RUB charge for COMPLETED status', async () => {
    const mockOrder = {
      id: 'order-3',
      status: 'COMPLETED',
      providerCost: BigInt(400),
      quantity: 1000,
      remains: 0,
      service: {
        providerCurrency: 'RUB',
      },
    };

    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([]); // No refunds

    // Provider charged 3.50 RUB
    await CompensationService.trackCompensation('order-3', '3.50');

    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-3' },
      data: {
        actualProviderCost: BigInt(350),
        realMarginDelta: BigInt(400 - 350), // 400 - 0 - 350 = 50
      },
    });
  });

  it('should fall back to proportional cost calculation on PARTIAL status when charge is missing', async () => {
    const mockOrder = {
      id: 'order-4',
      status: 'PARTIAL',
      providerCost: BigInt(1000), // original cost was 10 RUB (1000 cents)
      quantity: 1000,
      remains: 300, // 700 completed (70%)
      service: {
        providerCurrency: 'USD',
      },
    };

    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([
      { amount: BigInt(300) }, // user refunded 300 cents for undelivered remains
    ] as any);

    // Charge is missing
    await CompensationService.trackCompensation('order-4', null);

    const expectedCost = Math.round(1000 * 700 / 1000); // 700 cents

    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-4' },
      data: {
        actualProviderCost: BigInt(expectedCost),
        realMarginDelta: BigInt(1000 - 300 - expectedCost), // 1000 - 300 - 700 = 0
      },
    });
  });

  it('should fall back to full providerCost on COMPLETED status when charge is missing', async () => {
    const mockOrder = {
      id: 'order-5',
      status: 'COMPLETED',
      providerCost: BigInt(450),
      quantity: 500,
      remains: 0,
      service: {
        providerCurrency: 'USD',
      },
    };

    vi.mocked(db.order.findUnique).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.ledgerEntry.findMany).mockResolvedValueOnce([] as any);

    // Charge is missing
    await CompensationService.trackCompensation('order-5', undefined);

    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-5' },
      data: {
        actualProviderCost: BigInt(450),
        realMarginDelta: BigInt(0), // 450 - 0 - 450 = 0
      },
    });
  });
});
