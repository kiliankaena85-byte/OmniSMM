import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { registerWithPasswordAction } from '../password-register';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { createSession } from '@/lib/session';
import { sendMagicLink } from '@/lib/smtp';

vi.mock('@/lib/session', () => ({
  createSession: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock('@/lib/smtp', () => ({
  sendMagicLink: vi.fn().mockResolvedValue(true),
}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
    checkCustomKey: vi.fn().mockResolvedValue(true),
  }
}));

describe('Password Registration Tests', () => {
  beforeEach(async () => {
    // Clear test users
    await db.user.deleteMany({
      where: { email: { in: ['reg_new@smmplan.local', 'reg_existing@smmplan.local'] } }
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('should successfully register a new user and create a session', async () => {
    const formData = new FormData();
    formData.append('email', 'reg_new@smmplan.local');
    formData.append('password', 'ValidPassword123!');

    const res = await registerWithPasswordAction(null, formData);
    expect(res.success).toBe(true);
    expect(res.error).toBeNull();
    expect(res.message).toBeDefined();

    const createdUser = await db.user.findUnique({ where: { email_tenantId: { email: 'reg_new@smmplan.local', tenantId: 'smmplan' } } });
    expect(createdUser).not.toBeNull();
    expect(createdUser?.role).toBeDefined();
    expect(createdUser?.isEmailVerified).toBe(false);
    expect(createSession).not.toHaveBeenCalled();
    expect(sendMagicLink).toHaveBeenCalledWith('reg_new@smmplan.local', expect.any(String), 'smmplan');
  });

  it('should fail if email is already registered', async () => {
    // Pre-create user
    await db.user.create({
      data: {
        email: 'reg_existing@smmplan.local',
        role: 'USER',
        isActive: true,
      }
    });

    const formData = new FormData();
    formData.append('email', 'reg_existing@smmplan.local');
    formData.append('password', 'ValidPassword123!');

    const res = await registerWithPasswordAction(null, formData);
    expect(res.success).toBe(false);
    expect(res.error).toContain('уже зарегистрирован');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('should enforce rate limits on IP-level registration', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValueOnce(false);

    const formData = new FormData();
    formData.append('email', 'reg_new@smmplan.local');
    formData.append('password', 'ValidPassword123!');

    const res = await registerWithPasswordAction(null, formData);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Превышен лимит регистраций');
    expect(createSession).not.toHaveBeenCalled();
  });
});
