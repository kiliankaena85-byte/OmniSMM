import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifySmartCaptchaToken } from '@/services/security/smartcaptcha.service';

describe('Yandex SmartCaptcha Service Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('skips validation gracefully when SMARTCAPTCHA_SERVER_KEY is not set', async () => {
    delete process.env.SMARTCAPTCHA_SERVER_KEY;
    const res = await verifySmartCaptchaToken(null);
    expect(res.success).toBe(true);
  });

  it('rejects request when SMARTCAPTCHA_SERVER_KEY is set but token is missing', async () => {
    process.env.SMARTCAPTCHA_SERVER_KEY = 'ysc_secret_test';
    const res = await verifySmartCaptchaToken('');
    expect(res.success).toBe(false);
    expect(res.error).toContain('капчи');
  });

  it('validates token successfully when Yandex returns status ok', async () => {
    process.env.SMARTCAPTCHA_SERVER_KEY = 'ysc_secret_test';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    global.fetch = fetchMock;

    const res = await verifySmartCaptchaToken('valid_captcha_token', '192.168.1.1');
    expect(res.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://smartcaptcha.yandexcloud.net/validate?secret=ysc_secret_test&token=valid_captcha_token&ip=192.168.1.1'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns failure when Yandex returns failed status', async () => {
    process.env.SMARTCAPTCHA_SERVER_KEY = 'ysc_secret_test';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'failed', message: 'invalid token' }),
    });

    const res = await verifySmartCaptchaToken('expired_or_fake_token');
    expect(res.success).toBe(false);
    expect(res.error).toContain('капчи');
  });

  it('handles fetch timeout or network rejection gracefully', async () => {
    process.env.SMARTCAPTCHA_SERVER_KEY = 'ysc_secret_test';
    global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

    const res = await verifySmartCaptchaToken('any_token');
    expect(res.success).toBe(false);
    expect(res.error).toContain('капчи');
  });
});
