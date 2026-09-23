import { Prisma } from '@prisma/client';
import { OrderSearchParams, ACTIVITY_TYPE_KEYWORDS } from './types';

export function buildOrderWhereClause(params: OrderSearchParams): Prisma.OrderWhereInput {
  const {
    query,
    status,
    userId,
    clientEmail,
    orderId,
    externalId,
    serviceName,
    networkSlug,
    link,
    minPrice,
    maxPrice,
    minQuantity,
    maxQuantity,
  } = params;

  const andConditions: Prisma.OrderWhereInput[] = [];
  const where: Prisma.OrderWhereInput = {};

  if (userId && userId.trim()) where.userId = userId.trim();
  if (params.tenantId && params.tenantId !== 'all') where.tenantId = params.tenantId;

  if (status && status !== 'ALL') {
    if (status === 'ACTIVE') where.status = { in: ['PENDING', 'IN_PROGRESS'] };
    else if (status === 'PROBLEMATIC') where.status = { in: ['ERROR', 'CANCELED', 'PARTIAL'] };
    else if (status === 'COMPLETED_ALL') where.status = { in: ['COMPLETED', 'PARTIAL'] };
    else where.status = status as import('@prisma/client').OrderStatus;
  }

  if (clientEmail && clientEmail.trim()) {
    where.user = { email: { contains: clientEmail.trim(), mode: 'insensitive' } };
  }

  if (orderId !== undefined && !isNaN(orderId)) where.numericId = orderId;
  if (externalId && externalId.trim()) {
    where.externalId = { contains: externalId.trim(), mode: 'insensitive' };
  }

  if (serviceName && serviceName.trim()) {
    const tokens = serviceName.trim().split(/\s+/).filter(Boolean);
    tokens.forEach((token) => {
      if (token.startsWith('-') && token.length > 1) {
        andConditions.push({ service: { name: { not: { contains: token.substring(1) } } } });
      } else {
        andConditions.push({ service: { name: { contains: token, mode: 'insensitive' } } });
      }
    });
  }

  if (networkSlug && networkSlug !== 'ALL') {
    andConditions.push({ service: { category: { network: { slug: networkSlug } } } });
  }

  if (params.activityType && params.activityType !== 'ALL') {
    if (ACTIVITY_TYPE_KEYWORDS[params.activityType]) {
      const kws = ACTIVITY_TYPE_KEYWORDS[params.activityType];
      andConditions.push({
        OR: [
          ...kws.map((kw) => ({ service: { name: { contains: kw, mode: 'insensitive' as Prisma.QueryMode } } })),
          ...kws.map((kw) => ({ service: { category: { name: { contains: kw, mode: 'insensitive' as Prisma.QueryMode } } } })),
        ],
      });
    } else {
      andConditions.push({ service: { category: { slug: params.activityType } } });
    }
  }

  if (link && link.trim()) where.link = { contains: link.trim(), mode: 'insensitive' };

  if (minPrice !== undefined || maxPrice !== undefined) {
    const chargeFilters: Record<string, number> = {};
    if (minPrice !== undefined && !isNaN(minPrice)) chargeFilters.gte = Math.round(minPrice * 100);
    if (maxPrice !== undefined && !isNaN(maxPrice)) chargeFilters.lte = Math.round(maxPrice * 100);
    where.charge = chargeFilters;
  }

  if (minQuantity !== undefined || maxQuantity !== undefined) {
    const qtyFilters: Record<string, number> = {};
    if (minQuantity !== undefined && !isNaN(minQuantity)) qtyFilters.gte = minQuantity;
    if (maxQuantity !== undefined && !isNaN(maxQuantity)) qtyFilters.lte = maxQuantity;
    where.quantity = qtyFilters;
  }

  if (params.isDripFeed !== undefined) where.isDripFeed = params.isDripFeed;
  if (params.hasError) where.error = { not: null };

  // Error Category Grouping
  if (params.errorCategory && params.errorCategory !== 'ALL') {
    if (params.errorCategory === 'BALANCE') {
      andConditions.push({
        OR: [
          { error: { contains: 'balance', mode: 'insensitive' } },
          { error: { contains: 'funds', mode: 'insensitive' } },
          { error: { contains: 'средств', mode: 'insensitive' } },
          { error: { contains: 'денег', mode: 'insensitive' } },
        ],
      });
    } else if (params.errorCategory === 'LINK') {
      andConditions.push({
        OR: [
          { error: { contains: 'link', mode: 'insensitive' } },
          { error: { contains: 'url', mode: 'insensitive' } },
          { error: { contains: 'private', mode: 'insensitive' } },
          { error: { contains: 'ссылк', mode: 'insensitive' } },
          { error: { contains: 'закрыт', mode: 'insensitive' } },
          { error: { contains: '404', mode: 'insensitive' } },
        ],
      });
    } else if (params.errorCategory === 'SERVICE') {
      andConditions.push({
        AND: [
          { error: { not: null } },
          { NOT: { error: { contains: 'balance', mode: 'insensitive' } } },
          { NOT: { error: { contains: 'funds', mode: 'insensitive' } } },
          { NOT: { error: { contains: 'средств', mode: 'insensitive' } } },
          { NOT: { error: { contains: 'link', mode: 'insensitive' } } },
          { NOT: { error: { contains: 'ссылк', mode: 'insensitive' } } },
        ],
      });
    }
  }

  // Environment Mode Filtering
  if (params.environmentMode && params.environmentMode !== 'ALL') {
    applyEnvironmentFilter(params.environmentMode, andConditions);
  }

  if (params.noProvider) where.providerId = null;
  else if (params.providerId && params.providerId !== 'ALL') where.providerId = params.providerId;

  if (params.staleMinutes) {
    where.createdAt = { lte: new Date(Date.now() - params.staleMinutes * 60 * 1000) };
    where.status = { in: ['PENDING', 'IN_PROGRESS'] };
  }

  // Date Filtering & Presets
  applyDateFilter(params, where);

  // Omni-Search Parser
  if (query && query.trim()) {
    applyOmniSearchFilter(query.trim(), where);
  }

  if (andConditions.length > 0) where.AND = andConditions;
  return where;
}

