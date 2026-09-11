import { jwtVerify } from 'jose';
import { normalizeTenantId, type ContourId } from '@/lib/tenant-resolver-edge';

export const LEGACY_SESSION_COOKIE_NAME = 'session_token';

export function resolveSessionCookieName(isProduction: boolean = process.env.NODE_ENV === 'production'): string {
  return isProduction ? '__Host-session_token' : LEGACY_SESSION_COOKIE_NAME;
}

export const SESSION_COOKIE_NAME = resolveSessionCookieName();

/**
 * Universal Dual-Read helper for session tokens.
 * Works seamlessly with Next.js RequestCookies (Request.cookies) and ReadonlyRequestCookies (cookies()).
 */
export function readSessionTokenFromCookies(cookieStoreOrRequest: {
  get: (name: string) => { value: string } | undefined;
}): string | undefined {
  // 1. First priority: Hardened __Host- prefix cookie
  const hardenedToken = cookieStoreOrRequest.get('__Host-session_token')?.value;
  if (hardenedToken) return hardenedToken;

  // 2. Second priority: Legacy cookie for seamless session persistence during migration
  return cookieStoreOrRequest.get(LEGACY_SESSION_COOKIE_NAME)?.value;
}

let cachedEncodedKey: Uint8Array | null = null;
let cachedPreviousKeys: Uint8Array[] | null = null;

export function getEncodedKey(): Uint8Array {
  if (cachedEncodedKey) return cachedEncodedKey;
  let secret = process.env.JWT_SIGNING_KEY;
  if (!secret) {
    if (process.env.CONTOUR === 'test' && process.env.JWT_SECRET_TEST) {
      secret = process.env.JWT_SECRET_TEST;
    } else if (process.env.CONTOUR === 'prod' && process.env.JWT_SECRET_PROD) {
      secret = process.env.JWT_SECRET_PROD;
    } else {
      secret = process.env.JWT_SECRET;
    }
  }

  if (!secret) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is not set. ' +
      'This is required for session security. Add it to your .env file.'
    );
  }

  // Security Invariant: Abort if placeholder secret is used in production (P3-22)
  if (process.env.NODE_ENV === 'production' && (
    secret.includes('CHANGE_ME') || 
    secret.includes('GENERATE_WITH') || 
    secret.includes('INSECURE')
  )) {
    throw new Error('FATAL [SECURITY]: Insecure default JWT_SECRET placeholder detected in production environment!');
  }

  cachedEncodedKey = new TextEncoder().encode(secret);
  return cachedEncodedKey;
}

export function getVerificationKeys(): Uint8Array[] {
  const primary = getEncodedKey();
  if (cachedPreviousKeys) return [primary, ...cachedPreviousKeys];

  const prevEnv = process.env.JWT_VERIFY_PREVIOUS_KEYS;
  if (prevEnv) {
    cachedPreviousKeys = prevEnv
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .map((k) => new TextEncoder().encode(k));
  } else {
    cachedPreviousKeys = [];
  }

  return [primary, ...cachedPreviousKeys];
}

/**
 * Decrypts JWT session token in an Edge-safe manner (supporting dual-key verification).
 */
export async function decryptSessionToken(token: string) {
  const keys = getVerificationKeys();

  for (const key of keys) {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
      });
      const parsed = payload as { 
        sessionId: string; 
        userId: string; 
        role?: string; 
        tenantId: string; 
        contour?: ContourId;
        canResetPassword?: boolean;
        sessionVer?: number;
      };
      if (parsed && parsed.tenantId) {
        parsed.tenantId = normalizeTenantId(parsed.tenantId);
      }
      return parsed;
    } catch {
      // Continue trying next key in verification chain
    }
  }

  return null;
}
