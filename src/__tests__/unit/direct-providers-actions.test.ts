import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import {
  getDirectProvidersRegistryAction,
  connectDirectProviderPresetAction,
} from '@/actions/admin/providers/crud';

// Mock cookies and headers
const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest',
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock requireStaffPermission with correct 3 arguments signature
vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(
    async (_section: string, _action: string, callback: (admin: { id: string; email: string; role: string }) => Promise<unknown>) => {
      return callback({ id: 'admin_test_1', email: 'admin@smmplan.pro', role: 'ADMIN' });
    }
  ),
}));

// Mock verifySession as ADMIN
vi.mock('@/lib/session', async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

// Mock auditAdminAwaitable
vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn().mockResolvedValue(undefined),
  auditAdmin: vi.fn().mockResolvedValue(undefined),
}));

interface RegistryResponse {
  success: boolean;
  data?: Array<{ id: string; connected: boolean; connectedProviderId?: string }>;
  error?: string;
}

interface ConnectResponse {
  success: boolean;
  providerId?: string;
  message?: string;
  error?: string;
}

describe('Direct SMM Providers Server Actions (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (verifySession as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      userId: 'admin_test_1',
      email: 'admin@smmplan.pro',
      role: 'ADMIN',
    });
  });

  describe('getDirectProvidersRegistryAction', () => {
    it('should return enriched direct providers with DB connection status', async () => {
      // Mock existing providers in DB
      vi.spyOn(db.provider, 'findMany').mockResolvedValueOnce([
        {
          id: 'prov_jap_db',
          name: 'JustAnotherPanel',
          apiUrl: 'https://justanotherpanel.com/api/v2',
          isActive: true,
        } as never,
      ]);

      const result = (await getDirectProvidersRegistryAction()) as RegistryResponse;

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.length).toBeGreaterThanOrEqual(10);

        // JustAnotherPanel should be marked as connected
        const jap = result.data.find((p: { id: string }) => p.id === 'justanotherpanel');
        expect(jap).toBeDefined();
        expect(jap?.connected).toBe(true);
        expect(jap?.connectedProviderId).toBe('prov_jap_db');

        // Other providers not in DB should be connected: false
        const peakerr = result.data.find((p: { id: string }) => p.id === 'peakerr');
        expect(peakerr).toBeDefined();
        expect(peakerr?.connected).toBe(false);
      }
    });
  });

  describe('connectDirectProviderPresetAction', () => {
    it('should successfully create a new provider from registry preset', async () => {
      vi.spyOn(db.provider, 'findFirst').mockResolvedValueOnce(null);
      vi.spyOn(db.provider, 'create').mockResolvedValueOnce({
        id: 'new_prov_123',
        name: 'Peakerr',
        apiUrl: 'https://peakerr.com/api/v2',
        isActive: false,
      } as never);

      const result = (await connectDirectProviderPresetAction('peakerr', 'test_api_key_xyz')) as ConnectResponse;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.providerId).toBe('new_prov_123');
        expect(result.message).toContain('успешно добавлен');
      }
      expect(db.provider.create).toHaveBeenCalled();
    });

    it('should return existing provider message if already connected', async () => {
      vi.spyOn(db.provider, 'findFirst').mockResolvedValueOnce({
        id: 'existing_prov_456',
        name: 'Peakerr',
        apiUrl: 'https://peakerr.com/api/v2',
      } as never);
      const createSpy = vi.spyOn(db.provider, 'create');

      const result = (await connectDirectProviderPresetAction('peakerr')) as ConnectResponse;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.providerId).toBe('existing_prov_456');
        expect(result.message).toContain('уже подключен');
      }
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should return error for invalid preset ID', async () => {
      const result = (await connectDirectProviderPresetAction('unknown_invalid_preset')) as ConnectResponse;

      expect(result.success).toBe(false);
      if (!result.success && result.error) {
        expect(result.error).toContain('не найден в реестре');
      }
    });
  });
});
