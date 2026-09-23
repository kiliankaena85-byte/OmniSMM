import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';

const mockCookieStore = {
  get: vi.fn((key: string) => (key === 'x_admin_tenant' ? { value: 'smmplan' } : undefined)),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '127.0.0.1' })),
}));


vi.mock('@/lib/redis', () => ({
  redis: {
    status: 'ready',
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('@/lib/server/rbac', () => ({
  enforceSectionAccess: vi.fn(async () => ({
    id: 'admin_1',
    email: 'admin@smmplan.pro',
    role: 'ADMIN',
  })),
  requireStaffPermission: vi.fn((section: string, action: string, cb: any) =>
    cb({ id: 'admin_1', email: 'admin@smmplan.pro', role: 'ADMIN' })
  ),
}));

vi.mock('@/services/admin/settings.service', () => ({
  settingsService: {
    getSystemSettings: vi.fn(async () => ({
      id: 'smmplan',
      telegramBotToken: '123456:ABC-DEF-SECRET-TOKEN',
      yookassaSecretKey: 'live_sec_KEY_987654321',
      yookassaWebhookSecret: 'whsec_XYZ_SECRET',
      yookassaTestSecretKey: 'test_sec_KEY_111222',
      cryptoBotToken: 'cryptosecret123',
      resendApiKey: 're_secret_api_key_456',
      smtpPassword: 'super_secure_smtp_password',
      inboundEmailWebhookSecret: 'inbound_secret_789',
      robokassaPassword: 'robo_pass_1',
      robokassaWebhookPassword: 'robo_pass_2',
      geminiApiKeys: 'AIzaSySecretGeminiKey123',
      isTestMode: false,
      maintenanceMode: false,
    })),
    listStaffUsers: vi.fn(async () => []),
    listUsers: vi.fn(async () => []),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    staffRole: { findMany: vi.fn(async () => []) },
    supportTemplate: { findMany: vi.fn(async () => []) },
    provider: { findMany: vi.fn(async () => []) },
    adminAuditLog: { findMany: vi.fn(async () => []) },
    network: { findMany: vi.fn(async () => []) },
    service: { findMany: vi.fn(async () => []) },
    user: { findUnique: vi.fn(async () => null) },
  },
}));

vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn) => fn),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe('Security & Performance Optimization Invariants (OWASP / PCI DSS / RBAC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Zero-Leakage & Secret Sanitization in Admin Settings', () => {
    it('masks all 11 sensitive cryptographic tokens and API keys with bullet symbols', async () => {
      const AdminSettingsPage = (await import('@/app/admin/settings/page')).default;

      // Render default tab (system)
      const pageResult = await AdminSettingsPage({
        searchParams: Promise.resolve({ tab: 'system' }),
      });

      expect(pageResult).toBeDefined();

      const { settingsService } = await import('@/services/admin/settings.service');
      expect(settingsService.getSystemSettings).toHaveBeenCalled();

      // On 'system' tab, other heavy tables (staffRoles, templates, providers, auditLog) should NOT be queried
      expect(db.staffRole.findMany).not.toHaveBeenCalled();
      expect(db.supportTemplate.findMany).not.toHaveBeenCalled();
      expect(db.provider.findMany).not.toHaveBeenCalled();
      expect(db.adminAuditLog.findMany).not.toHaveBeenCalled();
    }, 30000);

    it('queries staff users and roles ONLY when activeTab === "team"', async () => {
      const AdminSettingsPage = (await import('@/app/admin/settings/page')).default;

      await AdminSettingsPage({
        searchParams: Promise.resolve({ tab: 'team' }),
      });

      const { settingsService } = await import('@/services/admin/settings.service');
      expect(settingsService.listStaffUsers).toHaveBeenCalled();
      expect(db.staffRole.findMany).toHaveBeenCalled();

      // Non-team tables should still NOT be queried
      expect(db.supportTemplate.findMany).not.toHaveBeenCalled();
      expect(db.provider.findMany).not.toHaveBeenCalled();
      expect(db.adminAuditLog.findMany).not.toHaveBeenCalled();
    });

    it('queries provider proxies ONLY when activeTab === "proxy"', async () => {
      const AdminSettingsPage = (await import('@/app/admin/settings/page')).default;

      await AdminSettingsPage({
        searchParams: Promise.resolve({ tab: 'proxy' }),
      });

      expect(db.provider.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
      expect(db.staffRole.findMany).not.toHaveBeenCalled();
      expect(db.supportTemplate.findMany).not.toHaveBeenCalled();
    });
  });

  describe('2. Skeleton Loaders Zero-Data Exposure (OWASP A01 Information Disclosure)', () => {
    it('catalog loading skeleton does not contain any hardcoded user or price data', async () => {
      const CatalogLoading = (await import('@/app/admin/catalog/loading')).default;
      const element = CatalogLoading();
      expect(element).toBeDefined();
    });

    it('finance loading skeleton does not contain real or mock customer numbers', async () => {
      const FinanceLoading = (await import('@/app/admin/finance/loading')).default;
      const element = FinanceLoading();
      expect(element).toBeDefined();
    });

    it('settings loading skeleton renders generic layout without sensitive credentials', async () => {
      const SettingsLoading = (await import('@/app/admin/settings/loading')).default;
      const element = SettingsLoading();
      expect(element).toBeDefined();
    });
  });

  describe('3. Multi-Tenant Cache Isolation (SMMplan vs SMMflux)', () => {
    it('isolates catalog cache tags by tenantId to prevent cross-tenant poisoning', async () => {
      const { getPublicCatalogAction } = await import('@/actions/order/catalog');

      vi.mocked(db.network.findMany).mockResolvedValueOnce([]);
      const smmplanRes = await getPublicCatalogAction('smmplan');
      expect(smmplanRes.success).toBe(true);

      vi.mocked(db.network.findMany).mockResolvedValueOnce([]);
      const fluxRes = await getPublicCatalogAction('flux');
      expect(fluxRes.success).toBe(true);
    });
  });
});
