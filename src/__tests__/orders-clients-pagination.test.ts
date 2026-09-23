/**
 * @file orders-clients-pagination.test.ts
 * @description Unit tests for Numbered Offset Pagination in Orders and Clients.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginatedQuery } from '@/lib/pagination';

describe('Numbered Offset Pagination for Orders and Clients', () => {
  const mockOrders = Array.from({ length: 125 }, (_, i) => ({
    id: `ord-${i + 1}`,
    numericId: 1000 + i,
    status: 'COMPLETED',
    charge: BigInt(5000),
    quantity: 100,
  }));

  const mockModel = {
    findMany: vi.fn().mockImplementation(async (opts: { skip?: number; take?: number }) => {
      const skip = opts?.skip || 0;
      const take = opts?.take || 50;
      return mockOrders.slice(skip, skip + take);
    }),
    count: vi.fn().mockResolvedValue(125),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates totalPages, currentPage, and sliced items correctly for page 1', async () => {
    const result = await paginatedQuery<typeof mockOrders[number]>(mockModel, { page: 1, pageSize: 50 });

    expect(result.totalCount).toBe(125);
    expect(result.totalPages).toBe(3);
    expect(result.currentPage).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.items.length).toBe(50);
    expect(result.items[0].id).toBe('ord-1');
    expect(result.hasMore).toBe(true);
  });

  it('calculates page 2 with exact offset skip of 50 items', async () => {
    const result = await paginatedQuery<typeof mockOrders[number]>(mockModel, { page: 2, pageSize: 50 });

    expect(result.totalCount).toBe(125);
    expect(result.totalPages).toBe(3);
    expect(result.currentPage).toBe(2);
    expect(result.items.length).toBe(50);
    expect(result.items[0].id).toBe('ord-51');
    expect(result.hasMore).toBe(true);
    expect(mockModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 50,
      })
    );
  });

  it('calculates final page 3 with remainder items and hasMore=false', async () => {
    const result = await paginatedQuery<typeof mockOrders[number]>(mockModel, { page: 3, pageSize: 50 });

    expect(result.totalCount).toBe(125);
    expect(result.totalPages).toBe(3);
    expect(result.currentPage).toBe(3);
    expect(result.items.length).toBe(25);
    expect(result.items[0].id).toBe('ord-101');
    expect(result.hasMore).toBe(false);
  });

  it('handles pageSize customization (e.g. 20 items per page -> 7 pages)', async () => {
    const result = await paginatedQuery(mockModel, { page: 1, pageSize: 20 });

    expect(result.totalCount).toBe(125);
    expect(result.totalPages).toBe(7);
    expect(result.currentPage).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.items.length).toBe(20);
  });
});
