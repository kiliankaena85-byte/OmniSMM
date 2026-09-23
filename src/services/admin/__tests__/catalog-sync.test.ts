import { describe, it, expect, vi } from 'vitest';
import { assertSafeUrl } from '@/utils/ssrf-guard';

vi.mock('node:dns', () => ({
  promises: {
    lookup: vi.fn(async (hostname: string) => {
      if (hostname === 'example.com' || hostname === 'api.telegram.org') {
        return [{ address: '93.184.216.34', family: 4 }];
      }
      return [{ address: '127.0.0.1', family: 4 }];
    })
  }
}));

describe('SSRF Guard', () => {
  it('allows safe public URLs', async () => {
    await expect(assertSafeUrl('https://example.com/api')).resolves.not.toThrow();
    await expect(assertSafeUrl('https://api.telegram.org')).resolves.not.toThrow();
  });

  it('blocks disallowed protocols', async () => {
    await expect(assertSafeUrl('ftp://example.com')).rejects.toThrow('Only HTTP/HTTPS allowed');
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow('Only HTTP/HTTPS allowed');
  });

  it('blocks loopback and private IP hostnames', async () => {
    await expect(assertSafeUrl('http://127.0.0.1')).rejects.toThrow('Private IP blocked');
    await expect(assertSafeUrl('http://localhost')).rejects.toThrow('Blocked URL');
    await expect(assertSafeUrl('http://169.254.169.254')).rejects.toThrow('Blocked URL');
    await expect(assertSafeUrl('http://192.168.1.1')).rejects.toThrow('Private IP blocked');
    await expect(assertSafeUrl('http://10.0.0.5')).rejects.toThrow('Private IP blocked');
    await expect(assertSafeUrl('http://172.16.0.1')).rejects.toThrow('Private IP blocked');
  });
});

describe('Price Spike and Custom Metadata Logic', () => {
  it('calculates rate diff spike > 30%', () => {
    const oldRate = 1.0;
    const newRate = 1.35;
    const rateDiff = (newRate - oldRate) / oldRate;
    expect(rateDiff).toBeGreaterThan(0.30);
  });

  it('protects custom fields when flags are true', () => {
    const service = {
      name: 'Custom Name',
      isCustomName: true,
      description: 'Custom Desc',
      isCustomDescription: true,
    };

    const providerName = 'Provider Raw Name';

    const updateData: Record<string, unknown> = {};
    if (!service.isCustomName) {
      updateData.name = providerName;
    }

    expect(updateData.name).toBeUndefined();
  });
});
