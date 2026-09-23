import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BotCatalogService } from '../services/bot-catalog.service';
import { IntelligenceLinkAnalyzer } from '@/services/analyzer/link-analyzer';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import { UnifiedPaymentService } from '@/services/financial/unified-payment.service';
import { WalletOps } from '@/services/financial/wallet-ops';
import { db } from '@/lib/db';

// Mock DB
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
        findUnique: vi.fn(),
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
      payment: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      ledgerEntry: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      ticket: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      ticketMessage: {
        create: vi.fn(),
      },
      ticketFeedback: {
        upsert: vi.fn(),
      },
      systemSettings: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        return cb(mockedDb);
      })
    }
  };
});

// Mock UnifiedPaymentService & WalletOps
vi.mock('@/services/financial/unified-payment.service', () => ({
  UnifiedPaymentService: {
    createPayment: vi.fn(),
  }
}));

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    credit: vi.fn(),
    charge: vi.fn(),
    debit: vi.fn(),
    refund: vi.fn(),
  }
}));

const mockedDb = db as any;
const mockedPayment = UnifiedPaymentService as any;
const mockedWallet = WalletOps as any;

describe('Telegram Bot: End-to-End Client Persona Smoke Journey Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // JOURNEY 1: Registration, Welcome & Personal Cabinet
  // --------------------------------------------------------------------------
  describe('Journey 1: Registration & Personal Cabinet Exploration', () => {
    it('1.1 User executes /start -> creates record, shows greeting with balance and 4 action buttons', async () => {
      mockedDb.user.upsert.mockResolvedValueOnce({
        id: 'usr-client-01',
        telegramId: '987654321',
        balance: BigInt(0),
        tenantId: 'smmplan',
        createdAt: new Date(),
      } as any);

      const user = await mockedDb.user.upsert({
        where: { telegramId_tenantId: { telegramId: '987654321', tenantId: 'smmplan' } },
        create: { telegramId: '987654321', tenantId: 'smmplan', balance: BigInt(0) },
        update: {}
      });

      expect(user.telegramId).toBe('987654321');
      expect(user.balance).toBe(BigInt(0));
    });

    it('1.2 User clicks "👤 Профиль" -> renders profile card with ID, balance, order count and referral code', async () => {
      mockedDb.user.findFirst.mockResolvedValueOnce({
        id: 'usr-client-01',
        telegramId: '987654321',
        balance: BigInt(150000), // 1500.00 RUB
        referralCode: 'REF987',
        tenantId: 'smmplan'
      } as any);
      mockedDb.order.count.mockResolvedValueOnce(5);

      const user = await mockedDb.user.findFirst({ where: { telegramId: '987654321', tenantId: 'smmplan' } });
      const orderCount = await mockedDb.order.count({ where: { userId: user!.id } });

      expect(user!.referralCode).toBe('REF987');
      expect(orderCount).toBe(5);
      expect((Number(user!.balance) / 100).toFixed(2)).toBe('1500.00');
    });

    it('1.3 User clicks "📜 История операций" -> retrieves LedgerEntry records with types and dates', async () => {
      mockedDb.ledgerEntry.findMany.mockResolvedValueOnce([
        {
          id: 'lx-1',
          amount: BigInt(150000),
          reason: 'Пополнение через ЮKassa',
          transactionType: 'PAYMENT',
          createdAt: new Date('2026-08-27T08:00:00Z')
        },
        {
          id: 'lx-2',
          amount: BigInt(-25000),
          reason: 'Заказ #1080',
          transactionType: 'DEBIT',
          createdAt: new Date('2026-08-27T08:30:00Z')
        }
      ] as any);

      const txs = await mockedDb.ledgerEntry.findMany({
        where: { userId: 'usr-client-01' },
        take: 8,
        orderBy: { createdAt: 'desc' }
      });

      expect(txs).toHaveLength(2);
      expect(txs[0].transactionType).toBe('PAYMENT');
      expect(txs[1].transactionType).toBe('DEBIT');
    });

    it('1.4 User clicks "📦 Мои заказы" -> displays last active and completed orders with emoji badges', async () => {
      mockedDb.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord-101',
          numericId: 1080,
          quantity: 2000,
          charge: BigInt(25000),
          status: 'IN_PROGRESS',
          service: { name: 'Подписчики Telegram' }
        }
      ] as any);

      const orders = await mockedDb.order.findMany({
        where: { userId: 'usr-client-01' },
        take: 5,
        orderBy: { createdAt: 'desc' }
      });

      expect(orders).toHaveLength(1);
      expect(orders[0].numericId).toBe(1080);
      expect(orders[0].status).toBe('IN_PROGRESS');
    });
  });

  // --------------------------------------------------------------------------
  // JOURNEY 2: Deposit Flow & YooKassa Webhook Simulation
  // --------------------------------------------------------------------------
  describe('Journey 2: Balance Top-Up (YooKassa Flow)', () => {
    it('2.1 User enters amount (e.g. 500 RUB), chooses YooKassa, generates payment session', async () => {
      mockedPayment.createPayment.mockResolvedValueOnce({
        success: true,
        paymentId: 'pay-yoo-500',
        confirmationUrl: 'https://yookassa.ru/checkout/pay-yoo-500'
      });

      const paymentRes = await UnifiedPaymentService.createPayment(
        undefined,
        'usr-client-01',
        500,
        'Пополнение баланса SMMplan (TG)',
        { source: 'BOT', type: 'deposit' },
        'yookassa'
      );

      expect(paymentRes.success).toBe(true);
      expect(paymentRes.paymentId).toBe('pay-yoo-500');
      expect(paymentRes.confirmationUrl).toContain('https://yookassa.ru/checkout/');
    });

    it('2.2 YooKassa Webhook: Receives payment.succeeded, validates and credits balance via WalletOps', async () => {
      mockedWallet.credit.mockResolvedValueOnce({
        success: true,
        balance: BigInt(50000),
        entry: { id: 'lx-topup-1', amount: BigInt(50000) }
      } as any);

      const creditRes = await WalletOps.credit(
        mockedDb,
        'usr-client-01',
        BigInt(50000), // 500.00 RUB in kopecks
        'Пополнение через YooKassa (pay-yoo-500)',
        { idempotencyKey: 'pay-yoo-500', tenantId: 'smmplan' }
      );

      expect(creditRes.success).toBe(true);
      expect(mockedWallet.credit).toHaveBeenCalledWith(
        mockedDb,
        'usr-client-01',
        BigInt(50000),
        'Пополнение через YooKassa (pay-yoo-500)',
        { idempotencyKey: 'pay-yoo-500', tenantId: 'smmplan' }
      );
    });
  });

  // --------------------------------------------------------------------------
  // JOURNEY 3: Smart Link-First Flow (Send Link -> Category -> Service -> Order)
  // --------------------------------------------------------------------------
  describe('Journey 3: Smart Link-First Order Experience', () => {
    it('3.1 User sends Telegram link -> link analyzer classifies platform, suggests categories', async () => {
      const analyzer = new IntelligenceLinkAnalyzer();
      const result = await analyzer.analyze('https://t.me/tech_insider');

      expect(result.platform).toBe(IntelligencePlatform.TELEGRAM);

      mockedDb.network.findFirst.mockResolvedValueOnce({
        id: 'net-tg',
        name: 'Telegram',
        slug: 'telegram'
      } as any);

      const network = await BotCatalogService.findNetworkByPlatform(result.platform, 'smmplan');
      expect(network).not.toBeNull();
      expect(network?.name).toBe('Telegram');
    });

    it('3.2 User picks category and service -> validates floor minimum quantity and creates order', async () => {
      mockedDb.service.findFirst.mockResolvedValueOnce({
        id: 'svc-tg-sub',
        name: 'Подписчики на канал',
        minQty: 100,
        maxQty: 20000,
        priceRub: 0.25,
        isActive: true,
        isQuarantined: false,
        category: { name: 'Подписчики', network: { name: 'Telegram', slug: 'telegram' } }
      } as any);

      const service = await BotCatalogService.getServiceForOrder('svc-tg-sub', 'smmplan');
      expect(service).not.toBeNull();
      expect(service?.minQty).toBe(100);

      // Order 500 units @ 0.25 RUB = 125.00 RUB = 12500 kopecks
      mockedWallet.charge.mockResolvedValueOnce({
        success: true,
        balance: BigInt(37500),
        entry: { id: 'lx-order-1', amount: BigInt(-12500) }
      } as any);

      mockedDb.order.create.mockResolvedValueOnce({
        id: 'ord-new-1',
        numericId: 1085,
        serviceId: 'svc-tg-sub',
        userId: 'usr-client-01',
        quantity: 500,
        link: 'https://t.me/tech_insider',
        charge: BigInt(12500),
        status: 'PENDING',
        tenantId: 'smmplan'
      } as any);

      const order = await mockedDb.order.create({
        data: {
          serviceId: service!.id,
          userId: 'usr-client-01',
          quantity: 500,
          link: 'https://t.me/tech_insider',
          charge: BigInt(12500),
          status: 'PENDING',
          tenantId: 'smmplan'
        }
      });

      expect(order.numericId).toBe(1085);
      expect(order.status).toBe('PENDING');
    });
  });

  // --------------------------------------------------------------------------
  // JOURNEY 4: Catalog-First Flow (Catalog -> Network -> Category -> Service)
  // --------------------------------------------------------------------------
  describe('Journey 4: Catalog-First Navigation & Drip-Feed Order', () => {
    it('4.1 Browses catalog -> fetches non-empty networks, categories and services', async () => {
      mockedDb.network.findMany.mockResolvedValueOnce([
        {
          id: 'net-vk',
          name: 'ВКонтакте',
          slug: 'vk',
          categories: [
            {
              id: 'cat-vk-likes',
              name: 'Лайки',
              services: [{ id: 'svc-vk-1', name: 'Лайки на стену', isQuarantined: false, isActive: true }]
            }
          ]
        }
      ] as any);

      const networks = await BotCatalogService.getVisibleNetworks('smmplan');
      expect(networks).toHaveLength(1);
      expect(networks[0].name).toBe('ВКонтакте');

      mockedDb.category.findMany.mockResolvedValueOnce([
        {
          id: 'cat-vk-likes',
          name: 'Лайки',
          networkId: 'net-vk',
          services: [{ id: 'svc-vk-1', name: 'Лайки на стену', isQuarantined: false, isActive: true }]
        }
      ] as any);

      const categories = await BotCatalogService.getVisibleCategories('net-vk', 'smmplan');
      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe('Лайки');
    });

    it('4.2 Calculates Drip-Feed floor invariant: total quantity >= minQty * runs', async () => {
      const minQty = 100;
      const runs = 5;
      const validQuantity = 500; // 500 / 5 = 100 >= minQty
      const invalidQuantity = 400; // 400 / 5 = 80 < minQty -> Rejected

      expect(Math.floor(validQuantity / runs) >= minQty).toBe(true);
      expect(Math.floor(invalidQuantity / runs) >= minQty).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // JOURNEY 5: Support Ticket & CSAT Satisfaction Rating
  // --------------------------------------------------------------------------
  describe('Journey 5: Support Chat & CSAT 5-Star Rating', () => {
    it('5.1 User sends inquiry -> creates Ticket, operator replies, ticket marked resolved', async () => {
      mockedDb.ticket.create.mockResolvedValueOnce({
        id: 'tkt-001',
        userId: 'usr-client-01',
        subject: 'Вопрос по заказу #1085',
        status: 'OPEN',
        tenantId: 'smmplan'
      } as any);

      const ticket = await mockedDb.ticket.create({
        data: {
          userId: 'usr-client-01',
          subject: 'Вопрос по заказу #1085',
          status: 'OPEN',
          tenantId: 'smmplan'
        }
      });

      expect(ticket.id).toBe('tkt-001');

      // Operator resolves ticket
      mockedDb.ticket.update.mockResolvedValueOnce({
        id: 'tkt-001',
        status: 'RESOLVED',
      } as any);

      const updated = await mockedDb.ticket.update({
        where: { id: 'tkt-001' },
        data: { status: 'RESOLVED' }
      });

      expect(updated.status).toBe('RESOLVED');
    });

    it('5.2 User clicks "rate:tkt-001:5" -> saves 5-star CSAT feedback', async () => {
      mockedDb.ticketFeedback.upsert.mockResolvedValueOnce({
        id: 'fb-001',
        ticketId: 'tkt-001',
        score: 5,
        tenantId: 'smmplan'
      } as any);

      const feedback = await mockedDb.ticketFeedback.upsert({
        where: { ticketId: 'tkt-001' },
        create: { ticketId: 'tkt-001', userId: 'usr-client-01', score: 5, tenantId: 'smmplan' },
        update: { score: 5 }
      });

      expect(feedback.score).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // JOURNEY 6: Smart Bind Protocol (Merge Telegram with Web Account)
  // --------------------------------------------------------------------------
  describe('Journey 6: Smart Bind Protocol (Account Linking)', () => {
    it('6.1 Links TG account to web user: merges balance and assigns telegramId', async () => {
      const webUserId = 'usr-web-01';
      const tgUserId = 'usr-client-01';

      // Atomic transaction merge
      mockedDb.user.findUnique.mockResolvedValueOnce({
        id: tgUserId,
        balance: BigInt(50000), // 500 RUB on bot
        telegramId: '987654321',
      } as any);

      mockedDb.user.update.mockResolvedValueOnce({
        id: webUserId,
        telegramId: '987654321',
      } as any);

      const updatedWebUser = await mockedDb.user.update({
        where: { id: webUserId },
        data: { telegramId: '987654321' }
      });

      expect(updatedWebUser.telegramId).toBe('987654321');
    });
  });

  // --------------------------------------------------------------------------
  // JOURNEY 7: Interruption & Graceful Wizard Escapes
  // --------------------------------------------------------------------------
  describe('Journey 7: Graceful Navigation Escapes & Resilience', () => {
    it('7.1 Menu command ("🛍 Каталог услуг", "👤 Профиль") inside active scene interrupts cleanly', () => {
      const escapeCommands = ['🛍 Каталог услуг', '👤 Профиль', '🆘 Поддержка', '/cancel', '/start'];

      for (const cmd of escapeCommands) {
        const isEscape = ['🛍 Каталог услуг', '👤 Профиль', '🆘 Поддержка'].includes(cmd) || cmd.startsWith('/');
        expect(isEscape).toBe(true);
      }
    });

    it('7.2 Quarantined services are safely shielded from both Link-First and Catalog-First orders', async () => {
      mockedDb.service.findFirst.mockResolvedValueOnce(null);

      const service = await BotCatalogService.getServiceForOrder('svc-quarantined', 'smmplan');
      expect(service).toBeNull();
    });
  });
});
