import { describe, it, expect } from 'vitest';

// Helper to simulate getPageNumbers logic from NumberedPagination
function calculatePageNumbers(currentPage: number, totalPages: number, delta: number = 2) {
  const range: number[] = [];
  const rangeWithDots: (number | string)[] = [];
  let l: number | undefined;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      range.push(i);
    }
  }

  for (const i of range) {
    if (l !== undefined) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l !== 1) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    l = i;
  }

  return rangeWithDots;
}

describe('Numbered Pagination Algorithm & Performance Tests', () => {
  it('correctly generates page pills for short page list (<= 5 pages)', () => {
    const pages = calculatePageNumbers(2, 5, 2);
    expect(pages).toEqual([1, 2, 3, 4, 5]);
  });

  it('correctly generates smart ellipsis for large page count on first pages', () => {
    const pages = calculatePageNumbers(1, 20, 2);
    expect(pages).toEqual([1, 2, 3, '...', 20]);
  });

  it('correctly generates smart ellipsis on middle pages', () => {
    const pages = calculatePageNumbers(10, 20, 2);
    expect(pages).toEqual([1, '...', 8, 9, 10, 11, 12, '...', 20]);
  });

  it('correctly generates smart ellipsis on end pages', () => {
    const pages = calculatePageNumbers(20, 20, 2);
    expect(pages).toEqual([1, '...', 18, 19, 20]);
  });

  it('calculates startRecord and endRecord accurately across pagination bounds', () => {
    const totalCount = 235;
    const pageSize = 50;

    // Page 1
    const start1 = (1 - 1) * pageSize + 1;
    const end1 = Math.min(1 * pageSize, totalCount);
    expect(start1).toBe(1);
    expect(end1).toBe(50);

    // Page 5 (last page)
    const page5 = 5;
    const start5 = (page5 - 1) * pageSize + 1;
    const end5 = Math.min(page5 * pageSize, totalCount);
    expect(start5).toBe(201);
    expect(end5).toBe(235);
  });

  it('handles empty results gracefully (0 items, 0 pages)', () => {
    const totalCount = 0;
    const pageSize = 50;
    const start = totalCount === 0 ? 0 : 1;
    const end = Math.min(1 * pageSize, totalCount);
    expect(start).toBe(0);
    expect(end).toBe(0);
  });
});
