import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderTriageAlertService } from '@/services/orders/order-triage-alert.service';
import { BalanceAutoFlushService } from '@/services/providers/balance-autoflush.service';

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn().mockResolvedValue(true),
  sendAdminAlertSync: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('@/lib/queue-manager', () => ({
  ordersQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job' }),
  },
  telegramQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job' }),
  },
  getRedisConnection: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }),
}));

describe('Order Triage & Provider Balance Auto-Flush Logic (RAC-2026)', () => {
  describe('1. Error Classification & Semantic Tagging', () => {
    it('accurately classifies balance insufficiency errors', () => {
      const cases = [
        'Not enough balance on provider account',
        'insufficient_provider_balance',
        'User has not enough funds',
        'Low balance: 0.12 USD',
        'Пополните баланс у поставщика',
        'Error: not_enough_funds',
      ];

      for (const err of cases) {
        const res = OrderTriageAlertService.classifyError(err);
        expect(res.type).toBe('INSUFFICIENT_PROVIDER_BALANCE');
        expect(res.isBalanceRelated).toBe(true);
        expect(res.tag).toBe('[INSUFFICIENT_PROVIDER_BALANCE]');
        expect(BalanceAutoFlushService.isBalanceRelatedError(err)).toBe(true);
      }
    });

    it('accurately classifies private account / closed profile errors', () => {
      const cases = [
        'Account is private',
        'Channel is private or restricted',
        'Closed profile, cannot deliver followers',
        'Заказ не может быть выполнен: приватный аккаунт',
      ];

      for (const err of cases) {
        const res = OrderTriageAlertService.classifyError(err);
        expect(res.type).toBe('PRIVATE_ACCOUNT');
        expect(res.isBalanceRelated).toBe(false);
        expect(res.tag).toBe('[PRIVATE_ACCOUNT]');
        expect(res.supportAction).toContain('Свяжитесь с клиентом');
        expect(BalanceAutoFlushService.isBalanceRelatedError(err)).toBe(false);
      }
    });

    it('accurately classifies bad link / invalid format errors', () => {
      const cases = [
        'Invalid link format: expected post URL',
        'Link is broken or post not found',
        'Некорректная ссылка на объект',
        'Post not found / 404',
      ];

      for (const err of cases) {
        const res = OrderTriageAlertService.classifyError(err);
        expect(res.type).toBe('INVALID_LINK');
        expect(res.isBalanceRelated).toBe(false);
        expect(res.tag).toBe('[INVALID_LINK]');
        expect(res.supportAction).toContain('Проверьте правильность формата ссылки');
        expect(BalanceAutoFlushService.isBalanceRelatedError(err)).toBe(false);
      }
    });

    it('accurately classifies quantity limits violation errors', () => {
      const cases = [
        'Quantity is below min 100',
        'Max limit exceeded: 50000',
        'Количество меньше минимального',
      ];

      for (const err of cases) {
        const res = OrderTriageAlertService.classifyError(err);
        expect(res.type).toBe('LIMITS_VIOLATION');
        expect(res.isBalanceRelated).toBe(false);
        expect(res.tag).toBe('[LIMITS_VIOLATION]');
      }
    });

    it('accurately classifies disabled / maintenance service errors', () => {
      const cases = [
        'Service is currently disabled',
        'Maintenance in progress on provider node',
        'Услуга временно отключена поставщиком',
      ];

      for (const err of cases) {
        const res = OrderTriageAlertService.classifyError(err);
        expect(res.type).toBe('SERVICE_DISABLED');
        expect(res.isBalanceRelated).toBe(false);
        expect(res.tag).toBe('[SERVICE_DISABLED]');
        expect(res.supportAction).toContain('Переключите заказ на резервного поставщика');
      }
    });
  });

  describe('2. Human-Readable Error Formatting', () => {
    it('formats Russian order error message with provider name and action', () => {
      const classification = OrderTriageAlertService.classifyError('Account is private');
      const msg = OrderTriageAlertService.formatOrderErrorMessage(
        classification,
        'Account is private',
        'VexBoost Provider'
      );

      expect(msg).toContain('[PRIVATE_ACCOUNT]');
      expect(msg).toContain('VexBoost Provider');
      expect(msg).toContain('Account is private');
      expect(msg).toContain('Свяжитесь с клиентом');
    });

    it('formats Russian balance error message indicating auto-flush wait state', () => {
      const classification = OrderTriageAlertService.classifyError('Not enough funds');
      const msg = OrderTriageAlertService.formatOrderErrorMessage(
        classification,
        'Not enough funds',
        'JustAnotherPanel'
      );

      expect(msg).toContain('[INSUFFICIENT_PROVIDER_BALANCE]');
      expect(msg).toContain('JustAnotherPanel');
      expect(msg).toContain('автоматического пополнения');
    });
  });

  describe('3. Telegram Alert Formatting & Non-Fatal Execution', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('sends non-balance support alert with order context and operator link', async () => {
      const { sendAdminAlertSync } = await import('@/lib/notifications');

      await OrderTriageAlertService.sendOrderCheckAlert(
        {
          orderId: 'ord_12345',
          numericId: 99881,
          serviceName: 'TG Подписчики (Быстрые)',
          categoryName: 'Подписчики',
          networkName: 'Telegram',
          link: 'https://t.me/private_channel_test',
          quantity: 1000,
          chargeKopecks: 25000,
          userEmail: 'client@example.com',
          tenantId: 'smmplan',
          providerName: 'SMM Provider A',
        },
        'Channel is private or restricted',
        'SMM Provider A'
      );

      expect(sendAdminAlertSync).toHaveBeenCalledTimes(1);
      const [msg, severity, tenantId] = (sendAdminAlertSync as any).mock.calls[0];
      expect(severity).toBe('CRITICAL');
      expect(tenantId).toBe('smmplan');
      expect(msg).toContain('ТРЕБУЕТСЯ ПРОВЕРКА ЗАКАЗА — САППОРТ');
      expect(msg).toContain('#99881');
      expect(msg).toContain('https://t.me/private_channel_test');
      expect(msg).toContain('client@example.com');
      expect(msg).toContain('250.00 ₽');
      expect(msg).toContain('https://smmplan.pro/operator/orders?search=99881');
    });

    it('sends balance notification with non-critical WARNING severity', async () => {
      const { sendAdminAlertSync } = await import('@/lib/notifications');

      await OrderTriageAlertService.sendOrderCheckAlert(
        {
          orderId: 'ord_54321',
          numericId: 77665,
          serviceName: 'VK Лайки',
          categoryName: 'Лайки',
          networkName: 'VKontakte',
          link: 'https://vk.com/wall-123_456',
          quantity: 500,
          chargeKopecks: 12000,
          userEmail: 'vk_user@example.com',
          tenantId: 'smmplan',
          providerName: 'FastProvider',
        },
        'Low balance on provider: 0.05 USD',
        'FastProvider'
      );

      expect(sendAdminAlertSync).toHaveBeenCalledTimes(1);
      const [msg, severity] = (sendAdminAlertSync as any).mock.calls[0];
      expect(severity).toBe('WARNING');
      expect(msg).toContain('ЗАКОНЧИЛСЯ БАЛАНС У ПОСТАВЩИКА');
      expect(msg).toContain('НЕ отменяется');
      expect(msg).toContain('Автоопрос');
    });

    it('sends team alert when balance is replenished and orders are auto-flushed', async () => {
      const { sendAdminAlertSync } = await import('@/lib/notifications');

      await OrderTriageAlertService.sendBalanceAutoFlushAlert({
        providerName: 'FastProvider',
        balanceRub: 15420.50,
        flushedCount: 12,
        skippedCount: 2,
      });

      expect(sendAdminAlertSync).toHaveBeenCalledTimes(1);
      const [msg, severity] = (sendAdminAlertSync as any).mock.calls[0];
      expect(severity).toBe('INFO');
      expect(msg).toContain('АВТО-ЗАПУСК ЗАКАЗОВ');
      expect(msg).toContain('12 шт.');
      expect(msg).toContain('15420.50 ₽');
    });
  });
});
