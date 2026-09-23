import crypto from 'crypto';

let devShieldSecret: string | null = null;

/**
 * Resolves the secret key for DDoS Shield Gatekeeper token and PoW signatures.
 * Fail-Closed (SEC-03):
 * - In production: Must be explicitly configured via DDOS_SHIELD_SECRET or JWT_SIGNING_KEY / JWT_SECRET.
 *   Throws a fatal error if unconfigured.
 * - In development/test: Generates a cryptographically strong random 256-bit secret in memory
 *   on startup. Never uses a hardcoded or published fallback string.
 */
export function getShieldSecret(): string {
  const envSecret =
    process.env.DDOS_SHIELD_SECRET ||
    process.env.JWT_SIGNING_KEY ||
    process.env.JWT_SECRET;

  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[CRITICAL SEC-03] DDOS_SHIELD_SECRET, JWT_SIGNING_KEY, or JWT_SECRET must be configured in production environment.'
    );
  }

  // Non-production fallback: Ephemeral random 32-byte secret generated per process runtime
  if (!devShieldSecret) {
    devShieldSecret = crypto.randomBytes(32).toString('hex');
  }

  return devShieldSecret;
}

/** Reset internal dev secret (useful for tests) */
export function _resetDevShieldSecretForTest(): void {
  devShieldSecret = null;
}
