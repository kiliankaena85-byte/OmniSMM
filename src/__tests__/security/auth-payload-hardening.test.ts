import { describe, it, expect } from 'vitest';
import { passwordLoginSchema } from '@/lib/validators/auth-schemas';

describe('Auth Payload Hardening & Anti-DoS Suite (SPEC-2026-09-11)', () => {
  it('rejects password longer than 72 characters to prevent Argon2/Bcrypt CPU exhaustion', () => {
    const hugePassword = 'A'.repeat(73);
    const result = passwordLoginSchema.safeParse({
      email: 'valid.user@example.com',
      password: hugePassword,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/длинн|72|максимум/i);
    }
  });

  it('rejects email longer than 254 characters according to RFC 5321 standard', () => {
    const tooLongEmail = 'a'.repeat(245) + '@gmail.com'; // 255 chars
    const resultTooLong = passwordLoginSchema.safeParse({
      email: tooLongEmail,
      password: 'StrongPassword123!',
    });

    expect(resultTooLong.success).toBe(false);
    if (!resultTooLong.success) {
      expect(resultTooLong.error.errors[0].message).toMatch(/длинн|email/i);
    }
  });

  it('accepts valid credentials within strict limits', () => {
    const result = passwordLoginSchema.safeParse({
      email: 'test.account@smmplan.pro',
      password: 'SecurePassword2026!',
    });

    expect(result.success).toBe(true);
  });
});
