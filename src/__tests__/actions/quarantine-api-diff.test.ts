import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { 
  getQuarantineServiceApiDiffAction, 
  applyQuarantineResolutionAction 
} from '@/actions/admin/providers/sync-action';

// Mock RBAC
vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(async (resource, action, callback) => {
    const mockAdmin = { id: 'admin_test_1', email: 'admin@smmplan.pro', role: 'OWNER' };
    return callback(mockAdmin);
  }),
  requireAdmin: vi.fn(async () => ({ id: 'admin_test_1', email: 'admin@smmplan.pro', role: 'OWNER' })),
}));

// Mock providerService to avoid real network socket timeouts in tests
vi.mock('@/services/providers/provider.service', () => ({
  providerService: {
    getWorkerProviderInstance: vi.fn(async () => ({
      getServices: vi.fn(async () => [
        {
          service: '7777',
          name: 'Telegram Подписчики Живые РФ',
          type: 'Default',
          rate: '25.0',
          min: '50',
          max: '20000',
          refill: true,
          cancel: true,
        }
      ]),
    })),
    getServicesWithCache: vi.fn(async () => [
      {
        service: '7777',
        name: 'Telegram Подписчики Живые РФ',
        type: 'Default',
        rate: '25.0',
        min: '50',
        max: '20000',
        refill: true,
        cancel: true,
      }
    ]),
  }
}));

// Mock revalidation
vi.mock('@/actions/admin/providers/sync-action', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/actions/admin/providers/sync-action')>();
  return {
    ...actual,
  };
});

describe('Quarantine API Diff & Resolution Suite', () => {
  let providerId: string;
  let categoryId: string;
  let serviceId: string;

  beforeEach(async () => {
    // Setup test provider and category
    const provider = await db.provider.create({
      data: {
        name: 'TestDiffProvider_' + Date.now(),
        apiUrl: 'https://test-provider.com/api/v2',
        apiKey: 'test-key-diff',
        balanceCurrency: 'RUB',
        isActive: true,
      }
    });
    providerId = provider.id;

    let network = await db.network.findFirst({ where: { slug: 'telegram' } });
    if (!network) {
      network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram' }
      });
    }

    const category = await db.category.create({
      data: {
        name: 'Тест Категория ' + Date.now(),
        networkId: network.id,
      }
    });
    categoryId = category.id;

    // Create test shadow service in DB for fallback
    await db.shadowService.create({
      data: {
        providerId: provider.id,
        externalId: '7777',
        name: 'Telegram Подписчики Живые РФ',
        type: 'Default',
        rate: 25.0,
        rateRub: 25.0,
        min: 50,
        max: 20000,
        refill: true,
        cancel: true,
        category: 'Telegram',
      }
    });

    // Create quarantined service in DB
    const service = await db.service.create({
      data: {
        name: 'Telegram Подписчики Живые РФ',
        providerId: provider.id,
        categoryId: category.id,
        externalId: '7777',
        rate: 15.0,
        pricePer1000Cents: 3000,
        minQty: 100,
        maxQty: 10000,
        isRefillEnabled: false,
        isCancelEnabled: false,
        isQuarantined: true,
        quarantineReason: 'Ценовой скачок +66.7% (Превышен лимит 30%)',
        pendingRate: 25.0,
        isActive: false,
        tenantId: 'all',
      }
    });
    serviceId = service.id;
  });

  afterEach(async () => {
    await db.service.deleteMany({ where: { providerId } }).catch(() => {});
    await db.shadowService.deleteMany({ where: { providerId } }).catch(() => {});
    await db.category.deleteMany({ where: { id: categoryId } }).catch(() => {});
    await db.provider.deleteMany({ where: { id: providerId } }).catch(() => {});
  });

  it('1. fetches live diff and detects parameter mutations against shadow provider catalog', async () => {
    const result = await getQuarantineServiceApiDiffAction(serviceId);

    expect(result.success).toBe(true);
    expect(result.diff).toBeDefined();
    if (!result.diff) return;

    expect(result.diff.serviceId).toBe(serviceId);
    expect(result.diff.externalId).toBe('7777');
    expect(result.diff.isPriceSpike).toBe(true);
    expect(result.diff.diff.minQty.changed).toBe(true);
    expect(result.diff.diff.minQty.oldValue).toBe(100);
    expect(result.diff.diff.minQty.newValue).toBe(50);
    expect(result.diff.diff.maxQty.changed).toBe(true);
    expect(result.diff.diff.maxQty.oldValue).toBe(10000);
    expect(result.diff.diff.maxQty.newValue).toBe(20000);
    expect(result.diff.diff.refill.changed).toBe(true);
    expect(result.diff.diff.refill.newValue).toBe(true);
    expect(result.diff.verdict).toBe('MUTATED_PARAMS');
  });

  it('2. applyQuarantineResolutionAction mode SYNC_ALL updates all parameters and clears quarantine', async () => {
    const res = await applyQuarantineResolutionAction({
      serviceId,
      mode: 'SYNC_ALL'
    });

    expect(res.success).toBe(true);

    const updated = await db.service.findUnique({ where: { id: serviceId } });
    expect(updated).toBeDefined();
    expect(updated?.isQuarantined).toBe(false);
    expect(updated?.quarantineReason).toBeNull();
    expect(updated?.pendingRate).toBeNull();
    expect(updated?.isActive).toBe(true);
    expect(updated?.rate).toBe(25.0);
    expect(updated?.minQty).toBe(50);
    expect(updated?.maxQty).toBe(20000);
    expect(updated?.isRefillEnabled).toBe(true);
    expect(updated?.isCancelEnabled).toBe(true);
  });

  it('3. applyQuarantineResolutionAction mode PRICE_ONLY updates only price and leaves min/max intact', async () => {
    const res = await applyQuarantineResolutionAction({
      serviceId,
      mode: 'PRICE_ONLY'
    });

    expect(res.success).toBe(true);

    const updated = await db.service.findUnique({ where: { id: serviceId } });
    expect(updated).toBeDefined();
    expect(updated?.isQuarantined).toBe(false);
    expect(updated?.pendingRate).toBeNull();
    expect(updated?.rate).toBe(25.0);
    // minQty and maxQty stay intact
    expect(updated?.minQty).toBe(100);
    expect(updated?.maxQty).toBe(10000);
    expect(updated?.isActive).toBe(true);
  });

  it('4. applyQuarantineResolutionAction mode DEACTIVATE disables service and clears quarantine', async () => {
    const res = await applyQuarantineResolutionAction({
      serviceId,
      mode: 'DEACTIVATE'
    });

    expect(res.success).toBe(true);

    const updated = await db.service.findUnique({ where: { id: serviceId } });
    expect(updated).toBeDefined();
    expect(updated?.isQuarantined).toBe(false);
    expect(updated?.isActive).toBe(false);
  });
});