function applyEnvironmentFilter(envMode: string, andConditions: Prisma.OrderWhereInput[]) {
  const mode = envMode.toUpperCase();
  if (mode === 'SANDBOX') {
    andConditions.push({
      OR: [
        { environmentMode: { in: ['SANDBOX', 'MOCK'] } },
        { isTest: true, environmentMode: { notIn: ['HYBRID', 'ACQUIRING_TEST'] } },
      ],
    });
  } else if (mode === 'HYBRID') {
    andConditions.push({ environmentMode: 'HYBRID' });
  } else if (mode === 'ACQUIRING_TEST') {
    andConditions.push({
      OR: [
        { environmentMode: 'ACQUIRING_TEST' },
        {
          AND: [
            { environmentMode: { notIn: ['SANDBOX', 'MOCK', 'HYBRID'] } },
            { isTest: false },
            {
              OR: [
                { payment: { gateway: { in: ['test', 'mock', 'sandbox'] } } },
                { payment: { gatewayId: { startsWith: 'mock_' } } },
                { payment: { gatewayId: { startsWith: 'test_' } } },
                { payment: { gatewayId: { startsWith: 'yoo_test_mock_' } } },
                { payment: { gatewayId: { startsWith: 'robo_test_mock_' } } },
                { payment: { gatewayId: { startsWith: 'crypto_test_mock_' } } },
              ],
            },
          ],
        },
      ],
    });
  } else if (mode === 'PRODUCTION') {
    andConditions.push({
      AND: [
        { environmentMode: 'PRODUCTION' },
        { isTest: false },
        {
          OR: [
            { payment: null },
            {
              AND: [
                { payment: { gateway: { notIn: ['test', 'mock', 'sandbox'] } } },
                { NOT: { payment: { gatewayId: { startsWith: 'mock_' } } } },
                { NOT: { payment: { gatewayId: { startsWith: 'test_' } } } },
                { NOT: { payment: { gatewayId: { startsWith: 'yoo_test_mock_' } } } },
                { NOT: { payment: { gatewayId: { startsWith: 'robo_test_mock_' } } } },
                { NOT: { payment: { gatewayId: { startsWith: 'crypto_test_mock_' } } } },
              ],
            },
          ],
        },
      ],
    });
  }
}

function applyDateFilter(params: OrderSearchParams, where: Prisma.OrderWhereInput) {
  let computedDateFrom: Date | undefined = params.dateFrom ? new Date(params.dateFrom) : undefined;
  let computedDateTo: Date | undefined = params.dateTo ? new Date(params.dateTo) : undefined;

  if (params.datePreset && params.datePreset !== 'ALL') {
    const now = new Date();
    if (params.datePreset === 'today') {
      computedDateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (params.datePreset === 'yesterday') {
      computedDateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      computedDateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    } else if (params.datePreset === '7d') {
      computedDateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (params.datePreset === '30d') {
      computedDateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (params.datePreset === 'this_month') {
      computedDateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (params.datePreset === 'last_month') {
      computedDateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      computedDateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }
  }

  if (computedDateFrom || computedDateTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (computedDateFrom && !isNaN(computedDateFrom.getTime())) dateFilter.gte = computedDateFrom;
    if (computedDateTo && !isNaN(computedDateTo.getTime())) dateFilter.lte = computedDateTo;
    where.createdAt = dateFilter;
  }
}

function applyOmniSearchFilter(q: string, where: Prisma.OrderWhereInput) {
  const numMatch = q.match(/^#?(\d+)$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    where.OR = [
      { numericId: num },
      { externalId: { equals: String(num) } },
    ];
  } else if (q.includes('@') && !q.includes('/') && !q.startsWith('@')) {
    where.user = { email: { contains: q, mode: 'insensitive' } };
  } else if (q.startsWith('cly') || q.startsWith('usr_') || q.length >= 24) {
    where.OR = [
      { id: q },
      { userId: q },
      { externalId: q },
      { paymentId: q },
    ];
  } else {
    const cleanSubstring = q.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/^@/, '');
    where.OR = [
      { externalId: { contains: q, mode: 'insensitive' } },
      { link: { contains: cleanSubstring, mode: 'insensitive' } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
      { paymentId: { contains: q, mode: 'insensitive' } },
      { service: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }
}
