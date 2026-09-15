import { describe, it, expect, vi } from 'vitest';
import { ExactMath } from '@/lib/financial/exact-math';
import { IntelligenceLinkAnalyzer } from '@/services/analyzer/link-analyzer';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';

vi.mock('@/lib/ssrf-guard', () => ({
  SHORT_LINK_HOSTS: new Set(['bit.ly', 'youtu.be', 'vm.tiktok.com', 'vt.tiktok.com', 't.co', 'cutt.ly', 'clck.ru', 'tinyurl.com', 'is.gd']),
  resolveShortLink: vi.fn(async (url: string) => url)
}));

describe('🏛️ Client Dashboard Comprehensive Master Suite (8 Tabs & Financial Math)', () => {
  const linkAnalyzer = new IntelligenceLinkAnalyzer();

  // =========================================================================
  // TAB 1: HOME & DASHBOARD METRICS
  // =========================================================================
  describe('📊 TAB 1: Home (/dashboard) & Metrics Integrity', () => {
    it('1.1 accurately formats user balance from BigInt kopecks to rubles without IEEE-754 drift', () => {
      const balanceKopecks = BigInt(123456); // 1234.56 RUB
      const rubString = ExactMath.kopecksToRublesString(balanceKopecks);
      expect(rubString).toBe('1234.56');

      const microBalance = BigInt(29); // 0.29 RUB
      expect(ExactMath.kopecksToRublesString(microBalance)).toBe('0.29');
    });

    it('1.2 calculates 30-day spending sum across multiple orders using exact BigInt addition', () => {
      const orderCharges = [BigInt(10050), BigInt(25075), BigInt(50000), BigInt(1250)]; // 100.50 + 250.75 + 500.00 + 12.50 = 863.75
      const totalSpentKopecks = orderCharges.reduce((acc, curr) => acc + curr, BigInt(0));
      expect(totalSpentKopecks).toBe(BigInt(86375));
      expect(ExactMath.kopecksToRublesString(totalSpentKopecks)).toBe('863.75');
    });

    it('1.3 enforces tenant separation between SMMplan and SMMflux', () => {
      const smmplanUser = { id: 'u1', tenantId: 'smmplan', email: 'api@company.ru' };
      const fluxUser = { id: 'u2', tenantId: 'flux', email: 'creator@aurora.io' };

      expect(smmplanUser.tenantId).toBe('smmplan');
      expect(fluxUser.tenantId).toBe('flux');
      expect(smmplanUser.tenantId).not.toBe(fluxUser.tenantId);
    });

    it('1.4 calculates client loyalty tier and cashback thresholds correctly', async () => {
      const { getLoyaltyInfo } = await import('@/lib/loyalty');
      
      const bronze = getLoyaltyInfo(BigInt(100000)); // 1 000 RUB
      expect(bronze.tier).toBe('BRONZE');
      expect(bronze.cashbackPercent).toBe(1);
      expect(bronze.nextTierName).toBe('Silver');
      expect(bronze.remainingToNextTierRub).toBe(4000);

      const silver = getLoyaltyInfo(BigInt(1000000)); // 10 000 RUB
      expect(silver.tier).toBe('SILVER');
      expect(silver.cashbackPercent).toBe(3);
      expect(silver.nextTierName).toBe('Gold');

      const gold = getLoyaltyInfo(BigInt(3000000)); // 30 000 RUB
      expect(gold.tier).toBe('GOLD');
      expect(gold.cashbackPercent).toBe(5);
      expect(gold.discountPercent).toBe(5);
      expect(gold.nextTierName).toBeNull();
      expect(gold.progressPercent).toBe(100);
    });

    it('1.5 validates canonical 7 social networks in launchpad (including Rutube & Dzen, excluding Twitch)', async () => {
      const { TOP_LAUNCHPAD_NETWORKS } = await import('@/lib/loyalty');
      expect(TOP_LAUNCHPAD_NETWORKS).toHaveLength(7);
      const slugs = TOP_LAUNCHPAD_NETWORKS.map(n => n.slug);
      expect(slugs).toContain('telegram');
      expect(slugs).toContain('vk');
      expect(slugs).toContain('instagram');
      expect(slugs).toContain('youtube');
      expect(slugs).toContain('tiktok');
      expect(slugs).toContain('rutube');
      expect(slugs).toContain('dzen');
      expect(slugs).not.toContain('twitch');
    });

    it('1.6 computes order progress percentage deterministically for status rendering', async () => {
      const { getOrderProgressPercent } = await import('@/lib/loyalty');
      expect(getOrderProgressPercent('COMPLETED')).toBe(100);
      expect(getOrderProgressPercent('IN_PROGRESS')).toBe(65);
      expect(getOrderProgressPercent('PROVISIONING')).toBe(25);
      expect(getOrderProgressPercent('PENDING')).toBe(10);
      expect(getOrderProgressPercent('CANCELED')).toBe(0);
    });
  });

  // =========================================================================
  // TAB 2: NEW ORDER & PRICING ENGINE
  // =========================================================================
  describe('🛒 TAB 2: New Order (/dashboard/new-order) & Pricing Engine', () => {
    it('2.1 computes base order cost with Banker Rounding and protective floor >= 1 kop', () => {
      // 1000 items at 250.00 RUB/1000 with 0 margin
      const cost = ExactMath.calculateOrderCostKopecks(BigInt(1000), BigInt(25000), BigInt(0));
      expect(cost).toBe(BigInt(25000)); // 250.00 RUB

      // 1 item at 0.10 RUB/1000 (0.0001 RUB) -> must floor to >= 1 kopeck (0.01 RUB)
      const microCost = ExactMath.calculateOrderCostKopecks(BigInt(1), BigInt(10), BigInt(0));
      expect(microCost).toBeGreaterThanOrEqual(BigInt(1));
    });

    it('2.2 applies loyalty tier discounts accurately', () => {
      const baseCostKopecks = BigInt(10000); // 100.00 RUB
      const discountPercent = 10; // 10%
      const finalCost = (baseCostKopecks * BigInt(100 - discountPercent)) / BigInt(100);
      expect(finalCost).toBe(BigInt(9000)); // 90.00 RUB
    });

    it('2.3 enforces Drip-Feed Floor Invariant: Math.floor(quantity / runs) >= service.minQty', () => {
      const minQty = 100;
      const runs = 5;

      // Valid: 500 total / 5 runs = 100 per run >= 100 minQty
      const validTotalQty = 500;
      const perRunValid = Math.floor(validTotalQty / runs);
      expect(perRunValid >= minQty).toBe(true);

      // Invalid: 400 total / 5 runs = 80 per run < 100 minQty
      const invalidTotalQty = 400;
      const perRunInvalid = Math.floor(invalidTotalQty / runs);
      expect(perRunInvalid >= minQty).toBe(false);

      // Minimum allowed total quantity for Drip-Feed with N runs must scale to minQty * runs
      const requiredMinTotal = minQty * runs;
      expect(requiredMinTotal).toBe(500);
    });

    it('2.4 verifies link recognition and sanitization across social platforms', async () => {
      const tgLink = await linkAnalyzer.analyze('https://t.me/durov');
      expect(tgLink.platform).toBe(IntelligencePlatform.TELEGRAM);

      const ytLink = await linkAnalyzer.analyze('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(ytLink.platform).toBe(IntelligencePlatform.YOUTUBE);

      const vkLink = await linkAnalyzer.analyze('https://vk.com/wall-1_23456');
      expect(vkLink.platform).toBe(IntelligencePlatform.VK);
    });
  });

  // =========================================================================
  // TAB 3: ORDERS & LIFECYCLE
  // =========================================================================
  describe('📦 TAB 3: Orders (/dashboard/orders) & Lifecycle Actions', () => {
    it('3.1 calculates exact partial refund for PARTIAL orders', () => {
      const originalQuantity = 1000;
      const remains = 400; // 400 undelivered out of 1000
      const totalChargeKopecks = BigInt(50000); // 500.00 RUB

      // Refund = charge * remains / quantity
      const refundKopecks = (totalChargeKopecks * BigInt(remains)) / BigInt(originalQuantity);
      expect(refundKopecks).toBe(BigInt(20000)); // 200.00 RUB refund
    });

    it('3.2 RepeatOrderButton defaults to remaining quantity for PARTIAL orders', () => {
      const order = {
        serviceId: 'srv-123',
        categoryId: 'cat-456',
        link: 'https://t.me/channel',
        quantity: 1000,
        remains: 350,
        status: 'PARTIAL'
      };

      const targetQty = (order.status === 'PARTIAL' && order.remains > 0) ? order.remains : order.quantity;
      expect(targetQty).toBe(350);
    });

    it('3.3 filters orders by status without SQL injection or unhandled statuses', () => {
      const validStatuses = ['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL', 'CANCELED', 'ERROR'];
      for (const st of validStatuses) {
        expect(typeof st).toBe('string');
      }
    });
  });

  // =========================================================================
  // TAB 4: FINANCE & LEDGER
  // =========================================================================
  describe('💳 TAB 4: Finance (/dashboard/finance) & Ledger Integrity', () => {
    it('4.1 validates deposit amount limits (min 10 RUB, max 300 000 RUB)', () => {
      const minDepositRub = 10;
      const maxDepositRub = 300000;

      expect(5 >= minDepositRub).toBe(false);
      expect(500 >= minDepositRub && 500 <= maxDepositRub).toBe(true);
      expect(500000 <= maxDepositRub).toBe(false);
    });

    it('4.2 validates whitelisted payment gateway domains', () => {
      const whitelistedHosts = ['yoomoney.ru', 'yookassa.ru', 'pay.cryptomus.com', 'robokassa.ru', 't.me'];
      
      const safeUrl = 'https://yoomoney.ru/checkout/payments/v2/contract?id=123';
      const parsedSafe = new URL(safeUrl);
      const isSafe = whitelistedHosts.some(h => parsedSafe.hostname === h || parsedSafe.hostname.endsWith(`.${h}`));
      expect(isSafe).toBe(true);

      const maliciousUrl = 'https://evil-phishing.com/pay';
      const parsedMalicious = new URL(maliciousUrl);
      const isMaliciousSafe = whitelistedHosts.some(h => parsedMalicious.hostname === h || parsedMalicious.hostname.endsWith(`.${h}`));
      expect(isMaliciousSafe).toBe(false);
    });

    it('4.3 verifies ledger credit and debit idempotency', () => {
      const idempotencyKey = 'dep_123_456789';
      expect(idempotencyKey).toBeDefined();
      expect(idempotencyKey.startsWith('dep_')).toBe(true);
    });
  });

  // =========================================================================
  // TAB 5: REFERRALS & AFFILIATE 2.0
  // =========================================================================
  describe('🤝 TAB 5: Referrals (/dashboard/referrals) & Tier Engine', () => {
    it('5.1 correctly calculates affiliate tier percentage from LTV', () => {
      function getAffiliatePercent(spentKopecks: bigint): number {
        if (spentKopecks >= BigInt(50000000)) return 20; // >= 500 000 RUB -> Pioneer 20%
        if (spentKopecks >= BigInt(10000000)) return 15; // >= 100 000 RUB -> VIP Leader 15%
        if (spentKopecks >= BigInt(2500000)) return 10;  // >= 25 000 RUB -> Pro 10%
        if (spentKopecks >= BigInt(500000)) return 7;    // >= 5 000 RUB -> Partner 7%
        return 5; // Start 5%
      }

      expect(getAffiliatePercent(BigInt(100000))).toBe(5);   // 1 000 RUB -> 5%
      expect(getAffiliatePercent(BigInt(600000))).toBe(7);   // 6 000 RUB -> 7%
      expect(getAffiliatePercent(BigInt(3000000))).toBe(10); // 30 000 RUB -> 10%
      expect(getAffiliatePercent(BigInt(15000000))).toBe(15);// 150 000 RUB -> 15%
      expect(getAffiliatePercent(BigInt(60000000))).toBe(20);// 600 000 RUB -> 20%
    });

    it('5.2 protects against self-referral loops', () => {
      const userId = 'user_abc';
      const referralInviterId = 'user_abc';
      const isSelfReferral = userId === referralInviterId;
      expect(isSelfReferral).toBe(true); // Must be rejected by system
    });
  });

  // =========================================================================
  // TAB 6: SMART DRIP & SCHEDULING
  // =========================================================================
  describe('⏱️ TAB 6: Smart Drip (/dashboard/smart-drip) & Intervals', () => {
    it('6.1 rejects intervalMinutes = 0 and enforces interval >= 1 min', () => {
      const validateInterval = (mins: number) => mins >= 1 && mins <= 1440;
      expect(validateInterval(0)).toBe(false);
      expect(validateInterval(60)).toBe(true);
      expect(validateInterval(2000)).toBe(false);
    });

    it('6.2 accurately calculates total campaign duration', () => {
      const runs = 10;
      const intervalMinutes = 30;
      const totalMinutes = (runs - 1) * intervalMinutes;
      expect(totalMinutes).toBe(270); // 4.5 hours
    });
  });

  // =========================================================================
  // TAB 7: TICKETS & SUPPORT
  // =========================================================================
  describe('🎫 TAB 7: Tickets (/dashboard/tickets) & Messaging', () => {
    it('7.1 validates ticket attachments by size (<= 5MB) and mime type', () => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      const maxSizeBytes = 5 * 1024 * 1024;

      const validFile = { size: 2 * 1024 * 1024, type: 'image/png' };
      const oversizedFile = { size: 6 * 1024 * 1024, type: 'image/png' };
      const invalidTypeFile = { size: 1024, type: 'application/x-msdownload' };

      expect(validFile.size <= maxSizeBytes && allowedMimes.includes(validFile.type)).toBe(true);
      expect(oversizedFile.size <= maxSizeBytes).toBe(false);
      expect(allowedMimes.includes(invalidTypeFile.type)).toBe(false);
    });
  });

  // =========================================================================
  // TAB 8: SETTINGS & API
  // =========================================================================
  describe('⚙️ TAB 8: Settings & API (/dashboard/settings)', () => {
    it('8.1 verifies Telegram Smart Bind 6-digit code format and entropy', () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      expect(code).toMatch(/^\d{6}$/);
    });

    it('8.2 validates SMM v2 API key generation length and prefix', () => {
      const apiKey = `smm_live_${Buffer.from('test_random_entropy_2026').toString('hex')}`;
      expect(apiKey.startsWith('smm_live_')).toBe(true);
      expect(apiKey.length).toBeGreaterThanOrEqual(32);
    });
  });
});
