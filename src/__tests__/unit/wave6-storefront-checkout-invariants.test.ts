/**
 * wave6-storefront-checkout-invariants.test.ts
 * Юнит-тесты на инварианты Волны 6: Storefront, Checkout Wizard, Drip-Feed Floor & Formatters.
 */

import { describe, it, expect } from 'vitest';
import { validateOrderForm } from '@/hooks/order-engine/order-form-validator';
import { formatCents, formatBalance } from '@/lib/utils';
import type { PublicService, PublicNetwork } from '@/actions/order/catalog';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';

describe('Wave 6 Invariants: Storefront & Checkout Ergonomics', () => {
  const dummyService: PublicService = {
    id: 'srv-1',
    name: 'Подписчики Telegram',
    rate: 100, // 100 RUB / 1000
    minQty: 100,
    maxQty: 10000,
    categoryId: 'cat-tg',
    isActive: true,
    isDripFeedEnabled: true,
  } as unknown as PublicService;

  const dummyNetwork: PublicNetwork = {
    id: 'net-tg',
    name: 'Telegram',
    slug: 'telegram',
    icon: 'telegram',
    categories: [
      {
        id: 'cat-tg',
        name: 'Подписчики',
        slug: 'subscribers',
        networkId: 'net-tg',
        targetType: 'CHANNEL',
      } as unknown as PublicNetwork['categories'][number],
    ],
  };

  it('1. Form Validation Drip-Feed Floor: Flags insufficient volume per run on client form', () => {
    // 500 total across 10 runs => 50 per run < 100 minQty
    const resultInvalid = validateOrderForm({
      url: 'https://t.me/durov',
      quantity: 500,
      email: 'client@example.com',
      selectedService: dummyService,
      customData: '',
      agreedToTerms: true,
      catalog: [dummyNetwork],
      networkId: 'net-tg',
      platform: IntelligencePlatform.TELEGRAM,
      manualPlatform: null,
      detectedType: 'CHANNEL',
      isLinkOverridden: false,
      dripFeedEnabled: true,
      runs: 10,
      isSmartDrip: false,
      smartDripDays: 0,
    });

    expect(resultInvalid.isValid).toBe(false);
    expect(resultInvalid.errors['dripfeed']).toContain('минимум 1000 шт.');

    // 1000 total across 10 runs => 100 per run >= 100 minQty => Valid!
    const resultValid = validateOrderForm({
      url: 'https://t.me/durov',
      quantity: 1000,
      email: 'client@example.com',
      selectedService: dummyService,
      customData: '',
      agreedToTerms: true,
      catalog: [dummyNetwork],
      networkId: 'net-tg',
      platform: IntelligencePlatform.TELEGRAM,
      manualPlatform: null,
      detectedType: 'CHANNEL',
      isLinkOverridden: false,
      dripFeedEnabled: true,
      runs: 10,
      isSmartDrip: false,
      smartDripDays: 0,
    });

    expect(resultValid.isValid).toBe(true);
    expect(resultValid.errors['dripfeed']).toBeUndefined();
  });

  it('2. Currency Formatting: Formats kopecks and BigInt balances accurately for Russian locale', () => {
    expect(formatCents(12345)).toBe('123.45');
    expect(formatCents(50)).toBe('0.50');
    expect(formatCents(0)).toBe('0.00');

    expect(formatBalance(125050n).replace(/\u00a0/g, ' ')).toContain('1 250.50 ₽');
    expect(formatBalance(0n)).toContain('0.00 ₽');
  });
});
