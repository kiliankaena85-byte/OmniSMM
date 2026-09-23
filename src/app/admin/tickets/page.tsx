import { adminTicketService } from '@/services/admin/ticket.service';
import { getTemplates } from '@/actions/support/template';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { UnifiedTicketsWorkspace } from './components/unified-workspace';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source?: string;
    isApiEnabled?: string;
    page?: string;
    ticketId?: string;
    tenant?: string;
  }>;
};

import { enforceSectionAccess } from '@/lib/server/rbac';
import { getMSKMidnightUTC } from '@/services/admin/escrow.service';

export default async function AdminTicketsPage({ searchParams }: Props) {
  await enforceSectionAccess('tickets');
  const params = await searchParams;
  const search = params.q || '';
  const statusFilter = params.status || 'ALL';
  const sourceFilter = params.source || 'ALL';
  const isApiEnabledFilter = params.isApiEnabled === 'true';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));
  const activeTicketId = params.ticketId || null;

  const session = await verifySession();
  const user = session ? await db.user.findUnique({
    where: { id: session.userId },
    include: { staffRole: { include: { permissions: true } } }
  }) : null;

  const isOwner = user?.role === 'OWNER';
  const effectiveTenant = resolveAdminTenantContext(user, params.tenant);
  const userAllowedTenants = isOwner
    ? undefined
    : (user?.allowedTenants && user.allowedTenants.length > 0 ? user.allowedTenants : [user?.tenantId || 'smmplan']);

  // 1. Fetch tickets matching current filter, tenant and page sizes
  const [ticketsResult, stats, templatesResult] = await Promise.all([
    adminTicketService.listTickets({
      search: search || undefined,
      status: statusFilter,
      source: sourceFilter,
      isApiEnabled: isApiEnabledFilter,
      pageSize: 20, // compact size for two-panel scrollbars
      page: currentPage,
      tenantId: effectiveTenant !== 'all' ? effectiveTenant : undefined,
      allowedTenants: userAllowedTenants,
    }),
    adminTicketService.getTicketStats(undefined, undefined, effectiveTenant !== 'all' ? effectiveTenant : undefined),
    getTemplates(),
  ]);

  // 2. Fetch full active ticket chat details if ticketId query parameter exists
  let activeTicket: Awaited<ReturnType<typeof adminTicketService.getTicketDetails>> | null = null;
  let supportLimitCents = 0;
  let supportSpentTodayCents = 0;

  if (activeTicketId) {
    activeTicket = await adminTicketService.getTicketDetails(
      activeTicketId,
      isOwner ? undefined : userAllowedTenants
    );
  }

  const canSeeRates = isOwner || (user?.role !== 'SUPPORT');

  if (session?.userId) {
    const admin = await db.user.findUnique({
      where: { id: session.userId },
      select: { supportLimitCents: true },
    });
    if (admin) {
      supportLimitCents = admin.supportLimitCents;
    }

    const todayStart = getMSKMidnightUTC();

    const ledgerCompensations = await db.ledgerEntry.findMany({
      where: {
        adminId: session.userId,
        createdAt: { gte: todayStart }
      },
      select: {
        amount: true
      }
    });

    const supportSpentTodayBigInt = ledgerCompensations.reduce((acc, entry) => {
      const amt = entry.amount < BigInt(0) ? -entry.amount : entry.amount;
      return acc + amt;
    }, BigInt(0));
    supportSpentTodayCents = Number(supportSpentTodayBigInt);
  }

  const templates = Array.isArray(templatesResult) ? templatesResult : [];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-background min-h-0 relative">
      <div className="flex-1 overflow-hidden relative h-full min-h-0">
        <UnifiedTicketsWorkspace 
          tickets={ticketsResult.items}
          totalPages={ticketsResult.totalPages}
          currentPage={currentPage}
          stats={stats}
          activeTicket={activeTicket}
          templates={templates}
          supportLimitCents={supportLimitCents}
          supportSpentTodayCents={supportSpentTodayCents}
          currentStatus={statusFilter}
          currentSource={sourceFilter}
          currentIsApi={isApiEnabledFilter}
          currentSearch={search}
          canSeeRates={canSeeRates}
          userRole={user?.role || 'SUPPORT'}
        />
      </div>
    </div>
  );
}
