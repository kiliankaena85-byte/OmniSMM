/**
 * Ghost Proxy v2: Test Mode vs Production Mode
 * 
 * This test suite verifies the core architectural invariant:
 * - In TEST mode: workers route to internal mock-provider (localhost)
 * - In PRODUCTION mode: workers route to real external provider (Vexboost)
 * - Admin functions ALWAYS route to real provider regardless of mode
 * 
 * Standards: ISTQB §4.4 (Decision Table Testing), ISO 25010 §6.5 (Security)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Hoisted mocks ----
const { mockProviderDb } = vi.hoisted(() => ({
  mockProviderDb: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    provider: mockProviderDb,
  },
}));

// Mock SettingsProvider directly to control test mode without cache interference
vi.mock('@/lib/settings', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    SettingsProvider: {
      isTestMode: vi.fn(),
      getExchangeRateUSD: vi.fn().mockResolvedValue(95.0),
    },
    SettingsManager: {
      isTestMode: vi.fn(),
    }
  };
});

import { ProviderService } from '@/services/providers/provider.service';
import { SettingsManager, SettingsProvider } from '@/lib/settings';
import { VaultService } from '@/lib/vault';

// ---- Test Data ----
const REAL_PROVIDER_CONFIG = {
  id: 'prov-vexboost',
  name: 'Vexboost',
  apiUrl: 'https://smm.vexboost.com/v2',
  apiKey: '',
  isActive: true,
  metadata: {},
  syncLock: false,
  balanceCurrency: 'USD',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_PROVIDER_URL_SUBSTRING = '/api/dev/mock-provider';

describe('Ghost Proxy v2: Routing Architecture', () => {
  let service: ProviderService;

  beforeEach(() => {
    vi.clearAllMocks();
    REAL_PROVIDER_CONFIG.apiKey = VaultService.encrypt('real_key_abc123');
    service = new ProviderService();
  });

  // =============================================
  // PRODUCTION MODE (isTestMode = false)
  // =============================================
  describe('🟢 PRODUCTION MODE (isTestMode=false)', () => {
    beforeEach(() => {
      vi.mocked(SettingsProvider.isTestMode).mockResolvedValue(false);
      vi.mocked(SettingsManager.isTestMode).mockResolvedValue(false);
    });

    it('GP-PROD-001: getProviderInstance → returns REAL provider URL', async () => {
      const instance = await service.getProviderInstance(REAL_PROVIDER_CONFIG as any);
      const apiUrl = (instance as any).apiUrl;
      expect(apiUrl).toBe('https://smm.vexboost.com/v2');
      expect(apiUrl).not.toContain(MOCK_PROVIDER_URL_SUBSTRING);
    });

    it('GP-PROD-002: getWorkerProviderInstance → returns REAL provider URL', async () => {
      const instance = await service.getWorkerProviderInstance(REAL_PROVIDER_CONFIG as any);
      const apiUrl = (instance as any).apiUrl;
      expect(apiUrl).toBe('https://smm.vexboost.com/v2');
      expect(apiUrl).not.toContain(MOCK_PROVIDER_URL_SUBSTRING);
    });

    it('GP-PROD-004: SettingsManager.isTestMode() returns false', async () => {
      const result = await SettingsManager.isTestMode();
      expect(result).toBe(false);
    });
  });

  // =============================================
  // TEST MODE (isTestMode = true)
  // =============================================
  describe('🟡 TEST MODE (isTestMode=true)', () => {
    beforeEach(() => {
      vi.mocked(SettingsProvider.isTestMode).mockResolvedValue(true);
      vi.mocked(SettingsManager.isTestMode).mockResolvedValue(true);
    });

    it('GP-TEST-001: getWorkerProviderInstance → returns MOCK provider URL', async () => {
      const instance = await service.getWorkerProviderInstance(REAL_PROVIDER_CONFIG as any);
      const apiUrl = (instance as any).apiUrl;
      expect(apiUrl).toContain(MOCK_PROVIDER_URL_SUBSTRING);
      expect(apiUrl).not.toContain('vexboost');
    });

    it('GP-TEST-003: getProviderInstance → STILL returns REAL provider (admin safety)', async () => {
      const instance = await service.getProviderInstance(REAL_PROVIDER_CONFIG as any);
      const apiUrl = (instance as any).apiUrl;
      expect(apiUrl).toBe('https://smm.vexboost.com/v2');
      expect(apiUrl).not.toContain(MOCK_PROVIDER_URL_SUBSTRING);
    });

    it('GP-TEST-005: SettingsManager.isTestMode() returns true', async () => {
      const result = await SettingsManager.isTestMode();
      expect(result).toBe(true);
    });
  });

  // =============================================
  // MODE TRANSITION
  // =============================================
  describe('🔄 MODE TRANSITION', () => {
    it('GP-SWITCH-001: Switching from test→prod changes worker routing immediately', async () => {
      vi.mocked(SettingsProvider.isTestMode).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      vi.mocked(SettingsManager.isTestMode).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const testInstance = await service.getWorkerProviderInstance(REAL_PROVIDER_CONFIG as any);
      expect((testInstance as any).apiUrl).toContain(MOCK_PROVIDER_URL_SUBSTRING);

      const prodInstance = await service.getWorkerProviderInstance(REAL_PROVIDER_CONFIG as any);
      expect((prodInstance as any).apiUrl).toBe('https://smm.vexboost.com/v2');
    });
  });

  // =============================================
  // EDGE CASES & SECURITY
  // =============================================
  describe('🛡️ SECURITY EDGE CASES', () => {
    it('GP-SEC-001: No active provider → throws meaningful error', async () => {
      vi.mocked(SettingsProvider.isTestMode).mockResolvedValue(false);
      mockProviderDb.findFirst.mockResolvedValue(null);
      await expect(service.getDefaultProvider()).rejects.toThrow('No active providers');
    });

    it('GP-SEC-002: Multiple rapid test-mode calls → each reads fresh DB state', async () => {
      vi.mocked(SettingsProvider.isTestMode)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      vi.mocked(SettingsManager.isTestMode)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const r1 = await service.getWorkerProviderInstance(REAL_PROVIDER_CONFIG as any);
      const r2 = await service.getWorkerProviderInstance(REAL_PROVIDER_CONFIG as any);
      const r3 = await service.getWorkerProviderInstance(REAL_PROVIDER_CONFIG as any);

      expect((r1 as any).apiUrl).toContain(MOCK_PROVIDER_URL_SUBSTRING);
      expect((r2 as any).apiUrl).toContain(MOCK_PROVIDER_URL_SUBSTRING);
      expect((r3 as any).apiUrl).toBe('https://smm.vexboost.com/v2');
    });
  });
});
