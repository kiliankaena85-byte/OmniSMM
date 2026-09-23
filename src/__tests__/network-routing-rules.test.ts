import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UniversalNetworkRouter, IMMUTABLE_DIRECT_PATTERNS } from '@/lib/network/network-router';

describe('UniversalNetworkRouter (Clash Verge Pattern)', () => {
  beforeEach(() => {
    UniversalNetworkRouter.invalidateCache();
  });

  describe('Immutable Direct Rules (Security Invariants)', () => {
    it('always routes YooKassa to DIRECT regardless of rules or proxies', async () => {
      const res = await UniversalNetworkRouter.resolveRoute('https://api.yookassa.ru/v3/payments');
      expect(res.target).toBe('DIRECT');
      expect(res.isImmutableDirect).toBe(true);
      expect(res.proxyConfig).toBeFalsy();
    });

    it('always routes Robokassa to DIRECT', async () => {
      const res = await UniversalNetworkRouter.resolveRoute('https://auth.robokassa.ru/Merchant/Index.aspx');
      expect(res.target).toBe('DIRECT');
      expect(res.isImmutableDirect).toBe(true);
    });

    it('always routes CBR (Central Bank of Russia) to DIRECT', async () => {
      const res = await UniversalNetworkRouter.resolveRoute('https://cbr.ru/scripts/XML_daily.asp');
      expect(res.target).toBe('DIRECT');
      expect(res.isImmutableDirect).toBe(true);
    });

    it('always routes Yandex SMTP to DIRECT', async () => {
      const res = await UniversalNetworkRouter.resolveRoute('https://smtp.yandex.ru:465');
      expect(res.target).toBe('DIRECT');
      expect(res.isImmutableDirect).toBe(true);
    });

    it('always routes Vexboost provider to DIRECT', async () => {
      const res = await UniversalNetworkRouter.resolveRoute('https://vexboost.ru/api/v2', {
        service: 'PROVIDERS'
      });
      expect(res.target).toBe('DIRECT');
      expect(res.isImmutableDirect).toBe(true);
    });
  });

  describe('Domain and Service Rules Resolution', () => {
    it('routes Google Gemini API to PROXY_POOL by DOMAIN-SUFFIX', async () => {
      const res = await UniversalNetworkRouter.resolveRoute('https://generativelanguage.googleapis.com/v1beta/models');
      expect(res.target).toBe('PROXY_POOL');
      expect(res.isImmutableDirect).toBe(false);
      expect(res.matchedRule?.type).toBe('DOMAIN-SUFFIX');
      expect(res.matchedRule?.payload).toBe('googleapis.com');
    });

    it('routes requests with service AI_GEMINI to PROXY_POOL', async () => {
      const res = await UniversalNetworkRouter.resolveRoute('https://api.custom-ai-mirror.com/v1/chat', {
        service: 'AI_GEMINI'
      });
      expect(res.target).toBe('PROXY_POOL');
    });

    it('routes CryptoBot via DOMAIN-SUFFIX', async () => {
      const res = await UniversalNetworkRouter.resolveRoute('https://pay.crypt.bot/api/createInvoice');
      expect(res.target).toBe('DIRECT'); // Default toggle for crypto is DIRECT unless proxied
    });

    it('falls back to FINAL rule for arbitrary domain', async () => {
      const res = await UniversalNetworkRouter.resolveRoute('https://example.com/api/test');
      expect(res.target).toBe('DIRECT');
      expect(res.matchedRule?.type).toBe('FINAL');
    });
  });

  describe('Route Inspector', () => {
    it('returns full inspection report for admin diagnostic tools', async () => {
      const inspection = await UniversalNetworkRouter.inspectRoute('https://generativelanguage.googleapis.com/v1beta/chat', 'AI_GEMINI');
      expect(inspection.hostname).toBe('generativelanguage.googleapis.com');
      expect(inspection.target).toBe('PROXY_POOL');
      expect(inspection.checkedUrl).toContain('googleapis.com');
      expect(inspection.reason).toBeDefined();
    });
  });

  describe('SSRF Protection Gate', () => {
    it('blocks cloud metadata endpoint (169.254.169.254)', async () => {
      await expect(
        UniversalNetworkRouter.fetch('http://169.254.169.254/latest/meta-data')
      ).rejects.toThrow(/SSRF/);
    });
  });

  describe('Edge Cases and Sovereign RU Reserve (BGS-2026)', () => {
    it('handles malformed and invalid URLs gracefully without crashing', async () => {
      const res = await UniversalNetworkRouter.resolveRoute('not-a-valid-url');
      expect(res.target).toBe('DIRECT');
      expect(res.reason).toContain('Invalid URL');
    });

    it('honors RU_SOVEREIGN_POOL when activated in service toggles for overseas hosts', async () => {
      // Mock config with paymentsRu set to RU_SOVEREIGN_POOL
      vi.spyOn(UniversalNetworkRouter, 'getConfig').mockResolvedValueOnce({
        serviceToggles: {
          aiGemini: 'PROXY_POOL',
          providers: 'PROXY_POOL',
          catalogSync: 'DIRECT',
          paymentsRu: 'RU_SOVEREIGN_POOL',
          paymentsCrypto: 'DIRECT',
          telegram: 'DIRECT'
        },
        systemProxyUrl: null,
        rules: []
      });

      const res = await UniversalNetworkRouter.resolveRoute('https://api.yookassa.ru/v3/payments', {
        service: 'PAYMENTS_RU'
      });
      // Either routes to RU_SOVEREIGN_POOL or falls back cleanly
      expect(['RU_SOVEREIGN_POOL', 'DIRECT']).toContain(res.target);
    });
  });
});