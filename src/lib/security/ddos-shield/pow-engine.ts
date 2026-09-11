import crypto from 'crypto';

export interface PowChallenge {
  challengeId: string;
  salt: string;
  difficulty: number;
  expiresAt: number;
  signature: string;
}

export interface GatekeeperPayload {
  ip: string;
  fingerprint: string;
  expiresAt: number;
}

/**
 * Creates a stateless Proof-of-Work challenge signed with server secret.
 * Requires client to find a nonce such that SHA256(salt + ":" + nonce) starts with `difficulty` zeros.
 */
export function createPowChallenge(secret: string, difficulty: number = 3): PowChallenge {
  const challengeId = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 300_000; // 5 minutes validity

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${challengeId}:${salt}:${difficulty}:${expiresAt}`)
    .digest('hex');

  return {
    challengeId,
    salt,
    difficulty,
    expiresAt,
    signature,
  };
}

/**
 * Verifies that the client provided a mathematically correct solution to the PoW challenge.
 */
export function verifyPowSolution(challenge: PowChallenge, nonce: number, secret: string): boolean {
  if (Date.now() > challenge.expiresAt) {
    return false;
  }

  // 1. Verify challenge authenticity
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${challenge.challengeId}:${challenge.salt}:${challenge.difficulty}:${challenge.expiresAt}`)
    .digest('hex');

  const sigBuffer = Buffer.from(challenge.signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false;
  }

  // 2. Verify proof of work hash
  const computedHash = crypto
    .createHash('sha256')
    .update(`${challenge.salt}:${nonce}`)
    .digest('hex');

  const requiredPrefix = '0'.repeat(challenge.difficulty);
  return computedHash.startsWith(requiredPrefix);
}

/**
 * Issues an HMAC-signed Gatekeeper token granted upon successful PoW challenge completion.
 */
export function signGatekeeperToken(payload: GatekeeperPayload, secret: string): string {
  const dataBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataBase64)
    .digest('hex');

  return `${dataBase64}.${signature}`;
}

/**
 * Verifies authenticity and freshness of the Gatekeeper token.
 */
export function verifyGatekeeperToken(token: string, secret: string): GatekeeperPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [dataBase64, signatureHex] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(dataBase64)
      .digest('hex');

    const sigBuffer = Buffer.from(signatureHex, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const payload: GatekeeperPayload = JSON.parse(Buffer.from(dataBase64, 'base64url').toString('utf8'));

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
