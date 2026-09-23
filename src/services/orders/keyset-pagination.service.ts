/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Keyset Cursor-Based Orders Pagination Service (RAC-2026 / SDD-TDD 2026)
 *
 * Replaces high-offset O(N) database scans with constant time O(1) B-Tree cursor lookups.
 * Features:
 * 1. Anti-IDOR Fail-Closed Guard: Reference cursor lookup is strictly scoped to { userId, tenantId }.
 * 2. Compound Sorting: Guaranteed deterministic ordering over (createdAt DESC, id DESC).
 * 3. Bidirectional: Supports forward and backward traversal.
 */

import { db } from '@/lib/db';
import { Prisma, OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const KeysetCursorSchema = z.object({
  cursor: z.string().optional().nullable(),
  direction: z.enum(['forward', 'backward']).default('forward'),
  limit: z.number().int().min(1).max(100).default(15),
  status: z.string().optional(),
  network: z.string().optional(),
  search: z.string().max(256).optional(),
});

export interface ReferenceOrder {
  id: string;
  createdAt: Date;
}

export interface KeysetFilterParams {
  direction: 'forward' | 'backward';
  referenceOrder: ReferenceOrder | null;
}

export interface KeysetFilterResult {
  whereClause: Prisma.OrderWhereInput;
  orderBy: Prisma.OrderOrderByWithRelationInput[];
}

/**
 * Builds deterministic Prisma where and orderBy clauses for keyset pagination.
 */
export function buildKeysetFilter(params: KeysetFilterParams): KeysetFilterResult {
  const { direction, referenceOrder } = params;

  if (!referenceOrder) {
    return {
      whereClause: {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    };
  }

  if (direction === 'forward') {
    return {
      whereClause: {
        OR: [
          { createdAt: { lt: referenceOrder.createdAt } },
          {
            createdAt: referenceOrder.createdAt,
            id: { lt: referenceOrder.id },
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    };
  }

  // Backward direction
  return {
    whereClause: {
      OR: [
        { createdAt: { gt: referenceOrder.createdAt } },
        {
          createdAt: referenceOrder.createdAt,
          id: { gt: referenceOrder.id },
        },
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  };
}

export interface FetchOrdersKeysetOptions {
  userId: string;
  tenantId: string;
  cursor?: string | null;
  direction?: 'forward' | 'backward';
  limit?: number;
  status?: string;
  network?: string;
  search?: string;
}

export interface KeysetOrdersResult<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
}

/**
 * Fetches customer orders using Keyset pagination with Anti-IDOR guard.
 */
export async function fetchCustomerOrdersKeyset(options: FetchOrdersKeysetOptions) {
  const {
    userId,
    tenantId,
    cursor,
    direction = 'forward',
    limit = 15,
    status,
    network,
    search,
  } = options;

  // 1. Anti-IDOR Reference Cursor Lookup (Fail-Closed)
  let referenceOrder: ReferenceOrder | null = null;
  if (cursor) {
    referenceOrder = await db.order.findFirst({
      where: {
        id: cursor,
        userId,
        tenantId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  // 2. Build Base Where Clauses
  const baseWhere: Prisma.OrderWhereInput = {
    userId,
    tenantId,
  };

  if (status && status !== 'ALL') {
    baseWhere.status = status as OrderStatus;
  }

  if (network && network !== 'ALL') {
    baseWhere.service = {
      category: {
        network: {
          slug: network,
        },
      },
    };
  }

  if (search) {
    baseWhere.OR = [
      ...(isNaN(Number(search)) ? [] : [{ numericId: parseInt(search, 10) }]),
      {
        service: {
          name: {
            contains: search,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        link: {
          contains: search,
          mode: 'insensitive' as const,
        },
      },
    ];
  }

  // 3. Combine with Keyset filter
  const { whereClause: keysetWhere, orderBy } = buildKeysetFilter({
    direction,
    referenceOrder,
  });

  const finalWhere: Prisma.OrderWhereInput = {
    AND: [
      baseWhere,
      ...(Object.keys(keysetWhere).length > 0 ? [keysetWhere] : []),
    ],
  };

  // 4. Fetch take: limit + 1 to detect hasMore in O(1)
  const rows = await db.order.findMany({
    where: finalWhere,
    orderBy,
    take: limit + 1,
    select: {
      id: true,
      numericId: true,
      status: true,
      charge: true,
      discountCents: true,
      usdToRubRate: true,
      quantity: true,
      remains: true,
      link: true,
      error: true,
      createdAt: true,
      isDripFeed: true,
      runs: true,
      interval: true,
      currentRun: true,
      nextRunAt: true,
      refills: {
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      service: {
        select: {
          id: true,
          numericId: true,
          categoryId: true,
          name: true,
          isRefillEnabled: true,
          category: {
            select: {
              name: true,
              network: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const hasMore = rows.length > limit;
  let items = hasMore ? rows.slice(0, limit) : rows;

  // If navigating backward, reverse items back to chronological DESC display
  if (direction === 'backward') {
    items = items.reverse();
  }

  const nextCursor = items.length > 0 && hasMore ? items[items.length - 1].id : null;
  const prevCursor = items.length > 0 && (cursor || direction === 'backward') ? items[0].id : null;

  return {
    items,
    nextCursor,
    prevCursor,
    hasMore,
  };
}
