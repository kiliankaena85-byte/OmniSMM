import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processGeoAvailabilityCheck } from '../geo-availability.processor';
import { GeoAvailabilityService, GeoAvailabilityReport } from '@/services/telemetry/geo-availability.service';
import * as notifications from '@/lib/notifications';
import { redis } from '@/lib/redis';

// Mock Redis and notifications
vi.mock('@/lib/redis', () => {
  const store: Record<string, string> = {};
  return {
    redis: {
      get: vi.fn().mockImplementation(async (key: string) => store[key] || null),
      set: vi.fn().mockImplementation(async (key: string, val: string) => {
        store[key] = val;
        return 'OK';
      }),
      del: vi.fn().mockImplementation(async (key: string) => {
        delete store[key];
        return 1;
      }),
      __store: store,
    },
  };
});

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
  sendAdminAlertSync: vi.fn().mockResolvedValue(true),
}));

describe('GeoAvailabilityProcessor — Background Watchdog Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const store = (redis as any).__store;
    if (store) {
      for (const k of Object.keys(store)) delete store[k];
    }
  });

  it('runs normal healthy check without triggering alerts', async () => {
    const mockReport: GeoAvailabilityReport = {
      targetUrl: 'https://test.smmplan.pro',
      timestamp: new Date().toISOString(),
      ruRate: 1.0,
      ruTotal: 2,
      ruPassed: 2,
      globalRate: 1.0,
      globalTotal: 6,
      globalPassed: 6,
      avgResponseTimeMs: 110,
      verdict: 'ALL_GREEN',
      verdictText: '🟢 Полная доступность в РФ и мире',
      permanentLink: 'https://check-host.net/check-report/111',
      nodes: [],
    };

    vi.spyOn(GeoAvailabilityService, 'checkAvailability').mockResolvedValue(mockReport);
    const sendAlertSpy = vi.spyOn(notifications, 'sendAdminAlert');

    const res = await processGeoAvailabilityCheck();

    expect(res.status).toBe('ALL_GREEN');
    expect(res.ruRate).toBe(1.0);
    expect(res.alertSent).toBe(false);
    expect(sendAlertSpy).not.toHaveBeenCalled();
  });

  it('detects Russian ISP block and sends CRITICAL Telegram alert to Owner', async () => {
    const mockReport: GeoAvailabilityReport = {
      targetUrl: 'https://smmplan.pro',
      timestamp: new Date().toISOString(),
      ruRate: 0.0,
      ruTotal: 2,
      ruPassed: 0,
      globalRate: 1.0,
      globalTotal: 5,
      globalPassed: 5,
      avgResponseTimeMs: 0,
      verdict: 'RU_BLOCKED',
      verdictText: '🔴 Блокировка в РФ (ТСПУ)',
      permanentLink: 'https://check-host.net/check-report/blocked999',
      nodes: [],
    };

    vi.spyOn(GeoAvailabilityService, 'checkAvailability').mockResolvedValue(mockReport);
    const sendAlertSpy = vi.spyOn(notifications, 'sendAdminAlert');

    const res = await processGeoAvailabilityCheck();

    expect(res.status).toBe('RU_BLOCKED');
    expect(res.alertSent).toBe(true);
    expect(sendAlertSpy).toHaveBeenCalledWith(
      expect.stringContaining('СБОЙ ДОСТУПНОСТИ САЙТА ИЗ РОССИИ'),
      'CRITICAL'
    );
  });

  it('deduplicates repetitive failure alerts within cooldown window', async () => {
    const mockReport: GeoAvailabilityReport = {
      targetUrl: 'https://test.smmplan.pro',
      timestamp: new Date().toISOString(),
      ruRate: 0.0,
      ruTotal: 2,
      ruPassed: 0,
      globalRate: 1.0,
      globalTotal: 5,
      globalPassed: 5,
      avgResponseTimeMs: 0,
      verdict: 'RU_BLOCKED',
      verdictText: '🔴 Блокировка в РФ',
      permanentLink: '',
      nodes: [],
    };

    vi.spyOn(GeoAvailabilityService, 'checkAvailability').mockResolvedValue(mockReport);
    const sendAlertSpy = vi.spyOn(notifications, 'sendAdminAlert');

    // First failure -> Alert sent
    const res1 = await processGeoAvailabilityCheck();
    expect(res1.alertSent).toBe(true);
    expect(sendAlertSpy).toHaveBeenCalledTimes(1);

    // Second failure 1 minute later -> Suppressed (Cooldown)
    const res2 = await processGeoAvailabilityCheck();
    expect(res2.alertSent).toBe(false);
    expect(sendAlertSpy).toHaveBeenCalledTimes(1);
  });

  it('triggers RECOVERY alert and resets state when site becomes accessible again in Russia', async () => {
    const blockedReport: GeoAvailabilityReport = {
      targetUrl: 'https://test.smmplan.pro',
      timestamp: new Date().toISOString(),
      ruRate: 0.0,
      ruTotal: 2,
      ruPassed: 0,
      globalRate: 1.0,
      globalTotal: 5,
      globalPassed: 5,
      avgResponseTimeMs: 0,
      verdict: 'RU_BLOCKED',
      verdictText: '🔴 Блокировка в РФ',
      permanentLink: '',
      nodes: [],
    };

    const healthyReport: GeoAvailabilityReport = {
      targetUrl: 'https://test.smmplan.pro',
      timestamp: new Date().toISOString(),
      ruRate: 1.0,
      ruTotal: 2,
      ruPassed: 2,
      globalRate: 1.0,
      globalTotal: 6,
      globalPassed: 6,
      avgResponseTimeMs: 95,
      verdict: 'ALL_GREEN',
      verdictText: '🟢 100% Green',
      permanentLink: '',
      nodes: [],
    };

    const checkAvailabilitySpy = vi.spyOn(GeoAvailabilityService, 'checkAvailability');
    const sendAlertSpy = vi.spyOn(notifications, 'sendAdminAlert');

    // 1. Enter blocked state
    checkAvailabilitySpy.mockResolvedValueOnce(blockedReport);
    await processGeoAvailabilityCheck();
    expect(sendAlertSpy).toHaveBeenCalledWith(expect.stringContaining('СБОЙ ДОСТУПНОСТИ'), 'CRITICAL');

    // 2. Recover back to ALL_GREEN
    checkAvailabilitySpy.mockResolvedValueOnce(healthyReport);
    const recoveryRes = await processGeoAvailabilityCheck();

    expect(recoveryRes.alertSent).toBe(true);
    expect(recoveryRes.status).toBe('ALL_GREEN');
    expect(sendAlertSpy).toHaveBeenCalledWith(
      expect.stringContaining('САЙТ СНОВА ДОСТУПЕН ИЗ РОССИИ'),
      'INFO'
    );
  });
});
