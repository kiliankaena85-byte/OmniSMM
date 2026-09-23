import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P0AlertDebouncer } from '@/lib/alerts/p0-alert-debouncer';
import { sendAdminAlertSync } from '@/lib/notifications';

vi.mock('@/lib/emergency-email', () => ({
  EmergencyEmailService: {
    sendAlert: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-mock-123' }),
  },
}));

describe('Smart Alert Deduplication & DLQ Triage (Zero-Spam & Zero Silent Drops)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_ALERT_BOT_TOKEN = 'mock_bot_token';
    process.env.ADMIN_ALERT_CHAT_ID = '268747191';
  });

  it('[Zero-Spam Deduplication] Suppresses duplicate alerts within cooldown window and tracks occurrence count', async () => {
    const alertKey = 'test:error:' + Date.now();

    // 1. First occurrence -> ALLOW SEND
    const firstCheck = await P0AlertDebouncer.checkDeduplicatedAlert(alertKey, 60);
    expect(firstCheck.shouldSend).toBe(true);
    expect(firstCheck.occurrences).toBe(1);

    // 2. 50 rapid duplicate occurrences -> SUPPRESS SEND
    for (let i = 0; i < 50; i++) {
      const duplicateCheck = await P0AlertDebouncer.checkDeduplicatedAlert(alertKey, 60);
      expect(duplicateCheck.shouldSend).toBe(false);
    }

    // 3. Reset lock -> Next occurrence should ALLOW SEND
    await P0AlertDebouncer.resetLock(alertKey);
    const afterResetCheck = await P0AlertDebouncer.checkDeduplicatedAlert(alertKey, 60);
    expect(afterResetCheck.shouldSend).toBe(true);
  });

  it('[Zero Silent Drops] Financial P0 Critical Alerts are always dispatched immediately with dual cascade', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 999 } }),
      text: async () => JSON.stringify({ ok: true }),
    });

    const { EmergencyEmailService } = await import('@/lib/emergency-email');

    await sendAdminAlertSync('Payment Gateway Dropped - Urgent Action Required', 'CRITICAL');

    expect(global.fetch).toHaveBeenCalled();
    expect(EmergencyEmailService.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'CRITICAL',
        title: 'P0 Critical Incident Detected',
      })
    );

    global.fetch = originalFetch;
  });
});
