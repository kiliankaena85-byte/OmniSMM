import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
// Мокаем ordersQueue для симуляции падения Redis во время добавления заказа
vi.mock('@/workers/queues', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    ordersQueue: {
      ...actual.ordersQueue,
      add: vi.fn().mockRejectedValue(new Error('Redis connection lost')),
    }
  };
});
import { ordersQueue } from '@/workers/queues';

/**
 * PREMORTEM TESTING (AI Framework: Priority 1)
 * Инжекция отказов на критических путях (Fault Injection).
 * Сценарий: Пользователь оплатил заказ, деньги списаны, но очередь BullMQ 
 * или сам провайдер упал в момент передачи заказа.
 * Цель: Убедиться, что транзакция в базе (Ledger) консистентна, заказ в статусе PENDING или ERROR,
 * и деньги не потеряны без следа.
 */
describe.skip('💀 Premortem Test: Provider Outage during Checkout', () => {
  let serviceNumericId: number;
  const userEmail = 'premortem@example.com';

  beforeEach(async () => {
    // Включаем тестовый режим
    await db.systemSettings.update({
      where: { id: 'global' },
      data: { isTestMode: true }
    });

    const category = await db.category.create({
      data: { name: 'Premortem Category' }
    });

    const service = await db.service.create({
      data: {
        name: 'Faulty Service',
        categoryId: category.id,
        rate: 10,
        markup: 2,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
      }
    });
    serviceNumericId = service.numericId;

    // Дадим пользователю баланс (чтобы заказ создался минуя статус AWAITING_PAYMENT, 
    // если мы переключим шлюз на 'internal_balance' - которого нет, мы используем yookassa).
    // CheckoutAction для yookassa всегда создает заказ со статусом AWAITING_PAYMENT 
    // и НЕ отправляет в очередь сразу.
    // Чтобы симулировать падение провайдера, нам нужен вызов функции, которая ДЕЙСТВИТЕЛЬНО
    // работает с балансом. Например, API v2 (action=add).
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Gracefully handles queue/provider failure without crashing the server', async () => {
    // Поскольку B2B API (action=add) списывает средства и сразу кидает заказ в очередь:
    const { POST } = await import('@/app/api/v2/route');
    
    const crypto = await import('crypto');
    // Создаем пользователя с балансом
    const user = await db.user.create({
      data: {
        email: userEmail,
        balance: 100000000n, // huge balance
        apiKeyHash: crypto.createHash('sha256').update('premortem-key').digest('hex'),
        role: 'USER',
      }
    });

    // Формируем B2B запрос (action=add)
    const req = new NextRequest('http://localhost/api/v2', {
      method: 'POST',
      body: `key=premortem-key&action=add&service=${serviceNumericId}&link=https://example.com&quantity=100`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    // Ожидаем, что POST вернет 200 OK с номером заказа (fallback logic), 
    // или 200 с ошибкой создания. 
    // Наша цель: проверить, что try/catch ловит ошибку мока queueManager и не роняет Node.js.
    const res = await POST(req);
    const resText = await res.text();
    console.log('API RESPONSE:', resText);
    expect(res.status).toBe(200);
    const data = JSON.parse(resText);
    
    // Заказ должен быть создан в базе! Ошибка очереди не отменяет оплаченный заказ.
    // Очередь должна попытаться переотправить заказ позже.
    expect(data.order).toBeDefined();

    // Проверяем консистентность в БД
    const orderInDb = await db.order.findUnique({ where: { numericId: Number(data.order) } });
    expect(orderInDb).toBeDefined();
    expect(orderInDb?.status).toBe('PENDING'); // Заказ должен висеть в PENDING, ожидая воркера

    // Проверяем, что деньги СПИСАНЫ (ведь заказ принят нами)
    const updatedUser = await db.user.findUnique({ where: { id: user.id } });
    // Баланс: начальный 100000000n минус стоимость заказа
    expect(updatedUser?.balance).toBe(100000000n - BigInt(orderInDb?.charge || 0n));

    // Убедимся, что мок действительно вызывался и упал
    expect(ordersQueue.add).toHaveBeenCalledOnce();
  });
});
