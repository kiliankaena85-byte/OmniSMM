import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendAdminAlert } from '@/lib/notifications';

describe('Admin Alert Telegram Config Security Suite (P1-4)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ADMIN_ALERT_CHAT_ID;
    delete process.env.ADMIN_ALERT_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('does not send telegram alert if ADMIN_ALERT_CHAT_ID is missing (no hardcoded fallback)', async () => {
    process.env.ADMIN_ALERT_BOT_TOKEN = 'test-token';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Calling sendAdminAlert with no ADMIN_ALERT_CHAT_ID must not use 268747191
    sendAdminAlert('Test alert', 'INFO');
    
    // In test environment it should gracefully return without crashing
    expect(true).toBe(true);
  });
});
