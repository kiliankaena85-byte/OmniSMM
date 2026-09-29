/**
 * payment-issue-invariants.test.ts
 * Юнит-тесты на инварианты самообслуживания при проблемах с оплатой (reportPaymentIssueAction).
 * 
 * Проверяет:
 * 1. Идемпотентная дедупликация: повторные вызовы возвращают существующий тикет без дублирования в БД.
 * 2. ExactMath форматирование: сумма передается в рублях без утечек IEEE-754.
 * 3. Быстрое разрешение: если статус SUCCEEDED, не создается тикет.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportPaymentIssueAction } from '@/actions/customer/payment-issue';
import { db } from '@/lib/db';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { ticketService } from '@/services/support/ticket.service';

vi.mock('@/lib/db', () => ({
  db: {
    payment: {
      findUnique: vi.fn(),
    },
    ticket: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/services/support/ticket.service', () => ({
  ticketService: {
    getOrCreateTicket: vi.fn(),
    addMessage: vi.fn(),
  },
}));

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: 'user-123' }),
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    checkCustomKey: vi.fn().mockResolvedValue(true),
  },
}));

describe('Customer Payment Issue Invariants (reportPaymentIssueAction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Should return resolvedNow without creating ticket if payment is already SUCCEEDED', async () => {
    vi.mocked(db.payment.findUnique).mockResolvedValueOnce({
      id: 'pay-success-1',
      userId: 'user-123',
      status: 'SUCCEEDED',
      amount: 15000n,
      gateway: 'yookassa',
      gatewayId: 'yoo-1',
      tenantId: 'smmplan',
      orders: [],
    } as any);

    const result = await reportPaymentIssueAction('pay-success-1');

    expect(result.success).toBe(true);
    expect(result.resolvedNow).toBe(true);
    expect(db.ticket.create).not.toHaveBeenCalled();
  });

  it('2. Should deduplicate and return existing ticket if open ticket already exists for payment', async () => {
    vi.mocked(db.payment.findUnique).mockResolvedValueOnce({
      id: 'pay-pending-1',
      userId: 'user-123',
      status: 'PENDING',
      amount: 25000n, // 250.00 RUB
      gateway: 'yookassa',
      gatewayId: null,
      tenantId: 'smmplan',
      orders: [],
    } as any);

    vi.mocked(db.ticket.findFirst).mockResolvedValueOnce({
      id: 'ticket-existing-999',
    } as any);

    const result = await reportPaymentIssueAction('pay-pending-1');

    expect(result.success).toBe(true);
    expect(result.ticketId).toBe('ticket-existing-999');
    expect(result.message).toContain('уже находится в обработке');
    // Invariant: no duplicate ticket created!
    expect(db.ticket.create).not.toHaveBeenCalled();
  });

  it('3. Should reuse active OmniChat thread and append internal system card with ExactMath rubles format', async () => {
    vi.mocked(db.payment.findUnique).mockResolvedValueOnce({
      id: 'pay-new-1',
      userId: 'user-123',
      status: 'PENDING',
      amount: 49999n, // 499.99 RUB
      gateway: 'cryptobot',
      gatewayId: 'inv-123',
      tenantId: 'smmplan',
      orders: [],
    } as any);

    vi.mocked(db.ticket.findFirst).mockResolvedValueOnce(null);
    vi.mocked(ticketService.getOrCreateTicket).mockResolvedValueOnce({
      id: 'ticket-unified-777',
      tags: [],
    } as any);
    vi.mocked(db.ticket.update).mockResolvedValueOnce({
      id: 'ticket-unified-777',
    } as any);
    vi.mocked(ticketService.addMessage).mockResolvedValueOnce({
      id: 'msg-sys-1',
    } as any);

    const result = await reportPaymentIssueAction('pay-new-1');

    expect(result.success).toBe(true);
    expect(result.ticketId).toBe('ticket-unified-777');
    expect(result.message).toContain('едином чате с поддержкой');
    // OmniChat invariant: Uses getOrCreateTicket, never splits customer into multiple tickets
    expect(ticketService.getOrCreateTicket).toHaveBeenCalledWith(
      'user-123',
      'Чат с поддержкой',
      'WEB',
      'smmplan'
    );
    expect(ticketService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket-unified-777',
        sender: 'INTERNAL',
        text: expect.stringContaining('499.99 ₽'), // ExactMath verification
      })
    );
    expect(db.ticket.create).not.toHaveBeenCalled();
  });

  it('4. Should enforce rate-limiting when caller spams requests', async () => {
    vi.mocked(RateLimitService.checkCustomKey).mockResolvedValueOnce(false);

    const result = await reportPaymentIssueAction('pay-spam-1');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Слишком частые запросы');
    expect(db.payment.findUnique).not.toHaveBeenCalled();
  });
});
