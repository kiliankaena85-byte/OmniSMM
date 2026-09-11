import { describe, it, expect } from 'vitest';
import { 
  SESSION_COOKIE_NAME, 
  LEGACY_SESSION_COOKIE_NAME, 
  resolveSessionCookieName,
  readSessionTokenFromCookies 
} from '@/lib/session-edge';

describe('Session Cookie Hardening & Dual-Read Migration Suite (SPEC-2026-09-11)', () => {
  it('resolves __Host- prefix in production environment to prevent Cookie Tossing', () => {
    expect(resolveSessionCookieName(true)).toBe('__Host-session_token');
    expect(resolveSessionCookieName(false)).toBe('session_token');
  });

  it('correctly reads token with Dual-Read priority (__Host- over legacy)', () => {
    // 1. Only legacy cookie present
    const legacyOnlyStore = {
      get: (name: string) => (name === LEGACY_SESSION_COOKIE_NAME ? { value: 'legacy_jwt_123' } : undefined),
    };
    expect(readSessionTokenFromCookies(legacyOnlyStore)).toBe('legacy_jwt_123');

    // 2. Both cookies present -> __Host- takes strict priority
    const bothStore = {
      get: (name: string) => {
        if (name === '__Host-session_token') return { value: 'hardened_jwt_456' };
        if (name === LEGACY_SESSION_COOKIE_NAME) return { value: 'legacy_jwt_123' };
        return undefined;
      },
    };
    expect(readSessionTokenFromCookies(bothStore)).toBe('hardened_jwt_456');

    // 3. No cookies present
    const emptyStore = {
      get: () => undefined,
    };
    expect(readSessionTokenFromCookies(emptyStore)).toBeUndefined();
  });
});
