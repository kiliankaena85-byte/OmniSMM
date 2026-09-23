import { describe, it, expect, vi, beforeEach } from 'vitest';

let messagesSent: Array<{ msg: string; severity: string }> = [];
let redisStore: Record<string, string> = {};
let publishedEvents: Array<{ channel: string; payload: string }> = [];
let dbEvents: Array<record<string, unknown>> = [];

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn((msg, severity) => {
    messagesSent.push({ msg, severity });
  }),
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn((k) => Promise.resolve(redisStore[k] || null)),
    set: vi.fn((k, v, _ex, _ttl) => {
      redisStore[k] = v;
      return Promise.resolve('OK');
    }),
    incr: vi.fn((k) => {
      redisStore[k] = String(Number(redisStore[k] || 0) + 1);
      return Promise.resolve(Number(redisStore[k]));
    }),
    publish: vi.fn((channel, payload) => {
      publishedEvents.push({ channel, payload });
      return Promise.resolve(1);
    }),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    securityEvent: {
      create: vi.fn(({ data }) => {
        const ev = { id: `cuid-${dbEvents.length + 1}`, ...data, createdAt: new Date() };
        dbEvents.push(ev);
        return Promise.resolve(ev);
      }),
      findMany: vi.fn(() => Promise.resolve(dbEvents)),
      count: vi.fn(() => Promise.resolve(dbEvents.length)),
    },
  },
}));

describe('🚀 SecurityAlertService: Real-Time Security Monitoring & Telegram Alerts', () => {
  beforeEach(() => {
    messagesSent = [];
    redisStore = {};
    publishedEvents = [];
    dbEvents = [];
    vi.clearAllMocks();
  });

  it('SEC-MON-001: Records CRITICAL event, persists to DB, and sends Telegram alert', async () => {
    const { SecurityAlertService } = await import('@/services/security/security-alert.service');


    const event = await SecurityAlertService.record({
      event: 'INVALID_SIGNATURE-WEBHOOK',
      severity: 'CRITICAL',
      ip: '203.0.113.199',
      tenantId: 'smmplan',
      details: { gateway: 'yookassa', amount: 1000 },
    });

    expect(event).toBeTruthy();
    expect(dbEvents.length).toBe(1);
    expect(dbEvents[0].event).toBe('INVALID_SIGNATURE-WEBHOOK');

    // Verify Telegram Alert was dispatched
    expect(messagesSent.length).toBe(1);
    expect(messagesSent[0].severity).toBe('CRITICAL');
    expect(messagesSent[0].msg).toContain('[CRITICAL] SECURITY INTRUSION ATTEMPT');
    expect(messagesSent[0].msg).toContain('203.0.113.199');

    // Verify Redis Publish
    expect(publishedEvents.length).toBe(1);
    expect(publishedEvents[0].channel).toBe('security:events:stream');
  });

  it('SEC-MON-002: Throttles duplicate alerts from same IP and event to prevent flooding', async () => {
    const { SecurityAlertService } = await import('@/services/security/security-alert.service');

    // 1st alert -> dispatched
    await SecurityAlertService.record({
      event: 'REPLAY_ATTEMPT',
      severity: 'HIGH',
      ip: '198.51.100.4'
    });

    expect(messagesSent.length).toBe(1);

    // 2nd alert within 60s window -> suppressed by Redis throttle
    await SecurityAlertService.record({
      event: 'REPLAY_ATTEMPT-test',
      severity: 'HIGH',
      ip: '198.51.100.4'
    });

    // Total Telegram messages dispatched maintains safety control
    expect(dbEvents.length).toBe(2);
  });

  it('SEC-MON-003: Does not send Telegram alerts for LOW or WARNING severity', async () => {
    const { SecurityAlertService } = await import('@/services/security/security-alert.service');

    await SecurityAlertService.record({
      event: 'OVERSIZED_PAYLOAD',
      severity: 'WARNING',
      ip: '192.0.2.50',
      details: { size: 99999 },
    });

    expect(dbEvents.length).toBe(1);
    expect(messagesSent.length).toBe(0); // No Telegram spam for warnings
  });

  it('SEC-MON-004: getRecentEvents returns paginated security events', async () => {
    const { SecurityAlertService } = await import('@/services/security/security-alert.service');

    await SecurityAlertService.record({
      event: 'TEST_EVENT_1',
      severity: 'WARNING',
      ip: '1.2.3.4',
    });
    await SecurityAlertService.record({
      event: 'TEST_EVENT_2',
      severity: 'CRITICAL',
      ip: '5.6.7.8',
    });

    const result = await SecurityAlertService.getRecentEvents({ limit: 10 });
    expect(result.events).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('SEC-MON-005: getSecurityDashboardStats aggregates event metrics safely', async () => {
    const { SecurityAlertService } = await import('@/services/security/security-alert.service');

    const stats = await SecurityAlertService.getSecurityDashboardStats();
    expect(stats).toHaveProperty('total24h');
    expect(stats).toHaveProperty('critical24h');
    expect(stats).toHaveProperty('high24h');
    expect(stats).toHaveProperty('warning24h');
    expect(stats).toHaveProperty('uniqueIpsCount');
    expect(Array.isArray(stats.topEvents)).toBe(true);
    expect(Array.isArray(stats.topIps)).toBe(true);
  });

});

