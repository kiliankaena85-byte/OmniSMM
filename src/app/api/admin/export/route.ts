export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { analyticsService } from '@/services/admin/analytics.service';
import { enforceSectionAccess } from '@/lib/server/rbac';

// SD-06 SECURITY FIX: Restrict export to OWNER/ADMIN only.
// Export contains providerCost (margin data), client bases, and user financial profiles — commercially sensitive.
// SUPPORT is strictly prohibited from bulk exporting data to prevent data exfiltration.
const STAFF_ROLES = ['OWNER', 'ADMIN'];

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const headerLine = headers.map(escape).join(';');
  const dataLines = rows.map(row => row.map(escape).join(';'));
  // UTF-8 BOM (\uFEFF) ensures Excel correctly displays Cyrillic characters
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
}

function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function getPeriodStartDate(period: string | null): Date | undefined {
  if (!period || period === 'all') return undefined;
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  return undefined;
}

import { DataLossPreventionService } from '@/services/security/data-loss-prevention.service';
import { SecurityAlertService } from '@/services/security/security-alert.service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'orders';

  const section =
    type === 'users' ? 'clients' :
    ['ledger', 'payments', 'reconciliation', 'balance_adjustments'].includes(type) ? 'finance' :
    'orders';

  await enforceSectionAccess(section);
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !STAFF_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Cross-tenant breach sentinel: if non-OWNER attempts to query other tenant data
  const requestedTenant = searchParams.get('tenant') || searchParams.get('tenantId');
  if (user.role !== 'OWNER' && requestedTenant && requestedTenant !== 'all' && requestedTenant !== user.tenantId) {
    await SecurityAlertService.record({
      event: 'CROSS_TENANT_DATA_ACCESS_ATTEMPT',
      severity: 'HIGH',
      tenantId: user.tenantId || 'smmplan',
      details: {
        staffUserId: user.id,
        staffEmail: user.email,
        assignedTenant: user.tenantId,
        requestedTenant,
        endpoint: '/api/admin/export',
        type
      }
    });
    return NextResponse.json({ error: 'Forbidden: Access to other tenant data is denied' }, { status: 403 });
  }

  // DLP Sentinel: rate limit and detect bulk scraping
  const dlpAction = type === 'users' ? 'EXPORT_USERS' : 'EXPORT_ORDERS';
  const dlpCheck = await DataLossPreventionService.checkStaffDataAccess({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    action: dlpAction,
    recordCount: 1,
    tenantId: user.tenantId || 'smmplan',
  });

  if (!dlpCheck.allowed) {
    return NextResponse.json({ error: dlpCheck.error || 'Превышен лимит выгрузки данных' }, { status: 429 });
  }

  try {
    let csv = '';
    let filename = 'export.csv';

    // Multi-tenant isolation: non-OWNER staff are restricted strictly to their tenant
    const effectiveTenantId = user.role === 'OWNER'
      ? (requestedTenant && requestedTenant !== 'all' ? requestedTenant : undefined)
      : (user.tenantId ?? 'smmplan');

    const tenantFilter = effectiveTenantId ? { tenantId: effectiveTenantId } : {};
    const period = searchParams.get('period');
    const periodStart = getPeriodStartDate(period);

    switch (type) {
      case 'orders': {
        const status = searchParams.get('status');
        const where: Record<string, unknown> = {
          ...tenantFilter
        };
        if (status && status !== 'ALL') where.status = status;
        if (periodStart) where.createdAt = { gte: periodStart };

        const orders = await db.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 10000,
          include: {
            user: { select: { email: true } },
            service: { select: { name: true } },
          },
        });

        csv = toCsv(
          ['ID', 'Email', 'Услуга', 'Ссылка', 'Кол-во', 'Остаток', 'Стоимость ₽', 'Себестоимость ₽', 'Статус', 'Дата'],
          orders.map(o => [
            String(o.numericId),
            o.user.email,
            o.service.name,
            o.link,
            String(o.quantity),
            String(o.remains),
            (Number(o.charge) / 100).toFixed(2),
            (Number(o.providerCost) / 100).toFixed(2),
            o.status,
            formatDateRu(o.createdAt),
          ])
        );
        filename = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case 'users': {
        const search = searchParams.get('q')?.trim() || searchParams.get('search')?.trim();
        const filter = searchParams.get('filter');
        const rawSortBy = searchParams.get('sortBy');
        const rawSortOrder = searchParams.get('sortOrder');

        const where: Record<string, unknown> = {
          ...tenantFilter,
        };

        if (search) {
          where.OR = [
            { email: { contains: search, mode: 'insensitive' } },
            { id: { equals: search } },
            { telegramId: { contains: search, mode: 'insensitive' } },
            { companyName: { contains: search, mode: 'insensitive' } },
            { inn: { contains: search } },
          ];
        }

        if (filter === 'api') {
          where.OR = [
            { apiConfig: { isApiEnabled: true } },
            { inn: { not: null } },
            { companyName: { not: null } }
          ];
        } else if (filter === 'balance') {
          where.balance = { gt: BigInt(0) };
        } else if (filter === 'banned') {
          where.role = 'BANNED';
        } else if (filter === 'vip') {
          where.totalSpent = { gte: BigInt(25_000_00) };
        }

        const validSortFields = ['createdAt', 'balance', 'totalSpent', 'orders', 'email', 'role'];
        const sortBy = validSortFields.includes(rawSortBy || '') ? rawSortBy : 'createdAt';
        const sortOrder = rawSortOrder === 'asc' ? 'asc' : 'desc';

        let primaryOrderBy: Record<string, unknown>;
        if (sortBy === 'orders') {
          primaryOrderBy = { orders: { _count: sortOrder } };
        } else {
          primaryOrderBy = { [sortBy as string]: sortOrder };
        }

        const users = await db.user.findMany({
          where,
          orderBy: [primaryOrderBy, { id: 'desc' }],
          take: 10000,
          include: { _count: { select: { orders: true } } },
        });

        csv = toCsv(
          ['Email', 'Роль', 'Баланс ₽', 'LTV ₽', 'Заказов', 'Telegram ID', 'Регистрация'],
          users.map(u => [
            u.email,
            u.role,
            (Number(u.balance) / 100).toFixed(2),
            (Number(u.totalSpent) / 100).toFixed(2),
            String(u._count.orders),
            u.telegramId || '',
            formatDateRu(u.createdAt),
          ])
        );
        filename = `users_${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case 'profitability': {
        const stats = await analyticsService.getServiceProfitability(30);
        csv = toCsv(
          ['Услуга', 'Категория', 'Заказов', 'Выручка ₽', 'Себестоимость ₽', 'Прибыль ₽', 'Маржа %'],
          stats.map(s => [
            s.serviceName,
            s.categoryName,
            String(s.ordersCount),
            (s.revenue / 100).toFixed(2),
            (s.cogs / 100).toFixed(2),
            (s.profit / 100).toFixed(2),
            s.marginPct.toFixed(2),
          ])
        );
        filename = `profitability_${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case 'ledger': {
        const status = searchParams.get('status');
        const search = searchParams.get('search')?.trim();
        const where: Record<string, unknown> = {
          ...(effectiveTenantId ? { user: { tenantId: effectiveTenantId } } : {}),
          ...(status && status !== 'ALL' ? { status } : {}),
          ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
          ...(search ? {
            OR: [
              { user: { is: { email: { contains: search, mode: 'insensitive' as const } } } },
              { id: { contains: search, mode: 'insensitive' as const } },
              { idempotencyKey: { contains: search, mode: 'insensitive' as const } },
            ]
          } : {}),
        };

        const entries = await db.ledgerEntry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 10000,
          include: {
            user: { select: { email: true, tenantId: true } },
          },
        });

        csv = toCsv(
          ['ID Проводки', 'Email клиента', 'Бренд', 'Сумма ₽', 'Тип транзакции', 'Причина / Назначение', 'Оператор', 'Статус', 'Idempotency Key', 'Дата'],
          entries.map(e => [
            e.id,
            e.user.email,
            e.user.tenantId === 'smmplan' ? 'SMMplan' : 'SMMflux',
            (Number(e.amount) / 100).toFixed(2),
            e.transactionType || 'MANUAL',
            e.reason,
            e.adminId ? `Оператор (${e.adminId.slice(0, 6)})` : 'Система',
            e.status === 'APPROVED' ? 'Одобрено' : e.status === 'QUARANTINE' ? 'Карантин' : 'Отклонено',
            e.idempotencyKey || '',
            formatDateRu(e.createdAt),
          ])
        );
        filename = `ledger_${period || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case 'payments': {
        const status = searchParams.get('status');
        const search = searchParams.get('search')?.trim();
        const where: Record<string, unknown> = {
          ...tenantFilter,
          ...(status && status !== 'ALL' ? { status } : {}),
          ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
          ...(search ? {
            OR: [
              { user: { is: { email: { contains: search, mode: 'insensitive' as const } } } },
              { id: { contains: search, mode: 'insensitive' as const } },
              { gatewayId: { contains: search, mode: 'insensitive' as const } },
            ]
          } : {}),
        };

        const payments = await db.payment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 10000,
          include: {
            user: { select: { email: true } },
          },
        });

        const gatewayLabels: Record<string, string> = {
          yookassa: 'ЮKassa',
          cryptobot: 'CryptoBot',
          test: 'Тестовый',
        };

        const statusLabels: Record<string, string> = {
          SUCCEEDED: 'Успешно',
          PENDING: 'Ожидание',
          CANCELED: 'Отменено',
        };

        csv = toCsv(
          ['ID Платежа', 'ID в Шлюзе', 'Email клиента', 'Бренд', 'Сумма ₽', 'Валюта', 'Шлюз', 'Статус', 'IP клиента', 'User-Agent', 'Дата создания'],
          payments.map(p => [
            p.id,
            p.gatewayId || '',
            p.user?.email || 'Unknown',
            p.tenantId === 'smmplan' ? 'SMMplan' : 'SMMflux',
            (Number(p.amount) / 100).toFixed(2),
            p.currency,
            gatewayLabels[p.gateway] || p.gateway,
            statusLabels[p.status] || p.status,
            p.consentIp || '',
            p.consentUserAgent || '',
            formatDateRu(p.createdAt),
          ])
        );
        filename = `payments_${period || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case 'reconciliation': {
        const { LedgerReconciliationService } = await import('@/services/financial/ledger-reconciliation.service');
        const accounts = await LedgerReconciliationService.getAccounts({
          pageSize: 10000,
          tenantId: effectiveTenantId,
          onlyAnomalies: searchParams.get('onlyAnomalies') === 'true',
        });

        csv = toCsv(
          ['ID Пользователя', 'Email', 'Бренд', 'Баланс (User) ₽', 'Сумма Ledger ₽', 'Расхождение ₽', 'Проводок', 'Статус аккаунта', 'Статус инварианта'],
          accounts.items.map((a: {
            userId: string;
            email: string;
            tenantId: string;
            userBalance: number;
            ledgerSum: number;
            discrepancy: number;
            entriesCount: number;
            isActive: boolean;
            isDiscrepancy: boolean;
          }) => [
            a.userId,
            a.email,
            a.tenantId === 'smmplan' ? 'SMMplan' : 'SMMflux',
            (a.userBalance / 100).toFixed(2),
            (a.ledgerSum / 100).toFixed(2),
            (a.discrepancy / 100).toFixed(2),
            String(a.entriesCount),
            a.isActive ? 'Активен' : 'Заблокирован',
            a.isDiscrepancy ? 'РАСХОЖДЕНИЕ' : 'СОШЛОСЬ',
          ])
        );
        filename = `reconciliation_report_${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case 'balance_adjustments': {
        const status = searchParams.get('status');
        const direction = searchParams.get('direction');
        const where: Record<string, unknown> = {
          ...(effectiveTenantId ? { user: { tenantId: effectiveTenantId } } : {}),
          ...(status ? { status } : {}),
          ...(direction ? { direction } : {}),
          ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
        };

        const adjustments = await db.manualBalanceAdjustment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 5000,
          include: {
            user: { select: { email: true, tenantId: true } },
            requester: { select: { email: true } },
          },
        });

        csv = toCsv(
          ['ID Заявки', 'Email клиента', 'Бренд', 'Оператор', 'Тип (CREDIT/DEBIT)', 'Сумма ₽', 'Код причины', 'Тикет', 'Статус', 'Дата'],
          adjustments.map((a: {
            id: string;
            user: { email: string; tenantId: string };
            requester: { email: string };
            direction: string;
            amount: bigint;
            reasonCode: string;
            ticketId: string | null;
            status: string;
            createdAt: Date;
          }) => [
            a.id,
            a.user.email,
            a.user.tenantId === 'smmplan' ? 'SMMplan' : 'SMMflux',
            a.requester.email,
            a.direction,
            (Number(a.amount) / 100).toFixed(2),
            a.reasonCode,
            a.ticketId || '',
            a.status,
            formatDateRu(a.createdAt),
          ])
        );
        filename = `balance_adjustments_${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown export type: ${type}` }, { status: 400 });
    }

    const { auditAdmin } = await import('@/lib/admin-audit');
    auditAdmin({
      adminId: user.id,
      adminEmail: user.email,
      action: 'DATA_EXPORT',
      target: type,
      targetType: 'SYSTEM_SETTINGS',
      newValue: { type, filename, tenant: effectiveTenantId }
    });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[CSV Export] Error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

