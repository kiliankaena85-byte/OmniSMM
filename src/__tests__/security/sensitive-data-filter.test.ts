import { describe, it, expect } from 'vitest';
import { redactSensitiveTokens, sanitizeLogObject, SENSITIVE_PATTERNS } from '@/lib/logger/sensitive-data-filter';

describe('Sensitive Data Filter Suite (P3-25)', () => {
  it('exposes extensible SENSITIVE_PATTERNS array', () => {
    expect(Array.isArray(SENSITIVE_PATTERNS)).toBe(true);
    expect(SENSITIVE_PATTERNS.length).toBeGreaterThanOrEqual(8);
  });

  it('redacts passwords in database connection URIs', () => {
    const raw = 'Connecting to postgresql://admin:superSecretPassword123@db.internal:5432/main';
    const redacted = redactSensitiveTokens(raw);
    expect(redacted).toBe('Connecting to postgresql://admin:*****@db.internal:5432/main');
  });

  it('redacts Redis connection credentials', () => {
    const raw = 'Connecting to redis://default:secretAuthToken@redis.internal:6379';
    const redacted = redactSensitiveTokens(raw);
    expect(redacted).toBe('Connecting to redis://default:*****@redis.internal:6379');
  });

  it('redacts bearer tokens and API keys in JSON and strings', () => {
    const raw = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token12345';
    const redacted = redactSensitiveTokens(raw);
    expect(redacted).toContain('Bearer "[REDACTED]"');
  });

  it('sanitizes nested log objects cleanly', () => {
    const obj = {
      message: 'User login attempt',
      password: 'MySecretPassword!',
      apiKey: 'sec_12345678901234567890',
      safeField: 'hello',
    };

    const sanitized = sanitizeLogObject(obj);
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.safeField).toBe('hello');
  });
});
