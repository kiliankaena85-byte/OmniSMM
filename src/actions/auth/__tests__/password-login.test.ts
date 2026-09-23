import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { loginWithPasswordAction } from '../password-login';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/session';
import { RateLimitService } from '@/services/core/rate-limit.service';

vi.mock('@/lib/session', () => ({
  createSession: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
    checkCustomKey: vi.fn().mockResolvedValue(true),
  }
}));

describe('Password Login Tests', () => {
  let user: any;
  let adminUser: any;
  const password = 'TestPassword123!';

  beforeEach(async () => {
    // Clear the DB of users created for tests
    await db.user.deleteMany({
      where: { email: { in: ['login_test@smmplan.local', 'admin_login_test@smmplan.local', 'no_password@smmplan.local'] } }
    });

    const passwordHash = await hashPassword(password);

    user = await db.user.create({
      data: {
        email: 'login_test@smmplan.local',
        passwordHash,
        role: 'USER',
        isActive: true,
      },
    });

    adminUser = await db.user.create({
      data: {
        email: 'admin_login_test@smmplan.local',
        passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    });

    await db.user.create({
      data: {
        email: 'no_password@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('should login successfully and redirect to /dashboard for normal user', async () => {
    const formData = new FormData();
    formData.append('email', user.email);
    formData.append('password', password);

    const res = await loginWithPasswordAction({}, formData);
    expect(res).toEqual({ success: true, error: null, redirectTo: '/dashboard' });
    expect(createSession).toHaveBeenCalledWith(user.id);
  });

  it('should login successfully and redirect to /admin/dashboard for admin', async () => {
    const formData = new FormData();
    formData.append('email', adminUser.email);
    formData.append('password', password);

    const res = await loginWithPasswordAction({}, formData);
    expect(res).toEqual({ success: true, error: null, redirectTo: '/admin/dashboard' });
    expect(createSession).toHaveBeenCalledWith(adminUser.id);
  });

  it('should fail with incorrect password', async () => {
    const formData = new FormData();
    formData.append('email', user.email);
    formData.append('password', 'WrongPassword!');

    const res = await loginWithPasswordAction({}, formData);
    expect(res).toEqual({ success: false, error: 'Неверный email или пароль' });
    expect(createSession).not.toHaveBeenCalled();
  });

  it('should fail when user does not exist', async () => {
    const formData = new FormData();
    formData.append('email', 'not_found@smmplan.local');
    formData.append('password', password);

    const res = await loginWithPasswordAction({}, formData);
    expect(res).toEqual({ success: false, error: 'Неверный email или пароль' });
  });

  it('should return specific error when password is not set', async () => {
    const formData = new FormData();
    formData.append('email', 'no_password@smmplan.local');
    formData.append('password', password);

    // Default: SMTP is assumed not configured if env vars are missing, 
    // but let's mock it to make sure we test both branches.
    const originalHost = process.env.SMTP_HOST;
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASSWORD = 'password';

    const res = await loginWithPasswordAction({}, formData);
    expect(res).toEqual({ success: false, error: 'Для вашего аккаунта не установлен пароль. Пожалуйста, войдите по ссылке на почту.' });

    // Branch: SMTP down
    delete process.env.SMTP_HOST;
    const resNoSmtp = await loginWithPasswordAction({}, formData);
    expect(resNoSmtp).toEqual({ success: false, error: 'Вход по ссылке временно недоступен (ошибка почты). Обратитесь в поддержку для установки пароля.' });

    process.env.SMTP_HOST = originalHost; // Restore
  });

  it('should return error when rate limit is exceeded', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValueOnce(false);
    
    const formData = new FormData();
    formData.append('email', user.email);
    formData.append('password', password);

    const res = await loginWithPasswordAction({}, formData);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Слишком много попыток');
  });
});
