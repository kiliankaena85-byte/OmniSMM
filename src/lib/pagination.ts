export interface PaginationParams {
  cursor?: string;
  page?: number;
  pageSize?: number;
  where?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Array<Record<string, unknown>>;
  include?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export async function paginatedQuery<T>(
  model: {
    findMany: (...args: never[]) => unknown;
    count: (...args: never[]) => unknown;
  },
  params: PaginationParams
): Promise<PaginatedResult<T>> {
  const { cursor, page, pageSize = 50, where = {}, orderBy = { id: 'desc' }, include } = params;

  // Offset-based pagination when page is explicitly provided or cursor is not used
  if (page !== undefined && !cursor) {
    const currentPage = Math.max(1, page);
    const queryOptions: Record<string, unknown> = {
      take: pageSize,
      skip: (currentPage - 1) * pageSize,
      where,
      orderBy,
    };

    if (include) {
      queryOptions.include = include;
    }

    const [items, totalCount] = await Promise.all([
      (model.findMany as (opts: unknown) => Promise<T[]>)(queryOptions),
      (model.count as (opts: unknown) => Promise<number>)({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const hasMore = currentPage < totalPages;

    return {
      items,
      totalCount,
      totalPages,
      currentPage,
      pageSize,
      hasMore,
    };
  }

  // Cursor-based fallback for infinite scroll endpoints
  const take = pageSize + 1;

  const queryOptions: Record<string, unknown> = {
    take,
    where,
    orderBy,
  };

  if (cursor) {
    queryOptions.cursor = { id: cursor };
    queryOptions.skip = 1;
  }

  if (include) {
    queryOptions.include = include;
  }

  const [items, totalCount] = await Promise.all([
    (model.findMany as (opts: unknown) => Promise<T[]>)(queryOptions),
    (model.count as (opts: unknown) => Promise<number>)({ where }),
  ]);

  const hasNextPage = items.length > pageSize;
  const paginatedItems = hasNextPage ? items.slice(0, pageSize) : items;
  const nextCursor = hasNextPage && paginatedItems.length > 0
    ? (paginatedItems[paginatedItems.length - 1] as unknown as { id: string })?.id
    : undefined;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    items: paginatedItems,
    nextCursor,
    hasMore: hasNextPage,
    totalCount,
    totalPages,
    currentPage: 1,
    pageSize,
  };
}
