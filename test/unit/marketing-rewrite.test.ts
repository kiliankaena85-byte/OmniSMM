import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { providerService } from '@/services/providers/provider.service';
import * as adminAudit from '@/lib/admin-audit';
import { rebrandServices } from '../../scripts/marketing-description-rewriter';

describe('Marketing Description Rewriter Script', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalArgv: string[];

  // Define spied functions we want to mock behavior on
  let findManySpy: any;
  let updateSpy: any;
  let auditSpy: any;
  let redisGetSpy: any;
  let redisSetexSpy: any;
  let providerInstanceSpy: any;
  let fetchMock: any;
  let exitSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    // Save process env/argv
    originalEnv = { ...process.env };
    originalArgv = [...process.argv];

    process.env.GEMINI_API_KEY = 'mock-api-key';
    process.env.GEMINI_MODEL = 'gemini-3-flash';

    // Mock process.exit and console to prevent pollution
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit called with code ${code}`);
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock DB operations
    findManySpy = vi.spyOn(db.service, 'findMany').mockResolvedValue([]);
    updateSpy = vi.spyOn(db.service, 'update').mockResolvedValue({} as any);

    // Mock Admin Audit logs
    auditSpy = vi.spyOn(adminAudit, 'auditAdminAwaitable').mockResolvedValue({} as any);

    // Mock Redis
    redisGetSpy = vi.spyOn(redis, 'get').mockResolvedValue(null);
    redisSetexSpy = vi.spyOn(redis, 'setex').mockResolvedValue('OK');

    // Mock provider instance
    const mockProvider = {
      getServices: vi.fn().mockResolvedValue([
        {
          service: 'ext-123',
          name: 'Provider Service Name',
          description: 'Original description from provider',
          rate: '1.5',
          min: '100',
          max: '10000',
          refill: true,
          cancel: true,
          dripfeed: false
        }
      ])
    };
    providerInstanceSpy = vi.spyOn(providerService, 'getProviderInstance').mockResolvedValue(mockProvider as any);

    // Mock fetch for Gemini API
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                name: 'New Optimized Name',
                description: '**Скорость**: Быстро\n**Гарантия**: 30 дней\n**Лимиты**: 100-10000\n**Особенности**: Отличная услуга'
              })
            }]
          }
        }]
      })
    });
  });

  afterEach(() => {
    // Restore process env/argv
    process.env = originalEnv;
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('fails fast if GEMINI_API_KEY is not defined', async () => {
    delete process.env.GEMINI_API_KEY;

    try {
      await rebrandServices();
      expect.fail('Should have thrown due to process.exit');
    } catch (err: any) {
      expect(err.message).toMatch(/process\.exit/);
    }
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: GEMINI_API_KEY is not set in the environment.');
  });

  it('exits gracefully if no active services with externalId exist', async () => {
    findManySpy.mockResolvedValue([]);

    await rebrandServices();

    expect(findManySpy).toHaveBeenCalled();
    expect(providerInstanceSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('processes happy path with cache miss and provider API fetch', async () => {
    const mockServices = [
      {
        id: 'service-1',
        name: 'Old Service Name',
        description: 'Old description',
        categoryId: 'cat-1',
        providerId: 'prov-1',
        externalId: 'ext-123',
        isActive: true,
        provider: {
          id: 'prov-1',
          name: 'Vexboost',
          apiUrl: 'https://vexboost.com/api',
          apiKey: 'secret-key'
        }
      }
    ];
    findManySpy.mockResolvedValue(mockServices as any);

    await rebrandServices();

    // Verify cache check and fallback to provider API
    expect(redisGetSpy).toHaveBeenCalledWith('provider:prov-1:catalog');
    expect(providerInstanceSpy).toHaveBeenCalledWith(mockServices[0].provider);
    expect(redisSetexSpy).toHaveBeenCalledWith(
      'provider:prov-1:catalog',
      86400,
      expect.stringContaining('ext-123')
    );

    // Verify Gemini API call
    expect(fetchMock).toHaveBeenCalled();
    const fetchArgs = fetchMock.mock.calls[0];
    expect(fetchArgs[0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent');
    const requestBody = JSON.parse(fetchArgs[1].body);
    expect(requestBody.system_instruction.parts[0].text).toContain('B2B панели SMM-услуг');
    expect(requestBody.contents[0].parts[0].text).toContain('Old Service Name');

    // Verify database update
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'service-1' },
      data: {
        name: 'New Optimized Name',
        description: '**Скорость**: Быстро\n**Гарантия**: 30 дней\n**Лимиты**: 100-10000\n**Особенности**: Отличная услуга'
      }
    });

    // Verify audit log
    expect(auditSpy).toHaveBeenCalledWith({
      adminId: 'system',
      adminEmail: 'system@smmplan.pro',
      action: 'SERVICE_AUTO_FIX',
      target: 'service-1',
      targetType: 'SERVICE',
      oldValue: {
        name: 'Old Service Name',
        description: 'Old description'
      },
      newValue: {
        name: 'New Optimized Name',
        description: '**Скорость**: Быстро\n**Гарантия**: 30 дней\n**Лимиты**: 100-10000\n**Особенности**: Отличная услуга'
      }
    });
  });

  it('uses cached provider catalog on cache hit', async () => {
    const mockServices = [
      {
        id: 'service-2',
        name: 'Old Service Name 2',
        description: 'Old description 2',
        categoryId: 'cat-2',
        providerId: 'prov-2',
        externalId: 'ext-456',
        isActive: true,
        provider: {
          id: 'prov-2',
          name: 'Vexboost',
          apiUrl: 'https://vexboost.com/api',
          apiKey: 'secret-key-2'
        }
      }
    ];
    findManySpy.mockResolvedValue(mockServices as any);

    // Mock Redis cache hit
    const cachedCatalog = [
      {
        service: 'ext-456',
        name: 'Cached Provider Name',
        description: 'Cached provider description',
        rate: '2.0',
        min: '50',
        max: '5000',
        refill: false,
        cancel: false,
        dripfeed: true
      }
    ];
    redisGetSpy.mockResolvedValue(JSON.stringify(cachedCatalog));

    await rebrandServices();

    // Verify cache hit and no provider API fetch
    expect(redisGetSpy).toHaveBeenCalledWith('provider:prov-2:catalog');
    expect(providerInstanceSpy).not.toHaveBeenCalled();
    expect(redisSetexSpy).not.toHaveBeenCalled();

    // Verify Gemini API call
    expect(fetchMock).toHaveBeenCalled();
    const fetchArgs = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(fetchArgs[1].body);
    expect(requestBody.contents[0].parts[0].text).toContain('Cached Provider Name');

    // Verify DB update
    expect(updateSpy).toHaveBeenCalled();
    expect(auditSpy).toHaveBeenCalled();
  });

  it('runs dry-run mode and prints diff to console without modifying DB/audit', async () => {
    process.argv.push('--dry-run');

    const mockServices = [
      {
        id: 'service-3',
        name: 'Old Service Name 3',
        description: 'Old description 3',
        categoryId: 'cat-3',
        providerId: 'prov-3',
        externalId: 'ext-789',
        isActive: true,
        provider: {
          id: 'prov-3',
          name: 'Vexboost',
          apiUrl: 'https://vexboost.com/api',
          apiKey: 'secret-key-3'
        }
      }
    ];
    findManySpy.mockResolvedValue(mockServices as any);

    const cachedCatalog = [
      {
        service: 'ext-789',
        name: 'Provider Name 3',
        description: 'Provider description 3',
        rate: '3.0',
        min: '10',
        max: '1000',
        refill: true,
        cancel: true,
        dripfeed: true
      }
    ];
    redisGetSpy.mockResolvedValue(JSON.stringify(cachedCatalog));

    await rebrandServices();

    // Verify Gemini API called
    expect(fetchMock).toHaveBeenCalled();

    // Verify NO database updates and NO audit logs
    expect(updateSpy).not.toHaveBeenCalled();
    expect(auditSpy).not.toHaveBeenCalled();

    // Verify console log for dry-run diff
    const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
    expect(logCalls.some((log: any) => log.includes('[DRY-RUN] Proposed updates for Service ID: service-3'))).toBe(true);
    expect(logCalls.some((log: any) => log.includes('Name: "Old Service Name 3" -> "New Optimized Name"'))).toBe(true);
  });

  it('skips update if Gemini output matches current local service name and description', async () => {
    const mockServices = [
      {
        id: 'service-4',
        name: 'New Optimized Name',
        description: '**Скорость**: Быстро\n**Гарантия**: 30 дней\n**Лимиты**: 100-10000\n**Особенности**: Отличная услуга',
        categoryId: 'cat-4',
        providerId: 'prov-4',
        externalId: 'ext-999',
        isActive: true,
        provider: {
          id: 'prov-4',
          name: 'Vexboost',
          apiUrl: 'https://vexboost.com/api',
          apiKey: 'secret-key-4'
        }
      }
    ];
    findManySpy.mockResolvedValue(mockServices as any);

    const cachedCatalog = [
      {
        service: 'ext-999',
        name: 'Provider Name 4',
        description: 'Provider description 4'
      }
    ];
    redisGetSpy.mockResolvedValue(JSON.stringify(cachedCatalog));

    await rebrandServices();

    // Verify Gemini API called
    expect(fetchMock).toHaveBeenCalled();

    // Verify no DB update or audit log since values are identical
    expect(updateSpy).not.toHaveBeenCalled();
    expect(auditSpy).not.toHaveBeenCalled();
  });
});
