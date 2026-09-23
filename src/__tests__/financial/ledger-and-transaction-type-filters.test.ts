import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(async (sec: string, act: string, fn: (admin: any) => Promise<any>) => {
    return fn({ id: 'test-admin-id', email: 'admin@smmplan.pro', role: 'ADMIN', tenantId: 'smmplan' });
  }),
}));

vi.mock('@/lib/operator/rbac', () => ({
  requireOperatorPermission: vi.fn(async (sec: string, act: string, fn: (operator: any) => Promise<any>) => {
    return fn({ id: 'test-operator-id', email: 'operator@smmplan.pro', role: 'SUPPORT', tenantId: 'smmplan' });
  }),
}));

import { getLedgerAction } from '@/actions/admin/finance/ledger';
import { getTransactionsListAction } from '@/actions/operator/transactions/get-transactions-list.action';

describe('Financial Ledger & Transaction Status / Type Filters Suite', () => {
  let testUserId: string;
  let testUserEmail: string;

  beforeEach(async () => {
    testUserEmail = `filter-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@smmplan.pro`;
    const user = await db.user.create({
      data: {
        email: testUserEmail,
        role: 'ADMIN',
        balance: BigInt(100000),
        tenantId: 'smmplan',
      }
    });
    testUserId = user.id;

    // 1. Top-up (Пополнение баланса)
    await db.ledgerEntry.create({
      data: {
        userId: testUserId,
        amount: BigInt(500000), // +5000 RUB
        reason: 'Пополнение баланса через ЮKassa',
        transactionType: 'PAYMENT',
        status: 'APPROVED',
        tenantId: 'smmplan',
        idempotencyKey: `topup-${Date.now()}-1`,
      }
    });

    // 2. Order Debit (Списание за заказ)
    await db.ledgerEntry.create({
      data: {
        userId: testUserId,
        amount: BigInt(-150000), // -1500 RUB
        reason: 'Списание за оформление заказа #101',
        transactionType: 'PAYMENT',
        status: 'APPROVED',
        tenantId: 'smmplan',
        idempotencyKey: `debit-${Date.now()}-2`,
      }
    });

    // 3. Refund (Возврат средств)
    await db.ledgerEntry.create({
      data: {
        userId: testUserId,
        amount: BigInt(75000), // +750 RUB
        reason: 'Возврат средств за отменённый заказ #101',
        transactionType: 'REFUND',
        status: 'APPROVED',
        tenantId: 'smmplan',
        idempotencyKey: `refund-${Date.now()}-3`,
      }
    });

    // 4. Quarantine transaction (Карантин / На проверке)
    await db.ledgerEntry.create({
      data: {
        userId: testUserId,
        amount: BigInt(1000000), // +10000 RUB
        reason: 'Пополнение баланса (подозрительный платёж)',
        transactionType: 'PAYMENT',
        status: 'QUARANTINE',
        tenantId: 'smmplan',
        idempotencyKey: `quarantine-${Date.now()}-4`,
      }
    });

    // 5. Order Cancel (Отмена заказа администратором)
    await db.ledgerEntry.create({
      data: {
        userId: testUserId,
        amount: BigInt(150000), // +1500 RUB
        reason: 'Отмена заказа 999111 администратором - Возврат средств',
        transactionType: 'ORDER_CANCEL',
        status: 'APPROVED',
        tenantId: 'smmplan',
        idempotencyKey: `cancel-${Date.now()}-5`,
      }
    });

    // 6. Reroute (Перезапуск заказа)
    await db.ledgerEntry.create({
      data: {
        userId: testUserId,
        amount: BigInt(-150000), // -1500 RUB
        reason: 'Перезапуск заказа 999111 администратором - Повторное списание',
        transactionType: 'REROUTE',
        status: 'APPROVED',
        tenantId: 'smmplan',
        idempotencyKey: `reroute-${Date.now()}-6`,
      }
    });
  });

  it('1. Correctly filters ONLY Top-up (Пополнения баланса) transactions', async () => {
    const res = await getLedgerAction({
      type: 'TOPUP',
      search: testUserEmail,
      period: 'all',
    });

    expect('items' in res).toBe(true);
    if ('items' in res) {
      expect(res.items.length).toBeGreaterThanOrEqual(1);
      for (const item of res.items) {
        expect(item.amount).toBeGreaterThan(0);
        expect(item.transactionType).not.toBe('REFUND');
      }
    }
  });

  it('2. Correctly filters ONLY Debit (Списания / ORDER_CHARGE) transactions', async () => {
    const res = await getLedgerAction({
      type: 'ORDER_CHARGE',
      search: testUserEmail,
      period: 'all',
    });

    expect('items' in res).toBe(true);
    if ('items' in res) {
      expect(res.items.length).toBeGreaterThanOrEqual(1);
      for (const item of res.items) {
        expect(item.amount).toBeLessThan(0);
      }
    }
  });

  it('3. Correctly filters ONLY Refund (Возвраты) transactions', async () => {
    const res = await getLedgerAction({
      type: 'REFUND',
      search: testUserEmail,
      period: 'all',
    });

    expect('items' in res).toBe(true);
    if ('items' in res) {
      expect(res.items.length).toBeGreaterThanOrEqual(1);
      for (const item of res.items) {
        expect(item.transactionType === 'REFUND' || item.reason.includes('Возврат')).toBe(true);
      }
    }
  });

  it('4. Correctly filters by Quarantine status', async () => {
    const res = await getLedgerAction({
      status: 'QUARANTINE',
      search: testUserEmail,
      period: 'all',
    });

    expect('items' in res).toBe(true);
    if ('items' in res) {
      expect(res.items.length).toBe(1);
      expect(res.items[0].status).toBe('QUARANTINE');
    }
  });

  it('5. Correctly filters ORDER_CANCEL transactions', async () => {
    const res = await getLedgerAction({
      type: 'ORDER_CANCEL',
      search: testUserEmail,
      period: 'all',
    });

    expect('items' in res).toBe(true);
    if ('items' in res) {
      expect(res.items.length).toBe(1);
      expect(res.items[0].transactionType).toBe('ORDER_CANCEL');
    }
  });

  it('6. Correctly filters REROUTE transactions', async () => {
    const res = await getLedgerAction({
      type: 'REROUTE',
      search: testUserEmail,
      period: 'all',
    });

    expect('items' in res).toBe(true);
    if ('items' in res) {
      expect(res.items.length).toBe(1);
      expect(res.items[0].transactionType).toBe('REROUTE');
    }
  });

  it('7. Operator transaction action successfully filters Top-ups and Reroutes', async () => {
    const resTopup = await getTransactionsListAction({
      type: 'TOPUP',
      userId: testUserId,
      period: 'all',
    });

    expect('items' in resTopup).toBe(true);
    if ('items' in resTopup) {
      expect(resTopup.items.length).toBeGreaterThanOrEqual(1);
      for (const item of resTopup.items) {
        expect(item.amount).toBeGreaterThan(0);
      }
    }

    const resReroute = await getTransactionsListAction({
      type: 'REROUTE',
      userId: testUserId,
      period: 'all',
    });

    expect('items' in resReroute).toBe(true);
    if ('items' in resReroute) {
      expect(resReroute.items.length).toBe(1);
      expect(resReroute.items[0].transactionType).toBe('REROUTE');
    }
  });

  it('8. Seamlessly searches and finds ledger entry by gatewayId (YooKassa UUID) in getLedgerAction and populates gatewayId on DTO', async () => {
    const paymentGatewayId = `322c4a98-000f-5000-b000-${Math.random().toString(36).slice(2, 12)}`;
    const payment = await db.payment.create({
      data: {
        userId: testUserId,
        amount: BigInt(50000),
        status: 'SUCCEEDED',
        gatewayId: paymentGatewayId,
        gateway: 'yookassa',
        tenantId: 'smmplan',
      }
    });

    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        userId: testUserId,
        amount: BigInt(50000),
        reason: 'Пополнение баланса через yookassa',
        transactionType: 'TOPUP',
        status: 'APPROVED',
        tenantId: 'smmplan',
        idempotencyKey: `deposit-${payment.id}`,
      }
    });

    const res = await getLedgerAction({
      search: paymentGatewayId,
      period: 'all',
    });

    expect('items' in res).toBe(true);
    if ('items' in res) {
      expect(res.items.length).toBeGreaterThanOrEqual(1);
      const matched = res.items.find(i => i.id === ledgerEntry.id);
      expect(matched).toBeDefined();
      expect(matched?.gatewayId).toBe(paymentGatewayId);
      expect(matched?.idempotencyKey).toBe(`deposit-${payment.id}`);
    }
  });

  it('9. Seamlessly searches and finds transaction by gatewayId in operator getTransactionsListAction', async () => {
    const paymentGatewayId = `322b424e-000f-5001-9000-${Math.random().toString(36).slice(2, 12)}`;
    const payment = await db.payment.create({
      data: {
        userId: testUserId,
        amount: BigInt(35000),
        status: 'SUCCEEDED',
        gatewayId: paymentGatewayId,
        gateway: 'yookassa',
        tenantId: 'smmplan',
      }
    });

    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        userId: testUserId,
        amount: BigInt(35000),
        reason: 'Оплата заказа через шлюз',
        transactionType: 'TOPUP',
        status: 'APPROVED',
        tenantId: 'smmplan',
        idempotencyKey: `gateway-credit-${payment.id}`,
      }
    });

    const res = await getTransactionsListAction({
      search: paymentGatewayId,
      period: 'all',
    });

    expect('items' in res).toBe(true);
    if ('items' in res) {
      expect(res.items.length).toBeGreaterThanOrEqual(1);
      const matched = res.items.find(i => i.id === ledgerEntry.id);
      expect(matched).toBeDefined();
      expect(matched?.gatewayId).toBe(paymentGatewayId);
    }
  });
});
