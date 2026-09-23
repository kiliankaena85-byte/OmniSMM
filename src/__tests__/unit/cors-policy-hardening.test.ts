import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAllowedCorsOrigin } from '@/proxy';

describe('CORS-01: Strict CORS Origin Whitelisting & Credential Isolation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Production Whitelist Rules', () => {
    it('permits official platform root domains and their subdomains in production', () => {
      (process.env as any).NODE_ENV = 'production';

      expect(isAllowedCorsOrigin('https://smmplan.pro')).toBe(true);
      expect(isAllowedCorsOrigin('https://www.smmplan.pro')).toBe(true);
      expect(isAllowedCorsOrigin('https://smmflux.ru')).toBe(true);
      expect(isAllowedCorsOrigin('https://api.smmflux.ru')).toBe(true);
      expect(isAllowedCorsOrigin('https://test.smmplan.pro')).toBe(true);
    });

    it('strictly forbids localhost, 127.0.0.1, and loopback IPs in production', () => {
      (process.env as any).NODE_ENV = 'production';

      expect(isAllowedCorsOrigin('http://localhost:3000')).toBe(false);
      expect(isAllowedCorsOrigin('http://localhost:3005')).toBe(false);
      expect(isAllowedCorsOrigin('http://127.0.0.1:3000')).toBe(false);
      expect(isAllowedCorsOrigin('http://0.0.0.0:3000')).toBe(false);
      expect(isAllowedCorsOrigin('http://app.local')).toBe(false);
    });

    it('strictly blocks arbitrary third-party attacker domains', () => {
      (process.env as any).NODE_ENV = 'production';

      expect(isAllowedCorsOrigin('https://evil.com')).toBe(false);
      expect(isAllowedCorsOrigin('https://attacker-smmplan.pro.evil.com')).toBe(false);
      expect(isAllowedCorsOrigin('https://smmplan.pro.attacker.com')).toBe(false);
      expect(isAllowedCorsOrigin('https://fake-smmflux.ru.com')).toBe(false);
    });

    it('handles malformed origins and null values safely without crashing', () => {
      expect(isAllowedCorsOrigin(null)).toBe(false);
      expect(isAllowedCorsOrigin(undefined)).toBe(false);
      expect(isAllowedCorsOrigin('')).toBe(false);
      expect(isAllowedCorsOrigin('not-a-valid-url')).toBe(false);
      expect(isAllowedCorsOrigin('javascript:alert(1)')).toBe(false);
    });
  });

  describe('Non-Production Flexibility', () => {
    it('allows localhost and loopback in development and test environments', () => {
      (process.env as any).NODE_ENV = 'development';

      expect(isAllowedCorsOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedCorsOrigin('http://127.0.0.1:3005')).toBe(true);
      expect(isAllowedCorsOrigin('https://desktop-25m6el7.tailbb9d28.ts.net')).toBe(true);
    });
  });
});
