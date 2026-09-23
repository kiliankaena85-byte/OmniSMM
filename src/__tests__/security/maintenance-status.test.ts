import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/maintenance-status/route';

describe('Maintenance Status Security Suite (P0-2)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns isMaintenanceMode: false and no isStaff or x-build-id when not in maintenance', async () => {
    process.env.MAINTENANCE_MODE = 'false';
    const req = new Request('http://localhost:3000/api/maintenance-status');
    const response = await GET(req);
    const json = await response.json();

    expect(json.isMaintenanceMode).toBe(false);
    expect(json.isStaff).toBeUndefined();
    expect(json.supportTelegram).toBeUndefined();
    expect(json.supportEmail).toBeUndefined();
    expect(response.headers.get('x-build-id')).toBeNull();
  });

  it('returns generic message and no contacts or isStaff when in maintenance', async () => {
    process.env.MAINTENANCE_MODE = 'true';
    const req = new Request('http://localhost:3000/api/maintenance-status');
    const response = await GET(req);
    const json = await response.json();

    expect(json.isMaintenanceMode).toBe(true);
    expect(json.isStaff).toBeUndefined();
    expect(json.supportTelegram).toBeUndefined();
    expect(json.supportEmail).toBeUndefined();
    expect(json.message).toBeDefined();
    expect(response.headers.get('x-build-id')).toBeNull();
  });
});
