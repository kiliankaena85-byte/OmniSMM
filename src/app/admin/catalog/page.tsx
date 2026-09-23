import { adminCatalogService } from '@/services/admin/catalog.service';
import { adminProviderService } from '@/services/admin/provider.service';
import { bulkUpdateMarkupAction } from '@/actions/admin/catalog';
import { ShoppingCart, AlertTriangle } from 'lucide-react';
import { SettingsProvider } from '@/lib/settings';
import Link from 'next/link';
import { SubmitButton } from '@/components/admin/submit-button';
import { Button } from '@/components/ui/button';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { CatalogTable } from '@/components/admin/catalog-table-v2';
import { CatalogPagination } from '@/components/admin/catalog/catalog-pagination';

import {
  TOTAL_MANDATORY_DEDUCTIONS,
  SAFETY_FLOOR_MARKUP,
} from '@/lib/financial-constants';
import type { CatalogServiceDTO } from '@/types/catalog.dto';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';

import { headers, cookies } from 'next/headers';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';
import { TenantSwitcher } from '@/components/admin/tenant-switcher';

export const dynamic = 'force-dynamic';

// Safety floor multiplier: minimum markup that covers taxes + gateway + 100% margin
const SAFETY_MULTIPLIER = (1 + SAFETY_FLOOR_MARKUP) / (1 - TOTAL_MANDATORY_DEDUCTIONS);

type Props = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
    cursor?: string;
    category?: string;
    providerId?: string;
    isActive?: string;
    hideDeleted?: string;
    providerStatus?: string;
    externalId?: string;
    sortBy?: string;
    sortOrder?: string;
    platform?: string;
    tenant?: string;
  }>;
};

