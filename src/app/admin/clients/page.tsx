import { adminUserService, getVolumeTier, USER_SORT_FIELDS, type UserSortField, type SortOrder } from '@/services/admin/user.service';
import Link from 'next/link';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { FINANCE_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { ClientTable } from './components/client-table';
import { ClientQuickSort } from './components/client-quick-sort';
import { NumberedPagination } from '@/components/admin/ui/numbered-pagination';
import { Users, Download, Search, Building2, Wallet, ShieldAlert, Sparkles } from 'lucide-react';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';
import { enforceSectionAccess } from '@/lib/server/rbac';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    q?: string;
    filter?: 'all' | 'api' | 'balance' | 'banned' | 'vip';
    cursor?: string;
    page?: string;
    pageSize?: string;
    tenant?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
};

export default async function AdminClientsPage({ searchParams }: Props) {
  await enforceSectionAccess('clients');
  const session = await verifySession();
  const user = session ? await db.user.findUnique({ 
    where: { id: session.userId },
    include: { staffRole: { include: { permissions: true } } }
  }) : null;

  const isOwner = user?.role === 'OWNER';
  // SUPPORT can see client finances for effective client assistance
  const canSeeFinances = !!user && user.role !== 'USER';

  const params = await searchParams;
  const search = params.q || '';
  const filter = params.filter || 'all';
  const cursor = params.cursor || undefined;
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const pageSize = Math.max(10, Math.min(200, parseInt(params.pageSize || '50', 10) || 50));
  const selectedTenant = params.tenant;

  // Dynamic sorting with whitelist validation
  const rawSortBy = params.sortBy;
  const sortBy: UserSortField = (rawSortBy && USER_SORT_FIELDS.includes(rawSortBy as UserSortField))
    ? (rawSortBy as UserSortField)
    : 'createdAt';
  const sortOrder: SortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';

  const cookieStore = await cookies();
  const cookieTenant = cookieStore.get('x_admin_tenant')?.value;
  const activeTenantId = resolveAdminTenantContext(user, selectedTenant, cookieTenant);

  const { items: users, totalCount, totalPages, currentPage } = await adminUserService.listUsers({
    search: search || undefined,
    filter,
    cursor,
    page,
    pageSize,
    tenantId: activeTenantId,
    sortBy,
    sortOrder,
  });

  const stats = await adminUserService.getUserStats(undefined, undefined, activeTenantId);

  const filterTabs = [
    { id: 'all', label: 'Все клиенты', icon: Users, count: stats.total },
    { id: 'api', label: 'API Партнеры', icon: Building2 },
    { id: 'balance', label: 'С балансом', icon: Wallet },
    { id: 'vip', label: 'VIP (Gold/Plat)', icon: Sparkles },
    { id: 'banned', label: 'Забаненные', icon: ShieldAlert, count: stats.banned },
  ];

  // Build export link with active filters and sorting
  const exportParams = new URLSearchParams();
  exportParams.set('type', 'users');
  if (search) exportParams.set('q', search);
  if (filter !== 'all') exportParams.set('filter', filter);
  if (sortBy !== 'createdAt') exportParams.set('sortBy', sortBy);
  if (sortOrder !== 'desc') exportParams.set('sortOrder', sortOrder);
  if (activeTenantId) exportParams.set('tenant', activeTenantId);

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10">
      <AdminTabbedHeader
        icon={Users}
        title="Клиенты платформы"
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground font-medium text-xs">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full"></div>Всего: {stats.total}</span>
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-success rounded-full"></div>Активные: {stats.active}</span>
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-destructive rounded-full"></div>Забанены: {stats.banned}</span>
            {canSeeFinances && (
               <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-warning rounded-full"></div>Обязательства (Liability): <span className="tabular-nums font-bold">{Math.round(Number(stats.totalLiability) / 100).toLocaleString('ru-RU')} ₽</span></span>
            )}
          </div>
        }
        action={(isOwner || user?.role === 'ADMIN') ? (
          <div className="flex items-center gap-3">
            <a
              href={`/api/admin/export?${exportParams.toString()}`}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-foreground bg-card/80 backdrop-blur-md border border-border/70 shadow-xs rounded-lg hover:bg-muted transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" /> Экспорт CSV
            </a>
          </div>
        ) : undefined}
        tabs={FINANCE_TABS}
        onboardingKey="clients"
        onboarding={ONBOARDING_CONFIGS.clients}
      />

      {/* Filter Tabs & Search / Sort Bar */}
      <div className="bg-card/60 backdrop-blur-md border border-border/70 shadow-xs rounded-lg p-4 sm:p-5 ring-1 ring-border/5 space-y-4">
        {/* Fast Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {filterTabs.map((f) => {
            const Icon = f.icon;
            const isActive = filter === f.id;
            const queryParams = new URLSearchParams();
            if (f.id !== 'all') queryParams.set('filter', f.id);
            if (search) queryParams.set('q', search);
            if (sortBy !== 'createdAt') queryParams.set('sortBy', sortBy);
            if (sortOrder !== 'desc') queryParams.set('sortOrder', sortOrder);
            if (activeTenantId) queryParams.set('tenant', activeTenantId);

            return (
              <Link
                key={f.id}
                href={`/admin/clients${queryParams.toString() ? `?${queryParams.toString()}` : ''}`}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all select-none whitespace-nowrap cursor-pointer border ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-background/60 text-muted-foreground border-border/70 hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{f.label}</span>
                {f.count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {f.count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Search Bar & Quick Sort Controls */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <form method="GET" action="/admin/clients" className="flex flex-1 flex-col sm:flex-row gap-3">
            {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
            {activeTenantId && <input type="hidden" name="tenant" value={activeTenantId} />}
            {sortBy !== 'createdAt' && <input type="hidden" name="sortBy" value={sortBy} />}
            {sortOrder !== 'desc' && <input type="hidden" name="sortOrder" value={sortOrder} />}
            
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                name="q"
                defaultValue={search}
                placeholder="Поиск по Email, ID, Telegram, Названию компании или ИНН..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-background/60 border border-border/70 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-xs text-foreground placeholder:text-muted-foreground/60 font-medium"
              />
            </div>
            <button
              type="submit"
              className="sm:w-auto w-full px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg active:scale-95 transition-all shadow-xs hover:opacity-90 cursor-pointer"
            >
              Найти
            </button>
            {search && (
              <Link
                href={`/admin/clients${(() => {
                  const resetParams = new URLSearchParams();
                  if (filter !== 'all') resetParams.set('filter', filter);
                  if (activeTenantId) resetParams.set('tenant', activeTenantId);
                  return resetParams.toString() ? `?${resetParams.toString()}` : '';
                })()}`}
                className="sm:w-auto w-full px-3.5 py-2 text-xs font-bold text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition-all flex items-center justify-center border border-border/70"
              >
                Сброс
              </Link>
            )}
          </form>

          {/* Quick Sort Dropdown & Active Filter Indicator */}
          <div className="flex items-center justify-end shrink-0">
            <ClientQuickSort />
          </div>
        </div>
      </div>

      {/* Main Clients Table */}
      <div className="bg-card/60 backdrop-blur-md border border-border/70 shadow-xs rounded-lg ring-1 ring-border/5 overflow-hidden">
        <div className="p-4 sm:p-6">
          <ClientTable 
            data={users.map(u => ({
              ...u,
              totalSpent: Number(u.totalSpent),
              balance: Number(u.balance),
              quarantineBalance: Number(u.quarantineBalance),
              tier: getVolumeTier(Number(u.totalSpent)),
              tenantId: u.tenantId,
              telegramId: u.telegramId,
              companyName: u.companyName,
              inn: u.inn,
              createdAt: u.createdAt,
              apiConfig: u.apiConfig,
            }))}
          />

          {/* Modular Numbered Pagination */}
          <NumberedPagination
            totalCount={totalCount}
            globalTotalCount={stats.total}
            currentPage={currentPage || page}
            totalPages={totalPages || 1}
            pageSize={pageSize}
            itemLabel="клиентов"
            selectedTenant={activeTenantId}
          />
        </div>
      </div>
    </div>
  );
}
