import { db } from "@/lib/db";
import { CategoryManager } from "./components/category-manager";
import { Layers } from "lucide-react";
import { AdminTabbedHeader } from "@/components/admin/tabbed-header";
import { CATALOG_TABS, ONBOARDING_CONFIGS } from "@/components/admin/navigation-data";

import { headers, cookies } from "next/headers";
import { normalizeTenantId } from "@/lib/tenant-resolver-edge";
import { verifySession } from "@/lib/session";

import { enforceSectionAccess } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ tenant?: string }>;
};

export default async function CategoriesAdminPage({ searchParams }: Props) {
  await enforceSectionAccess('catalog');

  const reqHeaders = await headers();
  const cookieStore = await cookies();
  const session = await verifySession();
  const user = session ? await db.user.findUnique({ 
    where: { id: session.userId },
    select: { id: true, role: true, tenantId: true }
  }) : null;

  const params = searchParams ? await searchParams : {};
  const { resolveAdminTenantContext } = await import('@/utils/admin-tenant');

  const cookieTenant = cookieStore.get('x_admin_tenant')?.value;
  const headerTenant = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const effectiveParamTenant = params.tenant || cookieTenant;

  const resolvedTenant = resolveAdminTenantContext(user as unknown as import('@prisma/client').User, effectiveParamTenant);
  const selectedTenant = resolvedTenant || headerTenant || 'smmplan';
  const isGlobalTenant = selectedTenant === 'all';

  const categoriesRaw = await db.category.findMany({
    where: !isGlobalTenant ? { tenantId: { in: [selectedTenant, 'all'] } } : undefined,
    orderBy: [
      { network: { slug: 'asc' } },
      { sort: 'asc' }
    ],
    include: {
      network: true,
      _count: {
        select: {
          services: true
        }
      }
    }
  });

  const serviceStats = await db.service.groupBy({
    by: ['categoryId', 'tenantId', 'isActive'],
    _count: {
      _all: true
    }
  });

  const categories = categoriesRaw.map(c => {
    const catStats = serviceStats.filter(s => s.categoryId === c.id);
    
    // Active services on current tenant (or all active if isGlobalTenant)
    const tenantServicesCount = catStats
      .filter(s => s.isActive && (isGlobalTenant || s.tenantId === selectedTenant || (!s.tenantId && selectedTenant === 'smmplan') || s.tenantId === 'all'))
      .reduce((acc, s) => acc + s._count._all, 0);

    const globalServicesCount = c._count.services;

    // Services on other tenants (active)
    const otherTenantsActiveCount = catStats
      .filter(s => s.isActive && !isGlobalTenant && (s.tenantId || 'smmplan') !== selectedTenant && s.tenantId !== 'all')
      .reduce((acc, s) => acc + s._count._all, 0);

    let otherTenantsLabel = '';
    if (otherTenantsActiveCount > 0) {
      const otherTenants = Array.from(new Set(
        catStats
          .filter(s => s.isActive && !isGlobalTenant && (s.tenantId || 'smmplan') !== selectedTenant && s.tenantId !== 'all')
          .map(s => s.tenantId || 'smmplan')
      ));
      if (otherTenants.length === 1 && otherTenants[0] === 'flux') {
        otherTenantsLabel = `Только во Flux (${otherTenantsActiveCount})`;
      } else if (otherTenants.length === 1 && otherTenants[0] === 'smmplan') {
        otherTenantsLabel = `Только в SMMplan (${otherTenantsActiveCount})`;
      } else {
        otherTenantsLabel = `В других проектах (${otherTenantsActiveCount})`;
      }
    } else if (globalServicesCount > tenantServicesCount) {
      const inactiveCount = globalServicesCount - tenantServicesCount;
      otherTenantsLabel = `Скрытые / архив (${inactiveCount})`;
    }

    return {
      ...c,
      tenantServicesCount,
      globalServicesCount,
      otherTenantsCount: Math.max(0, globalServicesCount - tenantServicesCount),
      otherTenantsLabel,
      _count: {
        services: tenantServicesCount
      }
    };
  });

  const networks = await db.network.findMany({ orderBy: { sort: 'asc' } });

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10">
      <AdminTabbedHeader
        icon={Layers}
        title="Управление Категориями"
        description="Группировка, сортировка и объединение услуг по социальным сетям."
        tabs={CATALOG_TABS}
        onboardingKey="catalog"
        onboarding={ONBOARDING_CONFIGS.catalog}
      />

      <CategoryManager categories={categories} networks={networks} currentTenant={selectedTenant} />
    </div>
  );
}

