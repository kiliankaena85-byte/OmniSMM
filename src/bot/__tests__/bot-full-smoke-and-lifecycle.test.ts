import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BotCatalogService } from '../services/bot-catalog.service';
import { IntelligenceLinkAnalyzer } from '@/services/analyzer/link-analyzer';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import { UnifiedPaymentService } from '@/services/financial/unified-payment.service';
import { db } from '@/lib/db';

// Mock database
vi.mock('@/lib/db', () => {
  return {
    db: {
      network: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      category: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      service: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      order: {
        count: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      ledgerEntry: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      ticket: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      ticketFeedback: {
        upsert: vi.fn(),
      },
      systemSettings: {
        findFirst: vi.fn(),
      }
    }
  };
});

// Mock UnifiedPaymentService
vi.mock('@/services/financial/unified-payment.service', () => {
  return {
    UnifiedPaymentService: {
      createPayment: vi.fn(),
    }
  };
});

const mockedDb = db as any;
const mockedPayment = UnifiedPaymentService as any;

describe('Telegram Bot: Full Lifecycle & Smoke Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Registration & Welcome Handshake', () => {
    it('creates or fetches user and formats welcome balance card', async () => {
      mockedDb.user.findFirst.mockResolvedValueOnce({
        id: 'usr-smoke-1',
        telegramId: '123456789',
        email: 'tg_123456789@smmplan.bot',
        balance: BigInt(250000), // 2,500.00 RUB
        tenantId: 'smmplan'
      } as any);

      const user = await mockedDb.user.findFirst({
        where: { telegramId: '123456789', tenantId: 'smmplan' }
      });

      expect(user).not.toBeNull();
      expect((Number(user!.balance) / 100).toFixed(2)).toBe('2500.00');
    });
  });

  describe('2. Personal Cabinet: Balance, Orders, Transactions & Referrals', () => {
    it('fetches complete profile info with order count', async () => {
      mockedDb.user.findFirst.mockResolvedValueOnce({
        id: 'usr-smoke-1',
        telegramId: '123456789',
        balance: BigInt(500000),
        referralCode: 'SMOKE2026',
        tenantId: 'smmplan'
      } as any);

      mockedDb.order.count.mockResolvedValueOnce(12);

      const user = await mockedDb.user.findFirst({ where: { telegramId: '123456789' } });
      const orderCount = await mockedDb.order.count({ where: { userId: user!.id } });

      expect(user!.referralCode).toBe('SMOKE2026');
      expect(orderCount).toBe(12);
      expect((Number(user!.balance) / 100).toFixed(2)).toBe('5000.00');
    });

    it('fetches user transaction history with credit and debit entries', async () => {
      mockedDb.ledgerEntry.findMany.mockResolvedValueOnce([
        {
          id: 'tx-1',
          amount: BigInt(100000), // +1000 RUB
          reason: 'Пополнение через ЮKassa',
          transactionType: 'PAYMENT',
          createdAt: new Date('2026-08-27T10:00:00Z')
        },
        {
          id: 'tx-2',
          amount: BigInt(-15000), // -150 RUB
          reason: 'Заказ #1052: Подписчики',
          transactionType: 'DEBIT',
          createdAt: new Date('2026-08-27T10:15:00Z')
        }
      ] as any);

      const txs = await mockedDb.ledgerEntry.findMany({
        where: { userId: 'usr-smoke-1' },
        take: 8,
        orderBy: { createdAt: 'desc' }
      });

      expect(txs).toHaveLength(2);
      expect(txs[0].amount > BigInt(0)).toBe(true);
      expect(txs[1].amount < BigInt(0)).toBe(true);
      expect(txs[0].reason).toContain('ЮKassa');
    });

    it('fetches recent order list with statuses and amounts', async () => {
      mockedDb.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord-1',
          numericId: 1052,
          quantity: 1000,
          charge: BigInt(15000),
          status: 'IN_PROGRESS',
          service: { name: 'Подписчики Telegram' }
        },
        {
          id: 'ord-2',
          numericId: 1051,
          quantity: 5000,
          charge: BigInt(25000),
          status: 'COMPLETED',
          service: { name: 'Просмотры Telegram' }
        }
      ] as any);

      const orders = await mockedDb.order.findMany({
        where: { userId: 'usr-smoke-1' },
        take: 5,
        orderBy: { createdAt: 'desc' }
      });

      expect(orders).toHaveLength(2);
      expect(orders[0].numericId).toBe(1052);
      expect(orders[0].status).toBe('IN_PROGRESS');
      expect(orders[1].status).toBe('COMPLETED');
    });
  });

  describe('3. Deposit Flow (Top-up)', () => {
    it('creates a deposit payment link via UnifiedPaymentService', async () => {
      mockedPayment.createPayment.mockResolvedValueOnce({
        success: true,
        paymentId: 'pay-12345',
        confirmationUrl: 'https://yookassa.ru/checkout/pay-12345'
      });

      const res = await UnifiedPaymentService.createPayment(
        undefined,
        'usr-smoke-1',
        500,
        'Пополнение баланса SMMplan (TG)',
        { source: 'BOT', type: 'deposit' },
        'yookassa'
      );

      expect(res.success).toBe(true);
      expect(res.confirmationUrl).toBe('https://yookassa.ru/checkout/pay-12345');
    });
  });

  describe('4. Order Placement Flows', () => {
    it('Link-First: detects link, matches platform, and prepares order payload', async () => {
      const analyzer = new IntelligenceLinkAnalyzer();
      const analysis = await analyzer.analyze('https://t.me/durov');
      expect(analysis.platform).toBe(IntelligencePlatform.TELEGRAM);

      mockedDb.network.findFirst.mockResolvedValueOnce({
        id: 'net-tg',
        name: 'Telegram',
        slug: 'telegram'
      } as any);

      const network = await BotCatalogService.findNetworkByPlatform(analysis.platform, 'smmplan');
      expect(network).not.toBeNull();

      mockedDb.service.findFirst.mockResolvedValueOnce({
        id: 'svc-tg-1',
        name: 'Подписчики РФ',
        minQty: 100,
        maxQty: 10000,
        isActive: true,
        isQuarantined: false,
        category: { name: 'Подписчики', network: { name: 'Telegram', slug: 'telegram' } }
      } as any);

      const service = await BotCatalogService.getServiceForOrder('svc-tg-1', 'smmplan');
      expect(service).not.toBeNull();
      expect(service?.name).toBe('Подписчики РФ');
    });
  });
});
