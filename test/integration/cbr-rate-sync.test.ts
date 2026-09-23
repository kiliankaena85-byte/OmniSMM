import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CBRRateService } from '@/services/system/cbr-rate.service';
import { db } from '@/lib/db';

describe('CBR Rate Synchronization Integration', () => {
  beforeEach(async () => {
    // Unstub globals for integration test to allow real network requests
    vi.unstubAllGlobals();
    
    // Ensure "smmplan" settings row exists in DB
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      create: { id: 'smmplan', exchangeRateUSD: 90.0 },
      update: { exchangeRateUSD: 90.0 }
    });
  });

  afterEach(() => {
    // Re-stub globals to not affect other tests in the suite
    vi.stubGlobal('fetch', vi.fn());
  });

  it('connects to live CBR over the real internet, parses rate, and updates DB', async () => {
    const result = await CBRRateService.syncCBRExchangeRate('smmplan');
    
    expect(result.updated).toBe(true);
    expect(result.nominalRate).toBeGreaterThan(50);
    expect(result.nominalRate).toBeLessThan(200);
    
    const expectedSystemRate = parseFloat((result.nominalRate * 1.03).toFixed(2));
    expect(result.systemRate).toBe(expectedSystemRate);

    // Verify database update
    const dbSettings = await db.systemSettings.findUnique({
      where: { id: 'smmplan' }
    });
    expect(dbSettings?.exchangeRateUSD).toBe(expectedSystemRate);
    expect(dbSettings?.exchangeRateUpdatedAt).not.toBeNull();
  });

  it('falls back to JSON mirror if official XML API fails', async () => {
    // We stub fetch to fail for the XML URL, but let it proceed for the JSON mirror
    const originalFetch = globalThis.fetch;
    
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: any) => {
      if (url.includes('XML_daily.asp')) {
        throw new Error('XML API Network Failure Simulation');
      }
      // Otherwise, call original fetch for the JSON API mirror
      return originalFetch(url, init);
    }));

    const result = await CBRRateService.syncCBRExchangeRate('smmplan');

    expect(result.updated).toBe(true);
    expect(result.nominalRate).toBeGreaterThan(50);
    expect(result.nominalRate).toBeLessThan(200);
    
    const expectedSystemRate = parseFloat((result.nominalRate * 1.03).toFixed(2));
    expect(result.systemRate).toBe(expectedSystemRate);

    const dbSettings = await db.systemSettings.findUnique({
      where: { id: 'smmplan' }
    });
    expect(dbSettings?.exchangeRateUSD).toBe(expectedSystemRate);
  });
});
