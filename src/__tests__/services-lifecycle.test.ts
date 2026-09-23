import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { servicesLifecycleService } from '@/services/admin/services-lifecycle.service';

const mockAdmin = {
  id: 'test-admin-lifecycle-01',
  email: 'auditor@smmplan.pro',
  ip: '127.0.0.1',
};

describe('Services Lifecycle Management — Enterprise QA Suite', () => {
  let testNetworkId: string;
  let testCategoryId: string;

  beforeEach(async () => {
    let cat = await db.category.findFirst({ where: { name: 'Подписчики на канал' } });
    if (!cat) {
      cat = await db.category.create({
        data: {
          name: 'Подписчики на канал',
          slug: `subs-test-${Date.now()}`,
          tenantId: 'smmplan',
          sort: 1,
        },
      });
    }
    testCategoryId = cat.id;
  });

  describe('1. Price Safety & Zero-Division Defense', () => {
    it('calculates safe retail price without zero division or negative values', () => {
      // 100 USD rate at 90 rub/usd with 3.0 markup
      const price = servicesLifecycleService.calculateRetailPrice(100, 3.0, 90.0, 'USD');
      expect(price).toBe(27000);

      // Auto markup (0 or negative) falls back to safe 3.0
      const autoPrice = servicesLifecycleService.calculateRetailPrice(10, 0, 90.0, 'USD');
      expect(autoPrice).toBe(2700);

      // 0 procurement rate returns 0
      const zeroProc = servicesLifecycleService.calculateRetailPrice(0, 2.5, 90.0, 'USD');
      expect(zeroProc).toBe(0);
    });
  });

  describe('2. Draft Lifecycle Workflow (IMPORTED → DRAFT → TESTING → PUBLISHED)', () => {
    it('creates a draft and records CREATE entry in ServiceEditHistory', async () => {
      const draft = await servicesLifecycleService.createDraft(
        {
          name: 'Telegram Подписчики Премиум [РФ]',
          procurementRate: 0.15,
          procurementCurrency: 'USD',
          markup: 2.5,
          categoryId: testCategoryId,
          targetType: 'CHANNEL',
        },
        mockAdmin
      );

      expect(draft.id).toBeDefined();
      expect(draft.status).toBe('DRAFT');
      expect(draft.retailPriceRub).toBeGreaterThan(0);

      // Check edit history
      const history = await db.serviceEditHistory.findMany({
        where: { draftId: draft.id },
      });
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].changeType).toBe('CREATE');
    });

    it('records field diffs when updating draft parameters', async () => {
      const draft = await servicesLifecycleService.createDraft(
        {
          name: 'Telegram Просмотры [Старт]',
          procurementRate: 0.05,
          categoryId: testCategoryId,
        },
        mockAdmin
      );

      const updated = await servicesLifecycleService.updateDraft(
        draft.id,
        {
          name: 'Telegram Просмотры [Ультра Скорость]',
          markup: 4.0,
          comment: 'Повысили наценку для VIP-трафика',
        },
        mockAdmin
      );

      expect(updated.name).toBe('Telegram Просмотры [Ультра Скорость]');
      expect(updated.markup).toBe(4.0);

      const history = await db.serviceEditHistory.findMany({
        where: { draftId: draft.id, changeType: 'UPDATE' },
      });
      expect(history.length).toBeGreaterThan(0);
    });

    it('rejects promoting to TESTING if category or price is missing/invalid', async () => {
      const draftNoCat = await servicesLifecycleService.createDraft(
        {
          name: 'Услуга без категории',
          procurementRate: 0.1,
          categoryId: null,
        },
        mockAdmin
      );

      await expect(servicesLifecycleService.promoteToTesting(draftNoCat.id, mockAdmin)).rejects.toThrow(
        'не назначена категория'
      );
    });

    it('atomically publishes draft into live Service with audit logging', async () => {
      const draft = await servicesLifecycleService.createDraft(
        {
          name: 'Telegram Авто-посты [30 дней]',
          procurementRate: 1.2,
          categoryId: testCategoryId,
          targetType: 'CHANNEL_POSTS',
          markup: 3.0,
        },
        mockAdmin
      );

      await servicesLifecycleService.promoteToTesting(draft.id, mockAdmin);

      const result = await servicesLifecycleService.publishDraft(draft.id, mockAdmin);
      expect(result.success).toBe(true);
      expect(result.serviceId).toBeDefined();

      const liveService = await db.service.findUnique({ where: { id: result.serviceId } });
      expect(liveService).not.toBeNull();
      expect(liveService?.isActive).toBe(true);
      expect(liveService?.name).toBe('Telegram Авто-посты [30 дней]');

      const updatedDraft = await db.serviceDraft.findUnique({ where: { id: draft.id } });
      expect(updatedDraft?.status).toBe('PUBLISHED');
    });
  });

  describe('3. Customer Groups & API Access Control', () => {
    it('manages customer groups and isolates service visibility', async () => {
      const groupSlug = `vip-api-${Date.now()}`;
      const group = await servicesLifecycleService.createCustomerGroup(
        {
          name: 'VIP Реселлеры',
          slug: groupSlug,
          discountPercent: 15,
        },
        mockAdmin
      );
      expect(group.id).toBeDefined();

      // Создаем публичную услугу
      const draft = await servicesLifecycleService.createDraft(
        {
          name: 'Закрытая VIP Услуга',
          procurementRate: 0.5,
          categoryId: testCategoryId,
        },
        mockAdmin
      );
      const { serviceId } = await servicesLifecycleService.publishDraft(draft.id, mockAdmin);

      // Без ограничений услуга доступна всем
      const publicAccess = await servicesLifecycleService.isServiceAccessibleForUser(serviceId);
      expect(publicAccess).toBe(true);

      // Ограничиваем услугу только для VIP группы
      await servicesLifecycleService.assignCustomerGroupAccess(serviceId, [group.id], undefined, mockAdmin);

      // Аноним или пользователь без группы не имеет доступа
      const anonAccess = await servicesLifecycleService.isServiceAccessibleForUser(serviceId);
      expect(anonAccess).toBe(false);

      // Создаем пользователя в VIP группе
      const user = await db.user.create({
        data: {
          email: `vip-user-${Date.now()}@smmplan.pro`,
          customerGroupId: group.id,
          tenantId: 'smmplan',
        },
      });

      const vipUserAccess = await servicesLifecycleService.isServiceAccessibleForUser(serviceId, user.id);
      expect(vipUserAccess).toBe(true);
    });
  });

  describe('4. Link Verifier & SSRF Protection', () => {
    it('blocks internal/loopback IP SSRF attempts', async () => {
      const result = await servicesLifecycleService.testLink('http://127.0.0.1:8080/admin', 'POST', mockAdmin);
      expect(result.isSuccess).toBe(false);
      expect(result.status).toBe('INVALID');
    });

    it('safely handles valid URLs with network timeout guard', async () => {
      const result = await servicesLifecycleService.testLink('https://example.com/test-post', 'POST', mockAdmin);
      expect(result.status).toBeDefined();
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
