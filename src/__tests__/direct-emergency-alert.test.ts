import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DirectEmergencyAlertService } from '@/lib/notifications/direct-emergency-alert.service';

describe('DirectEmergencyAlertService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';
    process.env.ADMIN_ALERT_CHAT_ID = '123456789';
  });

  it('should suppress duplicate alerts within cooldown window', async () => {
    // Spy on global fetch
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true })))
    );

    const first = await DirectEmergencyAlertService.sendAlert({
      title: 'TEST_ALERT',
      details: 'First occurrence',
      cooldownKey: 'test_cooldown_key_1',
      cooldownMs: 60_000
    });

    expect(first.success).toBe(true);
    expect(first.suppressed).toBeUndefined();

    // Immediately trigger again with same key
    const second = await DirectEmergencyAlertService.sendAlert({
      title: 'TEST_ALERT',
      details: 'Second occurrence',
      cooldownKey: 'test_cooldown_key_1',
      cooldownMs: 60_000
    });

    expect(second.success).toBe(true);
    expect(second.suppressed).toBe(true);

    fetchSpy.mockRestore();
  });

  it('should format worker down alert properly', async () => {
    const alertSpy = vi.spyOn(DirectEmergencyAlertService, 'sendAlert').mockResolvedValue({ success: true });

    await DirectEmergencyAlertService.sendWorkerDownAlert(45, 12);

    expect(alertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cooldownKey: 'worker_down_alert',
        severity: 'CRITICAL',
        title: expect.stringContaining('ФОНОВЫЙ ВОРКЕР ОЧЕРЕДЕЙ'),
        details: expect.stringContaining('45 сек назад'),
        metadata: { lastSeenSeconds: 45, waitingJobsCount: 12 }
      })
    );

    alertSpy.mockRestore();
  });

  it('should format stuck orders alert properly', async () => {
    const alertSpy = vi.spyOn(DirectEmergencyAlertService, 'sendAlert').mockResolvedValue({ success: true });

    await DirectEmergencyAlertService.sendStuckOrdersAlert(3, 15, [370, 371, 372]);

    expect(alertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cooldownKey: 'stuck_orders_alert',
        severity: 'CRITICAL',
        title: expect.stringContaining('ОБНАРУЖЕНЫ ЗАВИСШИЕ ЗАКАЗЫ'),
        details: expect.stringContaining('#370, #371, #372'),
        metadata: { stuckOrdersCount: 3, oldestOrderMinutes: 15, sampleOrderIds: [370, 371, 372] }
      })
    );

    alertSpy.mockRestore();
  });
});
