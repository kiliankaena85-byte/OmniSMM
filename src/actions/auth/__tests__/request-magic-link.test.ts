import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { requestMagicLink } from '../request-magic-link';
import { sendMagicLink, sendWelcomeLetter } from '@/lib/smtp';
import { RateLimitService } from '@/services/core/rate-limit.service';

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
  headers: vi.fn(async () => ({
    get: vi.fn((key: string) => (key === 'x-forwarded-for' ? '127.0.0.1' : null)),
  })),
}));

vi.mock('@/lib/smtp', () => ({
  sendMagicLink: vi.fn(),
  sendWelcomeLetter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
    checkCustomKey: vi.fn().mockResolvedValue(true),
  }
}));

describe('Request Magic Link Tests', () => {
  beforeEach(async () => {
    await db.user.deleteMany({
      where: { email: { in: ['magic_new@smmplan.local', 'magic_new2@smmplan.local', 'magic_existing@smmplan.local'] } }
    });

    await db.user.create({
      data: {
        email: 'magic_existing@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully send magic link to existing user', async () => {
    const formData = new FormData();
    formData.append('email', 'magic_existing@smmplan.local');

    const res = await requestMagicLink({}, formData);
    expect(res).toEqual({ success: true, error: null });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(sendMagicLink).toHaveBeenCalledWith('magic_existing@smmplan.local', expect.any(String), 'smmplan');
  });

  it('should create new user and send magic link if user does not exist', async () => {
    const formData = new FormData();
    formData.append('email', 'magic_new@smmplan.local');

    const res = await requestMagicLink({}, formData);
    expect(res).toEqual({ success: true, error: null });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(sendMagicLink).toHaveBeenCalledWith('magic_new@smmplan.local', expect.any(String), 'smmplan');
    
    const user = await db.user.findUnique({ where: { email_tenantId: { email: 'magic_new@smmplan.local', tenantId: 'smmplan' } } });
    expect(user).not.toBeNull();
  });

  it('should delete newly created user if SMTP fails', async () => {
    vi.mocked(sendMagicLink).mockRejectedValueOnce(new Error('SMTP Error'));

    const formData = new FormData();
    formData.append('email', 'magic_new2@smmplan.local');

    const res = await requestMagicLink({}, formData);
    expect(res).toEqual({ success: false, error: "Не удалось отправить письмо. Проверьте правильность email или попробуйте позже." });
    
    expect(sendMagicLink).toHaveBeenCalledWith('magic_new2@smmplan.local', expect.any(String), 'smmplan');

    // The user should have been deleted
    const user = await db.user.findUnique({ where: { email_tenantId: { email: 'magic_new2@smmplan.local', tenantId: 'smmplan' } } });
    expect(user).toBeNull();
  });
});
