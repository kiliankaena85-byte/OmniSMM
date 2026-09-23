import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { createOfflineTicketAction } from '../offline-ticket';
import { RateLimitService } from '@/services/core/rate-limit.service';

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn(async () => true),
    checkCustomKey: vi.fn(async () => true),
  }
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn(async () => '127.0.0.1'),
}));

describe.sequential('createOfflineTicketAction', () => {
  let network: any;
  let category: any;
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const ts = Date.now() + Math.floor(Math.random() * 1000000);
    network = await db.network.create({
      data: { name: `Telegram ${ts}`, slug: `tg-offline-${ts}` }
    });

    category = await db.category.create({
      data: { name: `Подписчики Telegram ${ts}`, networkId: network.id }
    });

    service = await db.service.create({
      data: {
        name: `TG Subscribers Premium ${ts}`,
        categoryId: category.id,
        rate: 0.1,
        markup: 3.0,
        minQty: 10,
        maxQty: 10000,
        isActive: true,
      }
    });
  });

  afterEach(async () => {
    try {
      if (service?.id) await db.service.deleteMany({ where: { id: service.id } }).catch(() => {});
      if (category?.id) await db.category.deleteMany({ where: { id: category.id } }).catch(() => {});
      if (network?.id) await db.network.deleteMany({ where: { id: network.id } }).catch(() => {});
      await db.ticketMessage.deleteMany({ where: { ticket: { user: { email: { contains: '@smmplan.local' } } } } }).catch(() => {});
      await db.ticket.deleteMany({ where: { user: { email: { contains: '@smmplan.local' } } } }).catch(() => {});
      await db.user.deleteMany({ where: { email: { contains: '@smmplan.local' } } }).catch(() => {});
    } catch { /* ignore */ }
  });

  afterAll(async () => {
    try {
      await db.network.deleteMany({ where: { slug: { startsWith: 'tg-offline-' } } }).catch(() => {});
    } catch { /* ignore */ }
  });

  it('should successfully create an offline ticket for a new guest', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(true);
    vi.mocked(RateLimitService.checkCustomKey).mockResolvedValue(true);

    const result = await createOfflineTicketAction({
      serviceId: service.id,
      error: 'Card declined by bank',
      gateway: 'yookassa',
      quantity: 100,
      email: 'guest@smmplan.local',
      name: 'John Doe',
      url: 'https://t.me/channel'
    });

    if (!result.success) {
      console.error(JSON.stringify(result, null, 2));
    }
    expect(result.success).toBe(true);
    expect(result.ticketId).toBeDefined();

    // Verify DB writes
    const ticket = await db.ticket.findUnique({
      where: { id: result.ticketId },
      include: { messages: true, user: true }
    });

    expect(ticket).toBeDefined();
    expect(ticket?.subject).toContain('Ошибка оплаты [Шлюз: YOOKASSA]');
    expect(ticket?.user.email).toBe('guest@smmplan.local');
    expect(ticket?.messages).toHaveLength(1);
    expect(ticket?.messages[0].text).toContain('John Doe');
    expect(ticket?.messages[0].text).toContain('TG Subscribers Premium');
    expect(ticket?.messages[0].text).toContain('Card declined by bank');
  });

  it('should reject guest ticket if email belongs to a registered user', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(true);
    vi.mocked(RateLimitService.checkCustomKey).mockResolvedValue(true);

    // Create a registered user with passwordHash
    await db.user.create({
      data: {
        email: 'registered@smmplan.local',
        passwordHash: 'hashed_password_123',
      }
    });

    const result = await createOfflineTicketAction({
      serviceId: null,
      error: 'Insufficient funds',
      gateway: 'cryptobot',
      quantity: null,
      email: 'registered@smmplan.local',
      name: 'Alice',
      url: null
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('привязан к зарегистрированному аккаунту');
  });

  it('should block ticket creation if IP rate limit is exceeded', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(false); // IP blocked

    const result = await createOfflineTicketAction({
      serviceId: null,
      error: 'Fail',
      gateway: 'yookassa',
      quantity: null,
      email: 'spammer@smmplan.local',
      name: null,
      url: null
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Слишком много обращений с вашего IP');
  });

  it('should nullify orderId and paymentId if they belong to another user', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(true);
    vi.mocked(RateLimitService.checkCustomKey).mockResolvedValue(true);

    // Create another user
    const otherUser = await db.user.create({
      data: { email: 'other@smmplan.local' }
    });

    // Create order and payment for otherUser
    const order = await db.order.create({
      data: {
        userId: otherUser.id,
        serviceId: service.id,
        quantity: 100,
        charge: BigInt(10),
        providerCost: BigInt(5),
        status: 'PENDING',
        link: 'https://vk.com/post'
      }
    });

    const payment = await db.payment.create({
      data: {
        userId: otherUser.id,
        amount: BigInt(100),
        gateway: 'yookassa',
        status: 'PENDING'
      }
    });

    // Create ticket for guest@smmplan.local
    const result = await createOfflineTicketAction({
      serviceId: null,
      error: 'Card declined',
      gateway: 'yookassa',
      quantity: null,
      email: 'guest@smmplan.local',
      name: 'John Guest',
      url: null,
      orderId: order.id,
      paymentId: payment.id
    });

    expect(result.success).toBe(true);
    expect(result.ticketId).toBeDefined();

    const ticket = await db.ticket.findUnique({
      where: { id: result.ticketId }
    });

    // They should be nullified since they belong to otherUser, not guest@smmplan.local
    expect(ticket?.orderId).toBeNull();
    expect(ticket?.paymentId).toBeNull();
  });

  it('should preserve orderId and paymentId if they belong to the correct user', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(true);
    vi.mocked(RateLimitService.checkCustomKey).mockResolvedValue(true);

    // Create the guest shadow user first so we get the exact same ID
    const guestUser = await db.user.create({
      data: { email: 'guest@smmplan.local' }
    });

    // Create order and payment for the guestUser
    const order = await db.order.create({
      data: {
        userId: guestUser.id,
        serviceId: service.id,
        quantity: 100,
        charge: BigInt(10),
        providerCost: BigInt(5),
        status: 'PENDING',
        link: 'https://vk.com/post'
      }
    });

    const payment = await db.payment.create({
      data: {
        userId: guestUser.id,
        amount: BigInt(100),
        gateway: 'yookassa',
        status: 'PENDING'
      }
    });

    const result = await createOfflineTicketAction({
      serviceId: null,
      error: 'Card declined',
      gateway: 'yookassa',
      quantity: null,
      email: 'guest@smmplan.local',
      name: 'John Guest',
      url: null,
      orderId: order.id,
      paymentId: payment.id
    });

    expect(result.success).toBe(true);
    expect(result.ticketId).toBeDefined();

    const ticket = await db.ticket.findUnique({
      where: { id: result.ticketId }
    });

    // They should be preserved since they belong to guest@smmplan.local
    expect(ticket?.orderId).toBe(order.id);
    expect(ticket?.paymentId).toBe(payment.id);
  });
});
