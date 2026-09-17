import { describe, it, expect, vi, beforeEach } from 'vitest';
import { accountingService } from './accounting.service';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn(),
    payment: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
    systemSettings: {
      findUnique: vi.fn(),
    },
  },
}));

describe('AccountingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.$queryRaw).mockResolvedValue([{ total: BigInt(0) }]);
  });

  it('calculates standard tax rate (6%) when annual revenue is below 20M RUB', async () => {
    // 1. Mock payment groups (succeeded payments) for selected period
    vi.mocked(db.payment.groupBy).mockResolvedValue([
      {
        gateway: 'yookassa',
        _sum: { amount: BigInt(50000000) }, // 500,000 RUB in cents
      },
    ] as any);

    // 2. Mock aggregate for current calendar year succeeded payments (annual revenue)
    vi.mocked(db.payment.aggregate).mockResolvedValue({
      _sum: { amount: BigInt(1500000000) }, // 15,000,000 RUB (under 20M limit)
    } as any);

    // 3. Mock orders
    vi.mocked(db.order.findMany).mockResolvedValue([]);

    // 4. Mock system settings
    vi.mocked(db.systemSettings.findUnique).mockResolvedValue({
      id: 'global',
      taxRate: 6.0,
      opexMonthly: 100000,
    } as any);

    const metrics = await accountingService.getMetrics();

    expect(metrics.annualRevenue).toBe(1500000000);
    expect(metrics.isVatThresholdExceeded).toBe(false);
    expect(metrics.effectiveTaxRate).toBe(6.0);
    expect(metrics.taxes).toBe(Math.round(metrics.marginGross * 0.06));
  });

  it('calculates elevated tax rate (11%) when annual revenue is exactly or above 20M RUB', async () => {
    // 1. Mock payment groups
    vi.mocked(db.payment.groupBy).mockResolvedValue([
      {
        gateway: 'yookassa',
        _sum: { amount: BigInt(50000000) }, // 500,000 RUB in cents
      },
    ] as any);

    // 2. Mock aggregate for annual revenue to be exactly 20,000,000 RUB (2,000,000,000 cents)
    vi.mocked(db.payment.aggregate).mockResolvedValue({
      _sum: { amount: BigInt(2000000000) },
    } as any);

    // 3. Mock orders
    vi.mocked(db.order.findMany).mockResolvedValue([]);

    // 4. Mock system settings
    vi.mocked(db.systemSettings.findUnique).mockResolvedValue({
      id: 'global',
      taxRate: 6.0,
      opexMonthly: 100000,
    } as any);

    const metrics = await accountingService.getMetrics();

    expect(metrics.annualRevenue).toBe(2000000000);
    expect(metrics.isVatThresholdExceeded).toBe(true);
    expect(metrics.effectiveTaxRate).toBe(11.0);
    expect(metrics.taxes).toBe(Math.round(metrics.marginGross * 0.11));
  });

  it('correctly calculates taxes under INCOME scheme (based on gross revenue)', async () => {
    // 1. Mock payment groups (succeeded payments)
    vi.mocked(db.payment.groupBy).mockResolvedValue([
      {
        gateway: 'yookassa',
        _sum: { amount: BigInt(50000000) }, // 500,000 RUB in cents (gross revenue)
      },
    ] as any);

    // 2. Mock aggregate for current calendar year
    vi.mocked(db.payment.aggregate).mockResolvedValue({
      _sum: { amount: BigInt(1500000000) }, // 15M RUB (under 20M limit)
    } as any);

    // 3. Mock orders
    vi.mocked(db.order.findMany).mockResolvedValue([]);

    // 4. Mock system settings with INCOME scheme and 6% tax rate
    vi.mocked(db.systemSettings.findUnique).mockResolvedValue({
      id: 'global',
      taxRate: 6.0,
      opexMonthly: 500000, // 5,000 RUB in cents
      usnScheme: 'INCOME',
    } as any);

    const metrics = await accountingService.getMetrics();

    // Gross revenue in cents: 50000000
    // Refunds: 0, Gateway fees: 3.5% = 1750000 cents
    // Net revenue: 50000000 - 1750000 = 48250000 cents
    // COGS: 0, Gross margin: 48250000 cents
    // INCOME Tax base: Gross Revenue = 50000000 cents
    // Tax rate: 6%
    // Taxes: 50000000 * 0.06 = 3000000 cents (30,000 RUB)
    // OPEX: 500000 cents (5,000 RUB)
    // Net profit = Gross margin - Taxes - OPEX = 48250000 - 3000000 - 500000 = 44750000 cents
    expect(metrics.revenueGross).toBe(50000000);
    expect(metrics.usnScheme).toBe('INCOME');
    expect(metrics.taxes).toBe(3000000);
    expect(metrics.profitNet).toBe(44750000);
  });

  it('correctly calculates taxes under INCOME_EXPENSES scheme (based on gross margin)', async () => {
    // 1. Mock payment groups
    vi.mocked(db.payment.groupBy).mockResolvedValue([
      {
        gateway: 'yookassa',
        _sum: { amount: BigInt(50000000) }, // 500,000 RUB in cents (gross revenue)
      },
    ] as any);

    // 2. Mock aggregate for current calendar year
    vi.mocked(db.payment.aggregate).mockResolvedValue({
      _sum: { amount: BigInt(1500000000) },
    } as any);

    // 3. Mock orders
    vi.mocked(db.order.findMany).mockResolvedValue([]);

    // 4. Mock system settings with INCOME_EXPENSES scheme and 15% tax rate
    vi.mocked(db.systemSettings.findUnique).mockResolvedValue({
      id: 'global',
      taxRate: 15.0,
      opexMonthly: 500000,
      usnScheme: 'INCOME_EXPENSES',
    } as any);

    const metrics = await accountingService.getMetrics();

    // Gross revenue: 50000000
    // Refunds: 0, Gateway fees: 1750000
    // Net revenue: 48250000
    // COGS: 0, Gross margin: 48250000
    // INCOME_EXPENSES Tax base: Gross Margin = 48250000 cents
    // Tax rate: 15%
    // Taxes: 48250000 * 0.15 = 7237500 cents
    // OPEX: 500000
    // Net profit = 48250000 - 7237500 - 500000 = 40512500 cents
    expect(metrics.revenueGross).toBe(50000000);
    expect(metrics.usnScheme).toBe('INCOME_EXPENSES');
    expect(metrics.taxes).toBe(7237500);
    expect(metrics.profitNet).toBe(40512500);
  });

  it('correctly rounds tax and profit net values to prevent float fractional cents', async () => {
    vi.mocked(db.payment.groupBy).mockResolvedValue([
      {
        gateway: 'yookassa',
        _sum: { amount: BigInt(50000333) }, // 500,003.33 RUB in cents
      },
    ] as any);

    vi.mocked(db.payment.aggregate).mockResolvedValue({
      _sum: { amount: BigInt(1500000000) },
    } as any);

    vi.mocked(db.order.findMany).mockResolvedValue([]);

    vi.mocked(db.systemSettings.findUnique).mockResolvedValue({
      id: 'global',
      taxRate: 6.33, // Fractional tax rate to test rounding
      opexMonthly: 500001,
      usnScheme: 'INCOME',
    } as any);

    const metrics = await accountingService.getMetrics();

    // Gross revenue: 50000333
    // Refunds: 0, Gateway fees: 3.5% = 1750012 (Math.round(50000333 * 0.035))
    // Net revenue: 50000333 - 1750012 = 48250321
    // COGS: 0, Gross margin: 48250321
    // INCOME Tax: 50000333 * 0.0633 = 3165021.0789 -> round to 3165021 cents
    // Profit net = 48250321 - 3165021 - 500001 = 44585299
    expect(Number.isInteger(metrics.taxes)).toBe(true);
    expect(Number.isInteger(metrics.profitNet)).toBe(true);
    expect(metrics.taxes).toBe(3165021);
    expect(metrics.profitNet).toBe(44585299);
  });

  it('aligns payment gateway fee rates with getGatewayBreakdown (Robokassa 3.9%, SBP 0.7%, CryptoBot 1.0%, YooKassa 3.5%)', async () => {
    vi.mocked(db.payment.groupBy).mockResolvedValue([
      { gateway: 'robokassa', _sum: { amount: BigInt(100000) } }, // 1,000 RUB -> 3.9% = 39 RUB (3900 cents)
      { gateway: 'sbp_qr', _sum: { amount: BigInt(100000) } },    // 1,000 RUB -> 0.7% = 7 RUB (700 cents)
      { gateway: 'cryptobot', _sum: { amount: BigInt(100000) } }, // 1,000 RUB -> 1.0% = 10 RUB (1000 cents)
      { gateway: 'yookassa', _sum: { amount: BigInt(100000) } },  // 1,000 RUB -> 3.5% = 35 RUB (3500 cents)
      { gateway: 'unknown', _sum: { amount: BigInt(100000) } },   // 1,000 RUB -> default 3.5% = 35 RUB (3500 cents)
    ] as any);

    vi.mocked(db.payment.aggregate).mockResolvedValue({
      _sum: { amount: BigInt(500000) },
    } as any);

    vi.mocked(db.order.findMany).mockResolvedValue([]);
    vi.mocked(db.systemSettings.findUnique).mockResolvedValue({
      id: 'global',
      taxRate: 6.0,
      opexMonthly: 0,
    } as any);

    const metrics = await accountingService.getMetrics();

    // Total gross: 500,000 cents
    // Total fees: 3900 + 700 + 1000 + 3500 + 3500 = 12600 cents
    expect(metrics.revenueGross).toBe(500000);
    expect(metrics.gatewayFees).toBe(12600);
  });

  it('excludes unpaid canceled orders from refunds while keeping paid canceled orders and partial orders', async () => {
    vi.mocked(db.payment.groupBy).mockResolvedValue([
      { gateway: 'yookassa', _sum: { amount: BigInt(100000) } }, // 1,000 RUB gross
    ] as any);

    vi.mocked(db.payment.aggregate).mockResolvedValue({
      _sum: { amount: BigInt(100000) },
    } as any);

    vi.mocked(db.order.findMany).mockResolvedValue([
      // 1. Unpaid cart order abandoned by user (payment is CANCELED) -> MUST BE EXCLUDED
      {
        status: 'CANCELED',
        quantity: 100,
        remains: 100,
        charge: BigInt(30000), // 300 RUB
        payment: { status: 'CANCELED' },
      },
      // 2. Unpaid cart order auto-expired by system -> MUST BE EXCLUDED
      {
        status: 'CANCELED',
        quantity: 50,
        remains: 50,
        charge: BigInt(15000), // 150 RUB
        error: 'Оплата не поступила в течение 24ч (auto-expire)',
        payment: null,
      },
      // 3. Paid order canceled and refunded by provider -> MUST BE INCLUDED
      {
        status: 'CANCELED',
        quantity: 200,
        remains: 200,
        charge: BigInt(20000), // 200 RUB
        payment: { status: 'SUCCEEDED' },
      },
      // 4. Paid order partially completed (50 remains out of 100) -> 50% refund = 50 RUB
      {
        status: 'PARTIAL',
        quantity: 100,
        remains: 50,
        charge: BigInt(10000), // 100 RUB
        payment: { status: 'SUCCEEDED' },
      },
    ] as any);

    vi.mocked(db.systemSettings.findUnique).mockResolvedValue({
      id: 'global',
      taxRate: 6.0,
      opexMonthly: 0,
    } as any);

    const metrics = await accountingService.getMetrics();

    // Expected refunds:
    // Order 1 (unpaid): 0
    // Order 2 (unpaid auto-expire): 0
    // Order 3 (paid canceled): 20000
    // Order 4 (partial 50/100 of 10000): 5000
    // Total refunds: 25000 cents
    expect(metrics.refunds).toBe(25000);
    // Net revenue: gross (100000) - refunds (25000) - gatewayFees (3500) = 71500
    expect(metrics.revenueNet).toBe(71500);
  });
});
