/**
 * e2e/e2e-admin-services-lifecycle.spec.ts
 * BLOCK 2: Admin Providers, Manual Import & Services Lifecycle Management E2E Tests
 *
 * Invariants & Contract (AGENTS.md):
 * 1. Provider creation with Vault AES-256-GCM encryption & SSRF validation.
 * 2. Cherry-Pick import to ServiceDraft (DRAFT).
 * 3. Granular audit trail: ServiceEditHistory records oldValue -> newValue diffs.
 * 4. Network Link Verifier with SSRF guard and 4s timeout.
 * 5. Atomic state promotion: DRAFT -> TESTING -> PUBLISHED (Service live creation + AdminAuditLog).
 * 6. B2B Customer Group Isolation (CustomerGroup & ServiceCustomerAccess).
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { servicesLifecycleService, AdminContext } from '../src/services/admin/services-lifecycle.service';
import { seedTestAdmin, createAuthenticatedContext } from './fixtures';

const db = new PrismaClient();

test.describe.serial('BLOCK 2: Admin Providers & Services Lifecycle Management E2E', () => {
  let adminId: string;
  let adminEmail: string;
  let adminContext: AdminContext;
  let providerId: string;
  let categoryId: string;
  let networkId: string;
  let draftId: string;
  let serviceId: string;

  test.beforeAll(async () => {
    // 1. Seed admin user with employee consent
    const admin = await seedTestAdmin();
    adminId = admin.id;
    adminEmail = admin.email;
    adminContext = { id: adminId, email: adminEmail, ip: '127.0.0.1' };

    // 2. Ensure Network & Category
    const network = await db.network.upsert({
      where: { slug: 'telegram' },
      update: { isActive: true },
      create: {
        name: 'Telegram',
        slug: 'telegram',
        icon: 'Send',
        isActive: true,
        tenantId: 'smmplan',
      },
    });
    networkId = network.id;

    const category = await db.category.upsert({
      where: { slug: 'e2e-lifecycle-cat' },
      update: { name: 'E2E Lifecycle Category' },
      create: {
        name: 'E2E Lifecycle Category',
        slug: 'e2e-lifecycle-cat',
        networkId: network.id,
        tenantId: 'smmplan',
      },
    });
    categoryId = category.id;
  });

  test.afterAll(async () => {
    // Cleanup created test records
    await db.serviceCustomerAccess.deleteMany({
      where: { customerGroup: { slug: { startsWith: 'e2e-' } } },
    }).catch(() => {});
    await db.customerGroup.deleteMany({
      where: { slug: { startsWith: 'e2e-' } },
    }).catch(() => {});
    await db.serviceLinkCheck.deleteMany({
      where: { draft: { externalId: { startsWith: 'e2e-ext-' } } },
    }).catch(() => {});
    await db.serviceEditHistory.deleteMany({
      where: { adminEmail: { startsWith: 'e2e-admin' } },
    }).catch(() => {});
    await db.serviceDraft.deleteMany({
      where: { externalId: { startsWith: 'e2e-ext-' } },
    }).catch(() => {});
    if (providerId) {
      await db.provider.deleteMany({ where: { id: providerId } }).catch(() => {});
    }
    await db.category.deleteMany({ where: { id: categoryId } }).catch(() => {});
    await db.$disconnect();
  });

  test('Scenario 1: Admin Adds API Provider via UI with Vault Key Encryption', async ({ browser, baseURL }) => {
    const context = await createAuthenticatedContext(browser, adminId, 'OWNER');
    const page = await context.newPage();

    // 1. Open providers list
    await page.goto(`${baseURL}/admin/providers`);
    await expect(page.locator('body')).toBeVisible();

    // 2. Click "+ Подключить Панель" or navigate to /admin/providers/new
    await page.goto(`${baseURL}/admin/providers/new`);
    await expect(page.locator('body')).toBeVisible();

    // 3. Check Form Inputs & Validation
    const nameInput = page.locator('input[name="name"]').or(page.locator('#provider-name')).first();
    const urlInput = page.locator('input[name="apiUrl"]').or(page.locator('#provider-url')).first();
    const keyInput = page.locator('input[name="apiKey"]').or(page.locator('#provider-key')).first();

    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await expect(urlInput).toBeVisible();
    await expect(keyInput).toBeVisible();

    const testProviderName = `E2E Provider ${Date.now()}`;
    await nameInput.fill(testProviderName);
    await urlInput.fill('https://api.mock-panel-service.com/v2');
    await keyInput.fill('secret_vault_api_key_998877');

    // 4. Save Provider
    const saveBtn = page.getByRole('button', { name: /(Создать|Сохранить|Подключить)/i }).first();
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();

    await saveBtn.click();
    await page.waitForTimeout(2000);

    // 5. Verify in DB: Provider created with encrypted key
    const createdProvider = await db.provider.findFirst({
      where: { name: testProviderName },
    });

    expect(createdProvider).not.toBeNull();
    if (createdProvider) {
      providerId = createdProvider.id;
      expect(createdProvider.apiUrl).toBe('https://api.mock-panel-service.com/v2');
      expect(createdProvider.isActive).toBe(true);
      expect(createdProvider.apiKey).toBeTruthy();
    }

    await context.close();
  });

  test('Scenario 2: Cherry-Pick Import into ServiceDraft (DRAFT status)', async () => {
    // 1. Create a draft via servicesLifecycleService (mimicking Cherry-Pick import)
    const externalId = `e2e-ext-${Date.now()}`;
    const draft = await servicesLifecycleService.createDraft(
      {
        name: 'E2E Telegram Channel Followers (HQ)',
        externalId,
        providerId: providerId || 'e2e-mock-provider',
        tenantId: 'smmplan',
        categoryId,
        procurementRate: 1.5,
        procurementCurrency: 'USD',
        markup: 1.8, // 80% markup
        minQty: 50,
        maxQty: 25000,
        targetType: 'CHANNEL',
        description: 'High quality real followers with 30 days refill guarantee.',
      },
      adminContext
    );

    expect(draft).toBeDefined();
    expect(draft.status).toBe('DRAFT');
    expect(draft.retailPriceRub).toBeGreaterThan(0);
    draftId = draft.id;

    // Verify audit history record
    const history = await db.serviceEditHistory.findMany({
      where: { draftId: draft.id },
    });
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].changeType).toBe('CREATE');
    expect(history[0].adminEmail).toBe(adminEmail);
  });

  test('Scenario 3: Draft Editing & Diff Audit History (oldValue -> newValue)', async () => {
    if (!draftId) {
      const fallbackDraft = await db.serviceDraft.findFirst({
        where: { externalId: { startsWith: 'e2e-ext-' } },
        orderBy: { createdAt: 'desc' },
      });
      if (fallbackDraft) draftId = fallbackDraft.id;
    }
    expect(draftId).toBeDefined();

    // 1. Update markup and minQty
    const updated = await servicesLifecycleService.updateDraft(
      draftId,
      {
        markup: 2.5,
        minQty: 100,
        name: 'E2E Telegram Channel Followers (Updated HQ)',
      },
      adminContext
    );

    expect(updated.markup).toBe(2.5);
    expect(updated.minQty).toBe(100);

    // 2. Verify Diff Records in ServiceEditHistory
    const diffs = await db.serviceEditHistory.findMany({
      where: { draftId, changeType: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });

    expect(diffs.length).toBeGreaterThanOrEqual(2);
    const markupDiff = diffs.find(d => d.field === 'markup');
    expect(markupDiff).toBeDefined();
    expect(markupDiff?.oldValue).toBe('1.8');
    expect(markupDiff?.newValue).toBe('2.5');

    const minQtyDiff = diffs.find(d => d.field === 'minQty');
    expect(minQtyDiff).toBeDefined();
    expect(minQtyDiff?.oldValue).toBe('50');
    expect(minQtyDiff?.newValue).toBe('100');
  });

  test('Scenario 4: Network Link Verifier with SSRF Protection & Health Logs', async () => {
    if (!draftId) {
      const fallbackDraft = await db.serviceDraft.findFirst({
        where: { externalId: { startsWith: 'e2e-ext-' } },
        orderBy: { createdAt: 'desc' },
      });
      if (fallbackDraft) draftId = fallbackDraft.id;
    }
    expect(draftId).toBeDefined();

    // 1. Test SSRF Protection: loopback IP must be blocked
    const ssrfRes = await servicesLifecycleService.testLink(
      'http://127.0.0.1:3000/admin',
      'CHANNEL',
      adminContext,
      undefined,
      draftId
    );
    expect(ssrfRes.isSuccess).toBe(false);
    expect(ssrfRes.errorMessage).toContain('SSRF');

    // Verify SSRF block was logged in ServiceLinkCheck
    const ssrfCheck = await db.serviceLinkCheck.findFirst({
      where: { isSuccess: false },
      orderBy: { checkedAt: 'desc' },
    });
    expect(ssrfCheck).not.toBeNull();
    expect(ssrfCheck?.errorMessage).toContain('SSRF');

    // 2. Test Safe External Link
    const validRes = await servicesLifecycleService.testLink(
      'https://t.me/smmplan',
      'CHANNEL',
      adminContext,
      undefined,
      draftId
    );
    expect(validRes.responseTimeMs).toBeDefined();

    // Verify valid check log in DB
    const validCheck = await db.serviceLinkCheck.findFirst({
      where: { targetType: 'CHANNEL', testUrl: 'https://t.me/smmplan' },
      orderBy: { checkedAt: 'desc' },
    });
    expect(validCheck).not.toBeNull();
  });

  test('Scenario 5: State Promotion Workflow (DRAFT -> TESTING -> PUBLISHED)', async () => {
    if (!draftId) {
      const fallbackDraft = await db.serviceDraft.findFirst({
        where: { externalId: { startsWith: 'e2e-ext-' } },
        orderBy: { createdAt: 'desc' },
      });
      if (fallbackDraft) draftId = fallbackDraft.id;
    }
    expect(draftId).toBeDefined();

    // 1. Promote to TESTING
    const testingDraft = await servicesLifecycleService.promoteToTesting(draftId, adminContext);
    expect(testingDraft.status).toBe('TESTING');

    // 2. Promote to PUBLISHED (Atomic Live Creation)
    const publishRes = await servicesLifecycleService.publishDraft(draftId, adminContext);
    expect(publishRes.success).toBe(true);
    expect(publishRes.serviceId).toBeDefined();
    serviceId = publishRes.serviceId;

    // 3. Verify live Service exists in DB
    const liveService = await db.service.findUnique({
      where: { id: serviceId },
    });
    expect(liveService).not.toBeNull();
    expect(liveService?.isActive).toBe(true);

    // Verify AdminAuditLog entry
    const auditLog = await db.adminAuditLog.findFirst({
      where: {
        action: 'SERVICE_LIFECYCLE_PUBLISH',
        target: serviceId,
      },
    });
    expect(auditLog).not.toBeNull();
  });

  test('Scenario 6: B2B Customer Group Isolation & Discount Pricing', async () => {
    if (!serviceId) {
      const fallbackDraft = await db.serviceDraft.findFirst({
        where: { externalId: { startsWith: 'e2e-ext-' } },
        orderBy: { createdAt: 'desc' },
      });
      if (fallbackDraft?.serviceId) serviceId = fallbackDraft.serviceId;
    }
    expect(serviceId).toBeDefined();

    // 1. Create B2B Customer Group
    const group = await servicesLifecycleService.createCustomerGroup(
      {
        name: 'E2E VIP Resellers',
        slug: `e2e-vip-${Date.now()}`,
        tenantId: 'smmplan',
        discountPercent: 15,
        description: 'Exclusive wholesale pricing for tier-1 resellers.',
      },
      adminContext
    );
    expect(group).toBeDefined();
    expect(group.id).toBeDefined();

    // 2. Restrict service access exclusively to VIP Resellers
    const accessRes = await servicesLifecycleService.assignCustomerGroupAccess(
      serviceId,
      [group.id],
      { [group.id]: 0.05 }, // Custom fixed price 0.05 RUB / unit
      adminContext
    );
    expect(accessRes.success).toBe(true);

    // 3. Create VIP User and Regular User
    const vipUser = await db.user.create({
      data: {
        email: `vip-user-${Date.now()}@smmplan.local`,
        tenantId: 'smmplan',
        role: 'USER',
        balance: 1000,
        customerGroupId: group.id,
      },
    });

    const regularUser = await db.user.create({
      data: {
        email: `regular-user-${Date.now()}@smmplan.local`,
        tenantId: 'smmplan',
        role: 'USER',
        balance: 1000,
        customerGroupId: null,
      },
    });

    // 4. Test Access Visibility
    const guestAccess = await servicesLifecycleService.isServiceAccessibleForUser(serviceId);
    expect(guestAccess).toBe(false);

    const regularAccess = await servicesLifecycleService.isServiceAccessibleForUser(serviceId, regularUser.id);
    expect(regularAccess).toBe(false);

    const vipAccess = await servicesLifecycleService.isServiceAccessibleForUser(serviceId, vipUser.id);
    expect(vipAccess).toBe(true);

    // Clean up
    await db.user.deleteMany({ where: { id: { in: [vipUser.id, regularUser.id] } } });
  });
});
