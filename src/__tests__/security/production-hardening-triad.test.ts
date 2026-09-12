import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { validateRedisUrl } from '@/lib/redis';
import { buildCspHeader, proxy } from '@/proxy';
import { verifyDirectSmtpConnection, sendMagicLink } from '@/lib/smtp';

// Mock settings provider to isolate unit test from external DB connection
vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getEmailSettings: vi.fn().mockResolvedValue({
      emailProvider: 'SMTP',
      smtpHost: null,
      smtpPort: 465,
      smtpUser: null,
      smtpPassword: null,
      supportEmailDomain: 'smmplan.pro',
    }),
    getContactAndLegalSettings: vi.fn().mockResolvedValue({ COMPANY_NAME: 'Smmplan' }),
    getSupportEmailDomain: vi.fn().mockResolvedValue('smmplan.pro'),
  },
}));

describe('PROD-SEC-2026: Production Hardening Triad Security Suite', () => {

  // =========================================================================
  // [SEC-001] Redis Authentication & Transit Encryption Hardening
  // =========================================================================
  describe('[SEC-001] Redis Hardening Gate', () => {
    it('MUST reject unauthenticated Redis URL in production (even for localhost/docker)', () => {
      const resultLocal = validateRedisUrl('redis://localhost:6379', 'production');
      expect(resultLocal.valid).toBe(false);
      expect(resultLocal.error).toContain('SEC-001 Violation');

      const resultDocker = validateRedisUrl('redis://redis:6379', 'production');
      expect(resultDocker.valid).toBe(false);
      expect(resultDocker.error).toContain('SEC-001 Violation');

      const resultIp = validateRedisUrl('redis://127.0.0.1:6379', 'production');
      expect(resultIp.valid).toBe(false);
      expect(resultIp.error).toContain('SEC-001 Violation');
    });

    it('MUST accept authenticated Redis URL in production with password', () => {
      const result = validateRedisUrl('redis://:SmmP1anR3dis2026Secure!@redis:6379', 'production');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();

      const resultWithUser = validateRedisUrl('redis://default:StrongPassword2026!@127.0.0.1:6379', 'production');
      expect(resultWithUser.valid).toBe(true);
      expect(resultWithUser.error).toBeUndefined();
    });

    it('MUST accept encrypted TLS URL (rediss://) in production', () => {
      const result = validateRedisUrl('rediss://:secret@upstash-redis-instance.com:6380', 'production');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('MUST emit warning when connecting to external non-TLS host in production', () => {
      const result = validateRedisUrl('redis://:secret@external-redis.cloud-provider.com:6379', 'production');
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('Transit encryption recommended');
    });

    it('MUST allow local unauthenticated Redis in development or test environment', () => {
      const devResult = validateRedisUrl('redis://localhost:6379', 'development');
      expect(devResult.valid).toBe(true);

      const testResult = validateRedisUrl('redis://127.0.0.1:6379', 'test');
      expect(testResult.valid).toBe(true);
    });
  });

  // =========================================================================
  // [SEC-002] Content-Security-Policy (Strict-Dynamic Nonce Migration)
  // =========================================================================
  describe('[SEC-002] Content-Security-Policy Strict-Dynamic Migration Gate', () => {
    const testNonce = Buffer.from('sec002-test-nonce-token-2026').toString('base64');

    it('MUST generate valid CSP containing strict-dynamic and nonce', () => {
      const csp = buildCspHeader(testNonce, true, 'smmplan.pro');

      expect(csp).toContain(`'nonce-${testNonce}'`);
      expect(csp).toContain(`'strict-dynamic'`);
    });

    it('MUST strictly exclude unsafe-inline and unsafe-eval from script-src', () => {
      const csp = buildCspHeader(testNonce, true, 'smmplan.pro');

      // Extract script-src directive
      const scriptSrcMatch = csp.match(/script-src\s+([^;]+);/);
      expect(scriptSrcMatch).not.toBeNull();
      const scriptSrc = scriptSrcMatch![1];

      expect(scriptSrc).not.toContain(`'unsafe-inline'`);
      expect(scriptSrc).not.toContain(`'unsafe-eval'`);
      expect(scriptSrc).toContain(`'nonce-${testNonce}'`);
      expect(scriptSrc).toContain(`'strict-dynamic'`);
      expect(scriptSrc).toContain('https://challenges.cloudflare.com');
      expect(scriptSrc).toContain('https://static.cloudflareinsights.com');
      expect(scriptSrc).toContain('https://yookassa.ru');
      expect(scriptSrc).toContain('https://auth.robokassa.ru');
    });

    it('MUST inject x-nonce and Content-Security-Policy via proxy middleware', async () => {
      const req = new NextRequest('https://smmplan.pro/services', {
        headers: {
          host: 'smmplan.pro',
          'x-forwarded-proto': 'https',
        },
      });

      const res = await proxy(req);
      const nonce = res.headers.get('x-nonce');
      const csp = res.headers.get('Content-Security-Policy');

      expect(nonce).toBeDefined();
      expect(nonce!.length).toBeGreaterThan(10);
      expect(csp).toBeDefined();
      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(csp).toContain(`'strict-dynamic'`);
      expect(csp).toContain(`frame-ancestors 'self'`);
      expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  // =========================================================================
  // [SEC-003] Production Direct SMTP Verification
  // =========================================================================
  describe('[SEC-003] Production Direct SMTP Verification Gate', () => {
    it('MUST execute direct socket connection probe with realistic timeout', async () => {
      // Test direct probe function interface and timeout handling
      const result = await verifyDirectSmtpConnection('smtp.yandex.ru', 465, 4000);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('host', 'smtp.yandex.ru');
      expect(result).toHaveProperty('port', 465);
      expect(result).toHaveProperty('secure', true);
      expect(result).toHaveProperty('durationMs');
      expect(typeof result.durationMs).toBe('number');
    });

    it('MUST handle invalid host or port failures gracefully without throwing', async () => {
      const result = await verifyDirectSmtpConnection('non-existent-smtp-domain-test-12345.pro', 465, 1000);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('MUST handle sendMagicLink safely and print to console when SMTP is unconfigured', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      // Request magic link without throwing
      await expect(sendMagicLink('audit-user@smmplan.pro', 'token-sec003-verify', 'smmplan')).resolves.toBeUndefined();
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('MAGIC LINK FOR audit-user@smmplan.pro');
      expect(output).toContain('token-sec003-verify');
      
      consoleSpy.mockRestore();
    });
  });
});
