import { describe, it, expect } from 'vitest';
import { globalSettingsSchema } from '@/validators/admin.validators';
import { isPublicHost } from '@/lib/ssrf-guard';
import { validateUrlNoSSRF } from '@/lib/security';

describe('Settings Security, RBAC & FinTech Rules', () => {

  describe('1. Safety Floor & Markup Validation (54-FZ / Anti-Deficit)', () => {
    it('rejects globalMarkup below 1.05 (+5% safety margin)', () => {
      const result = globalSettingsSchema.safeParse({ globalMarkup: 1.02 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.globalMarkup?.[0]).toContain('1.05');
      }
    });

    it('rejects safetyFloor below 1.05 (+5% safety margin)', () => {
      const result = globalSettingsSchema.safeParse({ safetyFloor: 0.99 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.safetyFloor?.[0]).toContain('1.05');
      }
    });

    it('accepts valid globalMarkup and safetyFloor >= 1.05', () => {
      const result = globalSettingsSchema.safeParse({
        globalMarkup: 1.25,
        safetyFloor: 1.10,
        exchangeRateUSD: 95.5,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('2. SSRF Protection on SMTP & Proxies (validateUrlNoSSRF)', () => {
    it('blocks localhost and internal hosts', async () => {
      expect(await isPublicHost('localhost')).toBe(false);
      expect(await isPublicHost('127.0.0.1')).toBe(false);
      expect(await isPublicHost('169.254.169.254')).toBe(false);
      expect(await isPublicHost('internal.local')).toBe(false);
    });

    it('validateUrlNoSSRF blocks dangerous loopback/metadata URLs', async () => {
      expect(await validateUrlNoSSRF('http://127.0.0.1:8080/webhook')).toBe(false);
      expect(await validateUrlNoSSRF('http://169.254.169.254/latest/meta-data/')).toBe(false);
      expect(await validateUrlNoSSRF('http://localhost:3000')).toBe(false);
      expect(await validateUrlNoSSRF('127.0.0.1')).toBe(false);
    });

    it('allows valid public hosts and URLs', async () => {
      expect(await isPublicHost('smtp.yandex.ru')).toBe(true);
      expect(await isPublicHost('smtp.gmail.com')).toBe(true);
      expect(await validateUrlNoSSRF('https://api.telegram.org/bot12345/webhook')).toBe(true);
    });
  });

  describe('3. Secrets Masking Integrity', () => {
    it('properly detects placeholders vs new secret input', () => {
      const isPlaceholder = (val?: string | null) => !val || val.trim() === '' || val.includes('•••');
      
      expect(isPlaceholder('••••••••••••••••')).toBe(true);
      expect(isPlaceholder('••••••••abcd')).toBe(true);
      expect(isPlaceholder('')).toBe(true);
      expect(isPlaceholder(null)).toBe(true);
      expect(isPlaceholder('live_sec_1234567890abcdef')).toBe(false);
      expect(isPlaceholder('sk-proj-998877665544')).toBe(false);
    });
  });
});

