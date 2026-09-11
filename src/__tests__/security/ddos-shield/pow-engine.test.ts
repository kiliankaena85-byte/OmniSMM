import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { 
  createPowChallenge, 
  verifyPowSolution,
  signGatekeeperToken,
  verifyGatekeeperToken 
} from '@/lib/security/ddos-shield/pow-engine';

describe('Proof-of-Work Gatekeeper Engine (SPEC-2026-09-11)', () => {
  const TEST_SECRET = 'test-secret-pow-key-minimum-32-chars-long-2026';

  it('creates valid challenge and correctly verifies legitimate solution', () => {
    // Difficulty 2 = SHA-256 starts with "00" (fast test compute)
    const challenge = createPowChallenge(TEST_SECRET, 2);
    expect(challenge.challengeId).toBeDefined();
    expect(challenge.salt).toBeDefined();
    expect(challenge.difficulty).toBe(2);

    // Solve the challenge
    let solvedNonce = 0;
    while (true) {
      const hash = crypto.createHash('sha256')
        .update(`${challenge.salt}:${solvedNonce}`)
        .digest('hex');
      if (hash.startsWith('00')) break;
      solvedNonce++;
    }

    const isValid = verifyPowSolution(challenge, solvedNonce, TEST_SECRET);
    expect(isValid).toBe(true);

    // Incorrect nonce must fail
    const isInvalid = verifyPowSolution(challenge, solvedNonce + 999999, TEST_SECRET);
    expect(isInvalid).toBe(false);
  });

  it('signs and verifies Gatekeeper token with tamper protection', () => {
    const payload = {
      ip: '198.51.100.25',
      fingerprint: 'a'.repeat(64),
      expiresAt: Date.now() + 1800000,
    };

    const token = signGatekeeperToken(payload, TEST_SECRET);
    expect(token).toBeDefined();

    const verified = verifyGatekeeperToken(token, TEST_SECRET);
    expect(verified).not.toBeNull();
    expect(verified?.ip).toBe('198.51.100.25');

    // Tampered token must fail
    const [dataPart, sigPart] = token.split('.');
    const tampered = `${dataPart}x.${sigPart}`;
    expect(verifyGatekeeperToken(tampered, TEST_SECRET)).toBeNull();
  });
});
