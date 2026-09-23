import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendAdminAlert, sendAdminAlertSync } from '@/lib/notifications';
import { EmergencyEmailService } from '@/lib/emergency-email';

vi.mock('@/lib/emergency-email', () => ({
  EmergencyEmailService: {
    sendAlert: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-mock-123' }),
  },
}));

vi.mock('@/lib/queue-manager', () => ({
  telegramQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  },
}));

describe('ISO 25010 & NIST CP-9 Compliant Multi-Channel Alert & Failover Cascade', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    process.env.ADMIN_ALERT_BOT_TOKEN = 'mock_bot_token';
    process.env.ADMIN_ALERT_CHAT_ID = '268747191';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('[NIST CP-9 / ISO 25010.4.2] Primary Channel: Dispatches successfully to Telegram when API is operational', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 101 } }), { status: 200 })
    );

    await sendAdminAlertSync('Disk space warning: 88% full', 'WARNING');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/botmock_bot_token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Disk space warning'),
      })
    );
    // Email should NOT be called for WARNING when Telegram succeeds
    expect(EmergencyEmailService.sendAlert).not.toHaveBeenCalled();
  });

  it('[NIST CP-9 / ISO 25010.4.3] Dual Cascade: Dispatches to BOTH Telegram AND Emergency Email for CRITICAL severity', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 102 } }), { status: 200 })
    );

    await sendAdminAlertSync('PostgreSQL Database Connection Dropped', 'CRITICAL');

    expect(global.fetch).toHaveBeenCalled();
    expect(EmergencyEmailService.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'CRITICAL',
        title: 'P0 Critical Incident Detected',
        details: expect.stringContaining('PostgreSQL Database Connection Dropped'),
      })
    );
  });

  it('[NIST CP-9 / Fault Tolerance] Failover Cascade: Triggers Email Alert immediately if Telegram API returns 429 Too Many Requests', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error_code: 429, description: 'Too Many Requests: retry after 30' }), {
        status: 429,
      })
    );

    await sendAdminAlertSync('Provider Rate Limit Exceeded', 'WARNING');

    expect(global.fetch).toHaveBeenCalled();
    expect(EmergencyEmailService.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'WARNING',
        title: expect.stringContaining('Telegram Delivery Failed (429)'),
      })
    );
  });

  it('[NIST CP-9 / Fault Tolerance] Network Failover: Triggers Email Alert immediately if Telegram network throws timeout/exception', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('ETIMEDOUT: Connection to api.telegram.org failed'));

    await sendAdminAlertSync('Payment Gateway Webhook Lag', 'WARNING');

    expect(EmergencyEmailService.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'WARNING',
        title: 'Telegram Network Connection Error',
        details: expect.stringContaining('ETIMEDOUT'),
      })
    );
  });

  it('[ISO 25010.4.1] Degraded Environment: Direct Email dispatch when Telegram credentials are unset', async () => {
    delete process.env.ADMIN_ALERT_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;

    sendAdminAlert('Direct Server Action Crash Alert', 'CRITICAL');

    expect(EmergencyEmailService.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'CRITICAL',
        title: expect.stringContaining('Telegram Unset'),
        details: 'Direct Server Action Crash Alert',
      })
    );
  });
});
