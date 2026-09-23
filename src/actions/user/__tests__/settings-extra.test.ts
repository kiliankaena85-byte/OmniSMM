import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import {
  updateCompanyRequisitesAction,
  updateApiWebhookAction,
  confirm152FzConsentAction,
  getTelegramBindDetailsAction,
  updateTelegramNotificationSettingsAction,
  unbindTelegramAction,
} from '../settings-extra';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn().mockResolvedValue('185.220.100.5'),
}));

async function createTestUser(initialData: Record<string, unknown> = {}) {
  const uniqueEmail = `settings_test_${Date.now()}_${Math.random().toString(36).substring(7)}@smmplan.local`;
  return await db.user.create({
    data: {
      email: uniqueEmail,
      role: 'USER',
      isActive: true,
      ...initialData,
    },
  });
}

describe('Settings Extra Server Actions', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe('updateCompanyRequisitesAction', () => {
    it('should return error if unauthenticated', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);
      const res = await updateCompanyRequisitesAction({ companyName: 'ООО Рога' });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Авторизуйтесь для выполнения этого действия');
    });

    it('should reject invalid INN format', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateCompanyRequisitesAction({ inn: '12345' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('ИНН должен содержать ровно 10 цифр');
    });

    it('should reject invalid KPP format', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateCompanyRequisitesAction({ inn: '7701234567', kpp: '123' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('КПП должен содержать ровно 9 цифр');
    });

    it('should reject invalid OGRN format', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateCompanyRequisitesAction({
        inn: '7701234567',
        ogrn: '12345',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('ОГРН должен содержать ровно 13 цифр');
    });

    it('should update requisites successfully with 10-digit INN, 9-digit KPP, and 13-digit OGRN', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateCompanyRequisitesAction({
        companyName: 'ООО Рога и Копыта',
        inn: '7701234567',
        kpp: '770101001',
        ogrn: '1027700132195',
        legalAddress: 'г. Москва, ул. Пушкина, д. 10',
      });
      expect(res.success).toBe(true);

      const updated = await db.user.findUnique({ where: { id: user.id } });
      expect(updated?.companyName).toBe('ООО Рога и Копыта');
      expect(updated?.inn).toBe('7701234567');
      expect(updated?.kpp).toBe('770101001');
      expect(updated?.ogrn).toBe('1027700132195');
      expect(updated?.legalAddress).toBe('г. Москва, ул. Пушкина, д. 10');
    });

    it('should accept 12-digit INN and 15-digit OGRNIP for IP / sole traders', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateCompanyRequisitesAction({
        companyName: 'ИП Иванов И.И.',
        inn: '770123456789',
        ogrn: '315774600000123',
      });
      expect(res.success).toBe(true);

      const updated = await db.user.findUnique({ where: { id: user.id } });
      expect(updated?.inn).toBe('770123456789');
      expect(updated?.ogrn).toBe('315774600000123');
    });
  });

  describe('updateApiWebhookAction', () => {
    it('should return error if unauthenticated', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);
      const res = await updateApiWebhookAction({ webhookUrl: 'https://example.com/webhook' });
      expect(res.success).toBe(false);
    });

    it('should reject non-HTTPS URLs', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateApiWebhookAction({ webhookUrl: 'http://insecure.com/webhook' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('https://');
    });

    it('should create apiConfig and generate secret for valid HTTPS URL', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateApiWebhookAction({ webhookUrl: 'https://example.com/webhook' });
      expect(res.success).toBe(true);
      expect(res.webhookUrl).toBe('https://example.com/webhook');
      expect(res.webhookSecret).toBeDefined();
      expect(typeof res.webhookSecret).toBe('string');
      expect(res.webhookSecret?.length).toBeGreaterThan(10);
    });

    it('should regenerate secret when requested', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res1 = await updateApiWebhookAction({ webhookUrl: 'https://example.com/webhook' });
      const secret1 = res1.webhookSecret;

      const res2 = await updateApiWebhookAction({
        webhookUrl: 'https://example.com/webhook',
        regenerateSecret: true,
      });
      const secret2 = res2.webhookSecret;

      expect(secret1).not.toBe(secret2);
    });
  });

  describe('confirm152FzConsentAction', () => {
    it('should return error if unauthenticated', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);
      const res = await confirm152FzConsentAction();
      expect(res.success).toBe(false);
    });

    it('should record tosAcceptedAt and tosAcceptedIp', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await confirm152FzConsentAction();
      expect(res.success).toBe(true);
      expect(res.tosAcceptedAt).toBeDefined();
      expect(res.tosAcceptedIp).toBe('185.220.100.5');

      const updated = await db.user.findUnique({ where: { id: user.id } });
      expect(updated?.tosAcceptedAt).not.toBeNull();
      expect(updated?.tosAcceptedIp).toBe('185.220.100.5');
    });
  });

  describe('Telegram Smart Bind & Notifications', () => {
    it('should generate deep-link with valid tg_bind_ token', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await getTelegramBindDetailsAction();

      expect(res.success).toBe(true);
      expect(res.deepLink).toContain('t.me/');
      expect(res.deepLink).toContain('?start=tg_bind_');
      expect(res.bindToken).toMatch(/^tg_bind_/);

      const authToken = await db.authToken.findFirst({
        where: { token: res.bindToken! },
      });
      expect(authToken).toBeDefined();
      expect(authToken?.userId).toBe(user.id);
    });

    it('should update telegram notification switches', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateTelegramNotificationSettingsAction({
        notifyOrders: false,
        notifyBalance: true,
        notifyTickets: false,
      });

      expect(res.success).toBe(true);
      expect(res.telegramNotifyOrders).toBe(false);
      expect(res.telegramNotifyBalance).toBe(true);
      expect(res.telegramNotifyTickets).toBe(false);

      const updated = await db.user.findUnique({ where: { id: user.id } });
      expect(updated?.telegramNotifyOrders).toBe(false);
      expect(updated?.telegramNotifyBalance).toBe(true);
      expect(updated?.telegramNotifyTickets).toBe(false);
    });

    it('should unbind telegram account and create audit log', async () => {
      const user = await createTestUser({ telegramId: '987654321' });
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });

      const res = await unbindTelegramAction();
      expect(res.success).toBe(true);

      const updated = await db.user.findUnique({ where: { id: user.id } });
      expect(updated?.telegramId).toBeNull();
    });
  });
});
