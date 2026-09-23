/**
 * @file catalog-pagination-offset.test.ts
 * @description Unit tests for offset-based pagination engine, page boundaries and calculations.
 */

import { describe, it, expect, vi } from 'vitest';
import { paginatedQuery } from '@/lib/pagination';

describe('Catalog Offset Pagination Engine', () => {
  it('calculates totalPages, currentPage, and slice correctly for page 1', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ]);
    const mockCount = vi.fn().mockResolvedValue(105);

    const model = { findMany: mockFindMany, count: mockCount };
    const res = await paginatedQuery(model as never, {
      page: 1,
      pageSize: 50,
    });

    expect(mockFindMany).toHaveBeenCalledWith({
      take: 50,
      skip: 0,
      where: {},
      orderBy: { id: 'desc' },
    });
    expect(res.currentPage).toBe(1);
    expect(res.pageSize).toBe(50);
    expect(res.totalCount).toBe(105);
    expect(res.totalPages).toBe(3); // ceil(105 / 50) = 3
    expect(res.hasMore).toBe(true);
    expect(res.items.length).toBe(2);
  });

  it('calculates correct skip for page 3 with pageSize 20', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockCount = vi.fn().mockResolvedValue(100);

    const model = { findMany: mockFindMany, count: mockCount };
    const res = await paginatedQuery(model as never, {
      page: 3,
      pageSize: 20,
    });

    expect(mockFindMany).toHaveBeenCalledWith({
      take: 20,
      skip: 40, // (3 - 1) * 20 = 40
      where: {},
      orderBy: { id: 'desc' },
    });
    expect(res.currentPage).toBe(3);
    expect(res.totalPages).toBe(5);
    expect(res.hasMore).toBe(true);
  });

  it('handles last page: hasMore is false', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockCount = vi.fn().mockResolvedValue(60);

    const model = { findMany: mockFindMany, count: mockCount };
    const res = await paginatedQuery(model as never, {
      page: 3,
      pageSize: 20,
    });

    expect(res.currentPage).toBe(3);
    expect(res.totalPages).toBe(3);
    expect(res.hasMore).toBe(false);
  });

  it('handles empty database: totalPages is 1, totalCount is 0, hasMore is false', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockCount = vi.fn().mockResolvedValue(0);

    const model = { findMany: mockFindMany, count: mockCount };
    const res = await paginatedQuery(model as never, {
      page: 1,
      pageSize: 50,
    });

    expect(res.totalCount).toBe(0);
    expect(res.totalPages).toBe(1);
    expect(res.hasMore).toBe(false);
    expect(res.items).toEqual([]);
  });

  it('clamps page < 1 to page 1', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockCount = vi.fn().mockResolvedValue(50);

    const model = { findMany: mockFindMany, count: mockCount };
    const res = await paginatedQuery(model as never, {
      page: -5,
      pageSize: 50,
    });

    expect(mockFindMany).toHaveBeenCalledWith({
      take: 50,
      skip: 0,
      where: {},
      orderBy: { id: 'desc' },
    });
    expect(res.currentPage).toBe(1);
  });

  it('passes through where, include and custom orderBy conditions in offset mode', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockCount = vi.fn().mockResolvedValue(10);

    const model = { findMany: mockFindMany, count: mockCount };
    const where = { tenantId: 'smmplan', isActive: true };
    const orderBy = { numericId: 'asc' as const };
    const include = { category: true };

    await paginatedQuery(model as never, {
      page: 2,
      pageSize: 10,
      where,
      orderBy,
      include,
    });

    expect(mockFindMany).toHaveBeenCalledWith({
      take: 10,
      skip: 10,
      where,
      orderBy,
      include,
    });
    expect(mockCount).toHaveBeenCalledWith({ where });
  });

  it('retains backward compatibility for cursor mode when cursor is provided', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([
      { id: 'c1', name: 'Item 1' },
      { id: 'c2', name: 'Item 2' },
      { id: 'c3', name: 'Item 3' }, // +1 for hasNextPage
    ]);
    const mockCount = vi.fn().mockResolvedValue(100);

    const model = { findMany: mockFindMany, count: mockCount };
    const res = await paginatedQuery(model as never, {
      cursor: 'c0',
      pageSize: 2,
    });

    expect(mockFindMany).toHaveBeenCalledWith({
      take: 3, // pageSize + 1
      skip: 1,
      cursor: { id: 'c0' },
      where: {},
      orderBy: { id: 'desc' },
    });
    expect(res.items.length).toBe(2);
    expect(res.hasMore).toBe(true);
    expect(res.nextCursor).toBe('c2');
  });
});
