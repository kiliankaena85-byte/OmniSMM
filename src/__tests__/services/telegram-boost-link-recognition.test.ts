import { describe, it, expect } from 'vitest';
import { IntelligenceLinkAnalyzer } from '@/services/analyzer/link-analyzer';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import { CATEGORY_LABELS } from '@/services/providers/smart-analyzer.logic';
import { UNIFIED_REGEX, getUnifiedLinkValidator } from '@/services/link-engine/link-rules-registry';
import { canonicalizeUrl } from '@/services/link-engine/link-canonicalizer';

describe('Telegram Boost Link Recognition, Validation & Canonicalization Suite', () => {
  const analyzer = new IntelligenceLinkAnalyzer();
  const channelValidator = getUnifiedLinkValidator('TELEGRAM', 'CHANNEL');

  const boostFormats = [
    {
      format: 't.me/boost/channelname',
      url: 'https://t.me/boost/channelname',
      expectedId: 'channelname',
    },
    {
      format: 't.me/channelname/boost',
      url: 'https://t.me/channelname/boost',
      expectedId: 'channelname',
    },
    {
      format: 't.me/c/1234567890/boost',
      url: 'https://t.me/c/1234567890/boost',
      expectedId: '1234567890',
    },
    {
      format: 't.me/boost/c/1234567890',
      url: 'https://t.me/boost/c/1234567890',
      expectedId: '1234567890',
    },
    {
      format: 't.me/channelname?boost',
      url: 'https://t.me/channelname?boost',
      expectedId: 'channelname',
    },
  ];

  describe('1. IntelligenceLinkAnalyzer Boost Recognition', () => {
    boostFormats.forEach(({ format, url, expectedId }) => {
      it(`accurately analyzes boost format: ${format}`, async () => {
        const result = await analyzer.analyze(url);

        expect(result.platform).toBe(IntelligencePlatform.TELEGRAM);
        expect(result.type).toBe('channel');
        expect(result.id).toBe(expectedId);
        expect(result.metadata.context).toBe('channel_boost_target');
        expect(result.suggestedCategories).toEqual([
          CATEGORY_LABELS.BOOSTS,
          CATEGORY_LABELS.SUBSCRIBERS,
          CATEGORY_LABELS.PREMIUM,
        ]);
        expect(result.warnings).toEqual([]);
      });
    });

    it('handles query parameters alongside boost flag', async () => {
      const result = await analyzer.analyze('https://t.me/mychannel?boost&ref=123');
      expect(result.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(result.type).toBe('channel');
      expect(result.id).toBe('mychannel');
      expect(result.metadata.context).toBe('channel_boost_target');
    });

    it('handles telegram.me and telegram.dog boost links', async () => {
      const res1 = await analyzer.analyze('https://telegram.me/boost/specialchannel');
      expect(res1.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res1.metadata.context).toBe('channel_boost_target');
      expect(res1.id).toBe('specialchannel');

      const res2 = await analyzer.analyze('https://telegram.dog/specialchannel/boost');
      expect(res2.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res2.metadata.context).toBe('channel_boost_target');
      expect(res2.id).toBe('specialchannel');
    });

    it('does not classify standard channel links as boost target', async () => {
      const normalChannel = await analyzer.analyze('https://t.me/durov');
      expect(normalChannel.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(normalChannel.type).toBe('channel');
      expect(normalChannel.metadata.context).toBe('global_search_optimization');
      expect(normalChannel.metadata.context).not.toBe('channel_boost_target');
    });
  });

  describe('2. Link Rules Registry & Validator (UNIFIED_REGEX.TELEGRAM.CHANNEL)', () => {
    boostFormats.forEach(({ format, url }) => {
      it(`validates boost format via UNIFIED_REGEX: ${format}`, () => {
        expect(UNIFIED_REGEX.TELEGRAM.CHANNEL.test(url)).toBe(true);
      });

      it(`validates boost format via Zod channel validator: ${format}`, () => {
        const parsed = channelValidator.safeParse(url);
        expect(parsed.success).toBe(true);
      });
    });

    it('validates boost links without protocol prefix', () => {
      expect(UNIFIED_REGEX.TELEGRAM.CHANNEL.test('http://t.me/boost/channelname')).toBe(true);
      expect(UNIFIED_REGEX.TELEGRAM.CHANNEL.test('https://telegram.dog/boost/c/9876543210')).toBe(true);
    });

    it('rejects invalid telegram links for channel target type', () => {
      // Post link is not a channel link
      expect(UNIFIED_REGEX.TELEGRAM.CHANNEL.test('https://t.me/channelname/123')).toBe(false);
      expect(channelValidator.safeParse('https://t.me/channelname/123').success).toBe(false);

      // Private post link is not a channel link
      expect(UNIFIED_REGEX.TELEGRAM.CHANNEL.test('https://t.me/c/1234567890/123')).toBe(false);
      expect(channelValidator.safeParse('https://t.me/c/1234567890/123').success).toBe(false);
    });
  });

  describe('3. Link Canonicalizer Boost Parameter Preservation', () => {
    it('preserves t.me/boost/channelname format', () => {
      const canonical = canonicalizeUrl('https://t.me/boost/channelname', IntelligencePlatform.TELEGRAM, 'CHANNEL');
      expect(canonical).toBe('https://t.me/boost/channelname');
    });

    it('preserves t.me/channelname/boost format', () => {
      const canonical = canonicalizeUrl('https://t.me/channelname/boost', IntelligencePlatform.TELEGRAM, 'CHANNEL');
      expect(canonical).toBe('https://t.me/channelname/boost');
    });

    it('preserves t.me/c/1234567890/boost format', () => {
      const canonical = canonicalizeUrl('https://t.me/c/1234567890/boost', IntelligencePlatform.TELEGRAM, 'CHANNEL');
      expect(canonical).toBe('https://t.me/c/1234567890/boost');
    });

    it('preserves t.me/boost/c/1234567890 format', () => {
      const canonical = canonicalizeUrl('https://t.me/boost/c/1234567890', IntelligencePlatform.TELEGRAM, 'CHANNEL');
      expect(canonical).toBe('https://t.me/boost/c/1234567890');
    });

    it('preserves ?boost query parameter on channel URLs', () => {
      const canonical = canonicalizeUrl('https://t.me/channelname?boost', IntelligencePlatform.TELEGRAM, 'CHANNEL');
      expect(canonical).toBe('https://t.me/channelname?boost');
      expect(canonical).not.toContain('boost=');
    });

    it('strips tracking UTM params while preserving ?boost parameter', () => {
      const canonical = canonicalizeUrl(
        'https://t.me/channelname?boost&utm_source=telegram&utm_medium=cpc',
        IntelligencePlatform.TELEGRAM,
        'CHANNEL'
      );
      expect(canonical).toBe('https://t.me/channelname?boost');
      expect(canonical).not.toContain('utm_source');
      expect(canonical).not.toContain('utm_medium');
      expect(canonical).not.toContain('boost=');
    });

    it('canonicalizes @channelname boost URLs cleanly without @ symbol', () => {
      expect(canonicalizeUrl('https://t.me/boost/@channelname', IntelligencePlatform.TELEGRAM, 'CHANNEL'))
        .toBe('https://t.me/boost/channelname');
      expect(canonicalizeUrl('https://t.me/@channelname/boost', IntelligencePlatform.TELEGRAM, 'CHANNEL'))
        .toBe('https://t.me/channelname/boost');
      expect(canonicalizeUrl('https://t.me/@channelname?boost', IntelligencePlatform.TELEGRAM, 'CHANNEL'))
        .toBe('https://t.me/channelname?boost');
    });

    it('strips tracking params and query strings for non-boost channel URLs', () => {
      const canonical = canonicalizeUrl(
        'https://t.me/durov?utm_source=test&foo=bar',
        IntelligencePlatform.TELEGRAM,
        'CHANNEL'
      );
      expect(canonical).toBe('https://t.me/durov');
      expect(canonical).not.toContain('?');
    });
  });

  describe('4. Proxy Legacy Redirects for Boosts', () => {
    it('verifies /boost and /telegram/boost routes redirect to /services/telegram/busty', async () => {
      // Direct verification of proxy legacyRedirects configuration
      const { proxy } = await import('@/proxy');
      const { NextRequest } = await import('next/server');

      const req1 = new NextRequest('https://smmplan.pro/boost', {
        headers: { host: 'smmplan.pro', 'x-forwarded-proto': 'https' }
      });
      const res1 = await proxy(req1);
      expect(res1.status).toBe(301);
      expect(res1.headers.get('location')).toBe('https://smmplan.pro/services/telegram/busty');

      const req2 = new NextRequest('https://smmplan.pro/telegram/boost', {
        headers: { host: 'smmplan.pro', 'x-forwarded-proto': 'https' }
      });
      const res2 = await proxy(req2);
      expect(res2.status).toBe(301);
      expect(res2.headers.get('location')).toBe('https://smmplan.pro/services/telegram/busty');

      // Trailing slash support
      const req3 = new NextRequest('https://smmplan.pro/boost/', {
        headers: { host: 'smmplan.pro', 'x-forwarded-proto': 'https' }
      });
      const res3 = await proxy(req3);
      expect(res3.status).toBe(301);
      expect(res3.headers.get('location')).toBe('https://smmplan.pro/services/telegram/busty');

      const req4 = new NextRequest('https://smmplan.pro/telegram/boost/', {
        headers: { host: 'smmplan.pro', 'x-forwarded-proto': 'https' }
      });
      const res4 = await proxy(req4);
      expect(res4.status).toBe(301);
      expect(res4.headers.get('location')).toBe('https://smmplan.pro/services/telegram/busty');
    });
  });
});