export default async function AdminCatalogPage({ searchParams }: Props) {
  const reqHeaders = await headers();
  const cookieStore = await cookies();
  const session = await verifySession();
  const user = session ? await db.user.findUnique({ 
    where: { id: session.userId },
    include: { staffRole: { include: { permissions: true } } }
  }) : null;

  const isSuperAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const permissions = user?.staffRole?.permissions || [];

  const canSeeRates = isSuperAdmin || permissions.some(p => p.section.toUpperCase() === 'FINANCE' && (p.canView || p.canEdit));
  const canEdit = isSuperAdmin || permissions.some(p => p.section.toUpperCase() === 'CATALOG' && p.canEdit);
  const canEditFinance = isSuperAdmin || permissions.some(p => p.section.toUpperCase() === 'FINANCE' && p.canEdit);

  const params = await searchParams;
  const { resolveAdminTenantContext } = await import('@/utils/admin-tenant');

  // 1. Search param has top priority
  // 2. Admin cookie x_admin_tenant has secondary priority (from header switcher)
  // 3. Domain header or default smmplan
  const cookieTenant = cookieStore.get('x_admin_tenant')?.value;
  const headerTenant = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const effectiveParamTenant = params.tenant || cookieTenant;

  const resolvedTenant = resolveAdminTenantContext(user, effectiveParamTenant);
  const selectedTenant = resolvedTenant !== 'all' ? resolvedTenant : (headerTenant || 'smmplan');
  const search = params.q?.trim() || undefined;
  const pageNum = params.page ? Math.max(1, parseInt(params.page, 10) || 1) : 1;
  const rawPageSize = params.pageSize ? parseInt(params.pageSize, 10) : 50;
  const pageSize = [20, 50, 100, 200].includes(rawPageSize) ? rawPageSize : 50;
  const cursor = params.cursor || undefined;
  const categoryId = (params.category && params.category !== 'all') ? params.category : undefined;
  const providerId = (params.providerId && params.providerId !== 'all') ? params.providerId : undefined;
  const isActiveStr = params.isActive;
  const isActive = (isActiveStr === 'true') ? true : (isActiveStr === 'false') ? false : undefined;
  const hideDeleted = params.hideDeleted === 'true';
  const providerStatus = (params.providerStatus && params.providerStatus !== 'all') ? params.providerStatus : undefined;
  const externalId = params.externalId?.trim() || undefined;
  const sortBy = params.sortBy || undefined;
  const sortOrder = (params.sortOrder === 'asc' || params.sortOrder === 'desc') ? (params.sortOrder as 'asc' | 'desc') : undefined;
  const platform = (params.platform && params.platform !== 'ALL' && params.platform !== 'all') ? params.platform : undefined;

  const [
    { items: rawServices, nextCursor, hasMore, totalCount: filteredTotalCount, totalPages, currentPage },
    usdToRub,
    categories,
    catalogHealth,
    stats,
    markupAnalytics,
    providers,
    networks
  ] = await Promise.all([
    adminCatalogService.listServices({
      search: search || undefined,
      categoryId,
      providerId,
      isActive,
      hideDeleted,
      providerStatus,
      externalId,
      cursor,
      page: cursor ? undefined : pageNum,
      pageSize,
      sortBy,
      sortOrder,
      networkSlug: platform,
      tenantId: selectedTenant,
    }),
    SettingsProvider.getExchangeRateUSD(),
    // AUD-05 (3.1): tenant-scoped category filter list
    adminCatalogService.listCategories(selectedTenant),
    adminCatalogService.getCatalogHealthCounts(selectedTenant),
    adminCatalogService.getCatalogStats(selectedTenant),
    adminCatalogService.getMarkupAnalytics(selectedTenant),
    adminProviderService.listProviders(),
    db.network.findMany({ orderBy: { sort: 'asc' } }),
  ]);

  // Map to strict DTO — no raw Prisma objects on client
  const services: CatalogServiceDTO[] = rawServices.map(s => {
        
    return {
      id: s.id,
      numericId: s.numericId,
      name: s.name,
      externalId: s.externalId ?? null,
      categoryId: s.category.id,
      categoryName: s.category.name,
      networkName: s.category.network?.name ?? null,
      networkSlug: s.category.network?.slug ?? null,
      rate: s.rate,
      markup: s.markup,
      minQty: s.minQty,
      maxQty: s.maxQty,
      isActive: s.isActive,
      isQuarantined: !!s.isQuarantined,
      quarantineReason: s.quarantineReason ?? null,
      isDripFeedEnabled: s.isDripFeedEnabled,
      isRefillEnabled: s.isRefillEnabled,
      isCancelEnabled: !!s.isCancelEnabled,
      ordersCount: s._count?.orders ?? 0,
      description: s.description ?? null,
      targetType: s.targetType ?? null,
      customDataType: s.customDataType ?? "NONE",
      customDataLabel: s.customDataLabel ?? null,
      isMediaGroupAware: !!s.isMediaGroupAware,
      providerId: s.providerId ?? null,
      requireWarning: !!s.requireWarning,
      warningMessage: s.warningMessage ?? null,
      cooldownReason: s.cooldownReason ?? null,
      qualityTier: s.qualityTier ?? null,
      icon: s.icon ?? null,
      categoryIcon: s.category.icon ?? null,
      createdAt: s.createdAt ?? null,
    };
  });
  return (
    <div className="flex flex-col gap-3 w-full animate-in fade-in duration-300">
      {/* Unified Tabbed Header */}
      <AdminTabbedHeader
        icon={ShoppingCart}
        title="Каталог услуг"
        description={
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span className="font-mono font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border/50">
              {stats.totalServices} услуг
            </span>
            <span>·</span>
            <span>Активных: <b className="text-emerald-500 font-bold">{stats.activeServices}</b></span>
            <span>·</span>
            <span>Ср. маржа: <b className="text-primary font-bold">x{markupAnalytics.averageMarkup.toFixed(2)}</b></span>
            <span>·</span>
            <span>Курс USD: <b className="font-bold text-foreground">{usdToRub.toFixed(2)} ₽</b></span>
          </div>
        }
        tabs={CATALOG_TABS}
        onboardingKey="catalog"
        onboarding={ONBOARDING_CONFIGS.catalog}
        currentTenant={selectedTenant}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {catalogHealth.quarantine > 0 && (
              <Link href={`/admin/catalog/quarantine?tenant=${selectedTenant}`}>
                <Button
                  intent="outline"
                  size="sm"
                  className="font-bold h-9 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                >
                  ⚠️ Карантин ({catalogHealth.quarantine})
                </Button>
              </Link>
            )}
            {catalogHealth.zombies > 0 && (
              <Link href={`/admin/catalog?providerStatus=zombie&tenant=${selectedTenant}`}>
                <Button
                  intent="outline"
                  size="sm"
                  className="font-bold h-9 border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20"
                  title="Услуги, отключённые авто-зомби-логикой (ZOMBIE_AUTO_DISABLED / ZOMBIE_ARCHIVED)"
                >
                  🧟 Зомби ({catalogHealth.zombies})
                </Button>
              </Link>
            )}
            {catalogHealth.cooldown > 0 && (
              <Link href={`/admin/catalog?providerStatus=cooldown&tenant=${selectedTenant}`}>
                <Button
                  intent="outline"
                  size="sm"
                  className="font-bold h-9 border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20"
                  title="Активные услуги во временном отстое (cooldown) — скрыты с витрины до окончания срока"
                >
                  ⏸ На отстое ({catalogHealth.cooldown})
                </Button>
              </Link>
            )}
            {canEdit && (
              <Link href="/admin/catalog/new">
                <Button
                  intent="primary"
                  size="sm"
                  className="font-bold h-9"
                >
                  + Создать услугу
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Direct Catalog Table with 2x4 Filters and Service Rows */}
      <CatalogTable 
        services={services} 
        usdToRub={usdToRub} 
        canEdit={canEdit} 
        canEditFinance={canEditFinance} 
        canSeeRates={canSeeRates} 
        categories={categories}
        providers={providers}
        networks={networks}
        selectedTenant={selectedTenant}
      />
      
      {/* Modular Pagination with Numbered Pages, PageSize & Jump */}
      <CatalogPagination
        totalCount={filteredTotalCount}
        globalTotalCount={stats.totalServices}
        currentPage={currentPage || pageNum}
        totalPages={totalPages || 1}
        pageSize={pageSize}
        selectedTenant={selectedTenant}
      />
    </div>
  );
}
