import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('Maintenance Mode Webhook Routing Gate (RAC-2026)', () => {
  const originalMaintenanceMode = process.env.MAINTENANCE_MODE;

  beforeEach(() => {
    process.env.MAINTENANCE_MODE = 'true';
  });

  afterEach(() => {
    process.env.MAINTENANCE_MODE = originalMaintenanceMode;
  });

  it('allows payment webhooks to pass through without 503 during maintenance mode', async () => {
    const webhookPaths = [
      '/api/webhooks/yookassa',
      '/api/webhooks/robokassa',
      '/api/webhooks/crypto',
      '/api/webhooks/telegram',
      '/api/webhooks/yookassa/flux',
      '/api/webhooks/robokassa/agency',
    ];

    for (const path of webhookPaths) {
      const req = new NextRequest(`https://smmplan.pro${path}`, {
        method: 'POST',
        headers: {
          host: 'smmplan.pro',
        },
      });

      const response = await proxy(req);
      // Must NOT be 503 Service Unavailable
      expect(response.status).not.toBe(503);
    }
  });

  it('allows health check and maintenance status endpoints during maintenance mode', async () => {
    const paths = ['/api/health', '/api/maintenance-status', '/robots.txt', '/security.txt'];

    for (const path of paths) {
      const req = new NextRequest(`https://smmplan.pro${path}`, {
        method: 'GET',
        headers: {
          host: 'smmplan.pro',
        },
      });

      const response = await proxy(req);
      expect(response.status).not.toBe(503);
    }
  });

  it('rejects regular API routes with 503 during maintenance mode', async () => {
    const blockedApiPaths = [
      '/api/admin/services',
      '/api/user/balance',
      '/api/orders/create',
      '/api/catalog/sync',
    ];

    for (const path of blockedApiPaths) {
      const req = new NextRequest(`https://smmplan.pro${path}`, {
        method: 'POST',
        headers: {
          host: 'smmplan.pro',
        },
      });

      const response = await proxy(req);
      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.error).toContain('Platform under maintenance');
      expect(response.headers.get('Retry-After')).toBe('3600');
    }
  });

  it('redirects UI pages to home during maintenance mode', async () => {
    const req = new NextRequest('https://smmplan.pro/dashboard', {
      method: 'GET',
      headers: {
        host: 'smmplan.pro',
        'x-forwarded-proto': 'https',
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('https://smmplan.pro/');
  });
});
