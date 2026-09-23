import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { createServiceAction, updateServiceAction } from '../services';

// Mock cookies and headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest',
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

// Mock verifySession to control roles per test
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

describe('Manual Service Import & Editing CRUD Tests', () => {
  let adminUser: any;
  let regularUser: any;
  let provider: any;
  let categorySubscribers: any;
  let categoryLikes: any;

  beforeEach(async () => {
    // 1. Setup systemSettings with exchange rates
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'smmplan', isTestMode: true, exchangeRateUSD: 100.0 },
    });
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    // 3. Create Admin and Regular User
    adminUser = await db.user.create({
      data: {
        email: 'admin_crud@smmplan.local',
        role: 'OWNER',
        isActive: true,
      },
    });

    regularUser = await db.user.create({
      data: {
        email: 'user_crud@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    // 4. Create provider
    provider = await db.provider.create({
      data: {
        name: 'Manual CRUD Provider',
        apiUrl: 'http://localhost/api/crud',
        apiKey: 'key-crud',
        balanceCurrency: 'USD',
        isActive: true
      }
    });

    // 5. Create social network and categories
    const network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram' }
    });

    categorySubscribers = await db.category.create({
      data: { name: 'Подписчики Telegram', networkId: network.id }
    });

    categoryLikes = await db.category.create({
      data: { name: 'Лайки Telegram', networkId: network.id }
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fail with Forbidden error when non-admin attempts CRUD', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: regularUser.id });

    const createPayload = {
      name: 'Forbidden Service',
      categoryId: categorySubscribers.id,
      rate: 1.5,
      markup: 3.0,
      minQty: 10,
      maxQty: 5000,
    };

    const res = await createServiceAction(createPayload);
    const failRes = res as { success: false; error: string };
    expect(failRes.success).toBe(false);
    expect(failRes.error).toContain('Forbidden: Administrator/Staff context required');
  });

  it('should successfully manually create a service and infer correct targetType from category name', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    const createPayload = {
      name: 'TG Subscribers Premium HQ',
      description: 'Test manual creation description',
      categoryId: categorySubscribers.id,
      providerId: provider.id,
      rate: 0.8, // USD 0.80 per 1k
      markup: 4.0, // x4 markup multiplier
      minQty: 50,
      maxQty: 10000,
      externalId: 'ext-505',
      // targetType is left empty to test auto-inference
    };

    const { SettingsProvider } = await import('@/lib/settings');

    const res = await createServiceAction(createPayload);
    if (!res.success) {
      console.error("CREATE SERVICE ACTION FAILED ERROR:", (res as any).error);
    }
    const successRes = res as { success: true; serviceId: string };
    expect(successRes.success).toBe(true);
    expect(successRes.serviceId).toBeDefined();

    // Verify DB entry is created correctly
    const created = await db.service.findUnique({
      where: { id: successRes.serviceId }
    });

    expect(created).toBeDefined();
    expect(created?.name).toBe('TG Subscribers Premium HQ');
    expect(created?.rate).toBe(0.8);
    expect(created?.markup).toBe(4.0);
    
    // Auto inferred targetType: category contains "Подписчики" -> CHANNEL!
    expect(created?.targetType).toBe('CHANNEL');

    // Auto enriched link specification from Unified Link Engine (SIL-2026)
    expect(created?.linkValidatorRegex).toBeDefined();
    expect(created?.linkPlaceholder).toContain('t.me/');
    expect(created?.linkHint).toContain('канал');
    expect(created?.clientRequirement).toContain('доступны');

    // Denormalized retail price in cents calculation: 
    // rate 0.8 * markup 4.0 * exchangeRate 100 = 320.00 RUB -> 32000 cents
    expect(created?.pricePer1000Cents).toBe(32000);

    // Verify AdminAuditLog is written
    const audit = await db.adminAuditLog.findFirst({
      where: { action: 'SERVICE_MANUAL_CREATE', target: created?.id }
    });
    expect(audit).toBeDefined();
    expect(audit?.adminEmail).toBe(adminUser.email);
  });

  it('should successfully manually update service details and recalculate pricePer1000Cents on change', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Pre-create service
    const service = await db.service.create({
      data: {
        name: 'Old Service Name',
        categoryId: categorySubscribers.id,
        providerId: provider.id,
        rate: 1.0,
        markup: 2.0,
        pricePer1000Cents: 20000, // 1.0 * 2.0 * 100 * 100
        minQty: 10,
        maxQty: 5000,
        targetType: 'CHANNEL'
      }
    });

    // Update details: change category to Likes, rate to 0.5, markup to 3.5, and targetType to POST
    const updatePayload = {
      name: 'New Service Name',
      description: 'Updated Description',
      categoryId: categoryLikes.id,
      providerId: provider.id,
      rate: 0.5,
      markup: 3.5,
      minQty: 20,
      maxQty: 8000,
      externalId: 'ext-909',
      targetType: 'POST', // Manually set
      customDataType: 'TEXTAREA',
      isMediaGroupAware: true
    };

    const { SettingsProvider } = await import('@/lib/settings');

    const res = await updateServiceAction(service.id, updatePayload);
    const successRes = res as { success: true; serviceId: string };
    expect(successRes.success).toBe(true);

    const updated = await db.service.findUnique({
      where: { id: service.id }
    });

    expect(updated?.name).toBe('New Service Name');
    expect(updated?.description).toBe('Updated Description');
    expect(updated?.categoryId).toBe(categoryLikes.id);
    expect(updated?.rate).toBe(0.5);
    expect(updated?.markup).toBe(3.5);
    expect(updated?.minQty).toBe(20);
    expect(updated?.maxQty).toBe(8000);
    expect(updated?.externalId).toBe('ext-909');
    expect(updated?.targetType).toBe('POST');
    expect(updated?.customDataType).toBe('TEXTAREA');
    expect(updated?.isMediaGroupAware).toBe(true);

    // Dynamic price recalculation check (with psychological rounding):
    // rate 0.5 * markup 3.5 * exchangeRate 100 = 175.00 RUB -> rounded to 180.00 RUB -> 18000 cents
    expect(updated?.pricePer1000Cents).toBe(18000);

    // Verify AdminAuditLog is written with oldValue and newValue tracking
    await new Promise(resolve => setTimeout(resolve, 100));
    const audit = await db.adminAuditLog.findFirst({
      where: { action: 'SERVICE_MANUAL_UPDATE', target: service.id }
    });
    expect(audit).toBeDefined();
    
    // Check old values recorded
    const oldVal = JSON.parse(audit?.oldValue as string);
    expect(oldVal.name).toBe('Old Service Name');
    expect(oldVal.rate).toBe(1.0);
    expect(oldVal.markup).toBe(2.0);

    // Check new values recorded
    const newVal = JSON.parse(audit?.newValue as string);
    expect(newVal.name).toBe('New Service Name');
    expect(newVal.rate).toBe(0.5);
    expect(newVal.markup).toBe(3.5);
  });
});
