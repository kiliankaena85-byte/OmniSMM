import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue({ messageId: 'test-msg-id' })
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail
    })
  }
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getEmailSettings: vi.fn().mockResolvedValue({
      emailProvider: 'SMTP',
      smtpHost: 'smtp.test.local',
      smtpPort: 465,
      smtpFrom: 'noreply@smmplan.pro',
      smtpUser: 'test-user',
      smtpPassword: 'test-password'
    })
  }
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    })
  }
}));

vi.mock('@/lib/seo-helpers', () => ({
  normalizeTenantId: vi.fn((t?: string | null) => t || 'smmplan'),
  getTenantSiteName: vi.fn(() => 'SMMplan'),
  getTenantHost: vi.fn(() => 'smmplan.pro')
}));

import { sendOrderBalanceDebitMail, sendOrderPaidMail } from '@/lib/smtp';

describe('Balance Payment 54-FZ & Email Legal Invariants (ADR-2026-10)', () => {
  beforeEach(() => {
    mockSendMail.mockClear();
  });

  describe('sendOrderBalanceDebitMail — Legal Compliance', () => {
    it('CRITICAL 54-FZ: Subject MUST NOT contain word "Чек" or "чек"', async () => {
      await sendOrderBalanceDebitMail({
        email: 'client@example.com',
        orderId: '450',
        serviceName: 'Telegram Подписчики',
        chargedCents: 15000, // 150.00 RUB
        remainingBalanceCents: 85000, // 850.00 RUB
        tenantId: 'smmplan'
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];

      // Subject check
      expect(callArgs.subject).not.toMatch(/чек/i);
      expect(callArgs.subject).toContain('Заказ #450 запущен — списание с баланса');
    });

    it('CRITICAL 54-FZ: Body MUST NOT claim OFD transmission or local 54-FZ receipt creation', async () => {
      await sendOrderBalanceDebitMail({
        email: 'client@example.com',
        orderId: '451',
        serviceName: 'VK Подписчики',
        chargedCents: 20000,
        remainingBalanceCents: 50000,
        tenantId: 'smmplan'
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      const html = callArgs.html;

      // Must NOT claim that receipt was sent to OFD
      expect(html).not.toMatch(/сформирован и отправлен в офд/i);
      expect(html).not.toMatch(/электронный чек 54-фз: сформирован/i);
    });

    it('Explicitly informs user that payment is from internal balance (advance) and NO card charge occurred', async () => {
      await sendOrderBalanceDebitMail({
        email: 'user@test.ru',
        orderId: '999',
        serviceName: 'Просмотры постов',
        chargedCents: 5000, // 50.00 RUB
        remainingBalanceCents: 12000, // 120.00 RUB
        tenantId: 'smmplan'
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      const html = callArgs.html;

      // Check for clear balance deduction info
      expect(html).toContain('Списано с баланса:');
      expect(html).toContain('50 ₽');
      expect(html).toContain('Остаток на балансе:');
      expect(html).toContain('120 ₽');

      // Check for the legal protective disclaimer
      expect(html).toContain('Оплата произведена с вашего внутреннего лицевого счёта (ранее внесенный аванс)');
      expect(html).toContain('Повторное списание с вашей банковской карты не производилось');
      expect(html).toContain('Кассовый чек по 54-ФЗ был предоставлен вам ранее в момент пополнения баланса');
    });

    it('Handles case when remaining balance is 0 or null cleanly', async () => {
      await sendOrderBalanceDebitMail({
        email: 'user@test.ru',
        orderId: '1000',
        serviceName: 'Быстрые лайки',
        chargedCents: 3000,
        remainingBalanceCents: 0,
        tenantId: 'smmplan'
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      const html = callArgs.html;

      expect(html).toContain('Списано с баланса:');
      expect(html).toContain('30 ₽');
      expect(html).toContain('Остаток на балансе:');
      expect(html).toContain('0 ₽');
    });
  });

  describe('sendOrderPaidMail — External Acquiring Gateway Compliance', () => {
    it('Properly informs user about external payment operator receipt and avoids fake local OFD claims', async () => {
      await sendOrderPaidMail(
        'carduser@example.com',
        '777',
        'Telegram Бусты',
        'smmplan'
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      const html = callArgs.html;

      // Subject has clear title
      expect(callArgs.subject).toContain('Оплата получена и запуск заказа #777');
      // Body clarifies operator delivery
      expect(html).toContain('направлен на вашу почту платежным оператором');
      expect(html).not.toMatch(/сформирован и отправлен в офд/i);
    });
  });
});
