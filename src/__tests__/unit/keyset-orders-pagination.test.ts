import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCustomerOrdersKeyset,
  buildKeysetFilter,
} from '@/services/orders/keyset-pagination.service';
import { db } from '@/lib/db';

describe('Keyset Orders Pagination Service (TDD)', () => {
  const userId = 'user-1';
  const tenantId = 'smmplan';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should build initial query without cursor starting from newest orders', () => {
    const filter = buildKeysetFilter({
      direction: 'forward',
      referenceOrder: null,
    });

    expect(filter.whereClause).toEqual({});
    expect(filter.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('should build forward keyset filter using reference order timestamp and id', () => {
    const refDate = new Date('2026-09-20T12:00:00Z');
    const filter = buildKeysetFilter({
      direction: 'forward',
      referenceOrder: { id: 'order-10', createdAt: refDate },
    });

    expect(filter.whereClause).toEqual({
      OR: [
        { createdAt: { lt: refDate } },
        { createdAt: refDate, id: { lt: 'order-10' } },
      ],
    });
    expect(filter.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('should build backward keyset filter correctly', () => {
    const refDate = new Date('2026-09-20T12:00:00Z');
    const filter = buildKeysetFilter({
      direction: 'backward',
      referenceOrder: { id: 'order-10', createdAt: refDate },
    });

    expect(filter.whereClause).toEqual({
      OR: [
        { createdAt: { gt: refDate } },
        { createdAt: refDate, id: { gt: 'order-10' } },
      ],
    });
    expect(filter.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
  });

  it('should prevent IDOR when cursor belongs to another user or tenant (Fail-Closed)', async () => {
    // When cursor order is not found for this (userId, tenantId), it must return null reference
    const findFirstSpy = vi.spyOn(db.order, 'findFirst').mockResolvedValue(null as any);

    const result = await fetchCustomerOrdersKeyset({
      userId: 'user-1',
      tenantId: 'smmplan',
      cursor: 'foreign-cursor-id',
      direction: 'forward',
      limit: 15,
    });

    // Should verify that the cursor lookup was strictly scoped to userId AND tenantId
    expect(findFirstSpy).toHaveBeenCalledWith({
      where: {
        id: 'foreign-cursor-id',
        userId: 'user-1',
        tenantId: 'smmplan',
      },
      select: { id: true, createdAt: true },
    });

    // When reference order is not found, it must gracefully fallback to initial page
    expect(result.items).toBeDefined();
  });
});
