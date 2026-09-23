/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Safe Pagination & Out-Of-Memory (OOM) Protection Helper.
 */

export const MAX_SAFE_TAKE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  take?: number;
  skip?: number;
  cursor?: string;
}

export interface SafePaginationResult {
  take: number;
  skip: number;
  cursor?: { id: string };
}

export class SafePagination {
  /**
   * Sanitizes pagination parameters, clamping take to MAX_SAFE_TAKE (100) to prevent OOM.
   */
  static sanitize(params?: PaginationParams): SafePaginationResult {
    const rawTake = params?.take ?? params?.pageSize ?? DEFAULT_PAGE_SIZE;
    const safeTake = Math.min(Math.max(1, Math.floor(rawTake)), MAX_SAFE_TAKE);

    let safeSkip = 0;
    if (params?.skip !== undefined) {
      safeSkip = Math.max(0, Math.floor(params.skip));
    } else if (params?.page !== undefined) {
      const safePage = Math.max(1, Math.floor(params.page));
      safeSkip = (safePage - 1) * safeTake;
    }

    const result: SafePaginationResult = {
      take: safeTake,
      skip: safeSkip,
    };

    if (params?.cursor) {
      result.cursor = { id: params.cursor };
      // When cursor is used, skip is typically 1 (to bypass the cursor item itself)
      if (params.skip === undefined) {
        result.skip = 1;
      }
    }

    return result;
  }
}
