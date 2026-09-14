import { getLedgerAction } from '@/actions/admin/finance/ledger';
import { TransactionsClient } from './transactions-client';
import { ArrowLeftRight, CreditCard } from 'lucide-react';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';
import { notFound, redirect } from 'next/navigation';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { FINANCE_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    period?: string;
    type?: string;
    status?: string;
    search?: string;
    minAmount?: string;
    maxAmount?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
    pageSize?: string;
    tenant?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: Props) {
  const session = await verifySession();
  if (!session) redirect('/login');

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { staffRole: { include: { permissions: true } } }
  });

  const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'];
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    redirect('/dashboard/new-order');
  }

  const params = await searchParams;
  const period = params.period || 'month';
  const page = parseInt(params.page || '1', 10) || 1;
  const pageSize = parseInt(params.pageSize || '50', 10) || 50;
  const activeTenantId = resolveAdminTenantContext(user, params.tenant);

  const initialLedger = await getLedgerAction({
    period: period as any,
    type: (params.type as any) || 'ALL',
    status: (params.status as any) || 'ALL',
    search: params.search,
    minAmount: params.minAmount ? parseFloat(params.minAmount) : undefined,
    maxAmount: params.maxAmount ? parseFloat(params.maxAmount) : undefined,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page,
    pageSize,
    tenantId: activeTenantId,
  });

  if ('error' in initialLedger) {
    return (
      <div className="p-8 text-center bg-card rounded-2xl border border-border">
        <p className="text-sm font-bold text-destructive">Ошибка загрузки транзакций: {initialLedger.error}</p>
      </div>
    );
  }

  const canExport = ['OWNER', 'ADMIN'].includes(user.role);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      <AdminTabbedHeader
        icon={ArrowLeftRight}
        title="Транзакции платформы (Ledger)"
        description="Сквозной реестр финансовых операций, пополнений, оплат заказов и возвратов по всем клиентам"
        tabs={FINANCE_TABS}
        onboardingKey="finance"
        onboarding={ONBOARDING_CONFIGS.finance}
      />

      <TransactionsClient
        initial={initialLedger}
        initialPeriod={period}
        tenantId={activeTenantId}
        canExport={canExport}
      />
    </div>
  );
}
