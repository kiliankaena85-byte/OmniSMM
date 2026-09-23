import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { redactSensitiveTokens, sanitizeLogObject, maskEmail } from '@/lib/logger/sensitive-data-filter';
import { sendMagicLink } from '@/lib/smtp';

vi.mock('@/lib/system-settings', () => ({
  getSystemSettings: vi.fn().mockResolvedValue({
    siteName: 'SMMplan',
    contactSupportEmail: 'support@smmplan.pro',
  }),
}));

vi.mock('@/lib/env-helpers', () => ({
  getBaseUrlAsync: vi.fn().mockResolvedValue('https://smmplan.pro'),
}));

describe('PII-01 & PII-02: Sensitive Data and Magic Link Masking', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('PII-01: stdout Magic Link Dumps Neutralization', () => {
    it('does NOT dump magic link to console.info by default', async () => {
      delete process.env.DEBUG_MAGIC_LINK;
      (process.env as any).NODE_ENV = 'development';

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      await sendMagicLink('user@example.com', 'secret-magic-token-12345', 'smmplan');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('does NOT dump magic link to console.info in production even if DEBUG_MAGIC_LINK=true', async () => {
      process.env.DEBUG_MAGIC_LINK = 'true';
      (process.env as any).NODE_ENV = 'production';

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      await sendMagicLink('user@example.com', 'secret-magic-token-12345', 'smmplan');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('dumps magic link to console ONLY when DEBUG_MAGIC_LINK=true in non-production', async () => {
      process.env.DEBUG_MAGIC_LINK = 'true';
      (process.env as any).NODE_ENV = 'development';

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      await sendMagicLink('user@example.com', 'secret-magic-token-12345', 'smmplan');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('secret-magic-token-12345')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('PII-02: Structured Log Masking & Token Redaction', () => {
    it('masks email addresses properly using maskEmail', () => {
      expect(maskEmail('alice@smmplan.pro')).toBe('a***@smmplan.pro');
      expect(maskEmail('bob.smith@gmail.com')).toBe('b***@gmail.com');
    });

    it('masks standalone emails in log messages', () => {
      const message = 'Password reset requested for alex@domain.com successfully';
      const redacted = redactSensitiveTokens(message);
      expect(redacted).toBe('Password reset requested for a***@domain.com successfully');
      expect(redacted).not.toContain('alex@domain.com');
    });

    it('masks JSON email, password, and phone fields', () => {
      const jsonStr = JSON.stringify({
        email: 'john.doe@example.com',
        password: 'SuperSecretPassword123!',
        phone: '+79991234567',
        token: 'auth_tok_abcdef123456',
      });

      const redacted = redactSensitiveTokens(jsonStr);
      expect(redacted).toContain('"email":"j***@example.com"');
      expect(redacted).toContain('"password":"[REDACTED]"');
      expect(redacted).toContain('"phone":"[REDACTED]"');
      expect(redacted).toContain('"token":"[REDACTED]"');
      expect(redacted).not.toContain('SuperSecretPassword123!');
      expect(redacted).not.toContain('auth_tok_abcdef123456');
    });

    it('redacts tokens embedded in query strings', () => {
      const url = 'https://smmplan.pro/api/auth/verify?token=abc123xyz789&tenant=smmplan';
      const redacted = redactSensitiveTokens(url);
      expect(redacted).toBe('https://smmplan.pro/api/auth/verify?token=[REDACTED]&tenant=smmplan');
      expect(redacted).not.toContain('abc123xyz789');
    });

    it('sanitizes objects passed to sanitizeLogObject recursively', () => {
      const logContext = {
        userId: 'usr_123',
        email: 'ceo@smmplan.pro',
        apiKey: 'sk-live-1234567890abcdef',
        details: {
          sessionToken: 'sess_secret_token_val',
        },
      };

      const safe = sanitizeLogObject(logContext);
      expect(safe.userId).toBe('usr_123');
      expect(safe.email).toBe('c***@smmplan.pro');
      expect(safe.apiKey).toBe('[REDACTED]');
      expect(safe.details.sessionToken).toBe('[REDACTED]');
    });
  });
});
