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
  const selectedTenant = resolvedTenant !== 'all' ? resolvedTenant : (headerTenant || 'smmplan');
  const tenantFilter = selectedTenant ? { in: [selectedTenant, 'all'] } : undefined;

  const categories = await db.category.findMany({
    where: selectedTenant ? { tenantId: { in: [selectedTenant, 'all'] } } : undefined,
    orderBy: [
      { network: { slug: 'asc' } },
      { sort: 'asc' }
    ],
    include: {
      network: true,
      _count: {
        select: {
          services: {
            where: {
              isActive: true,
              ...(tenantFilter ? { tenantId: tenantFilter } : {})
            }
          }
        }
      }
    }
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

      <CategoryManager categories={categories} networks={networks} />
    </div>
  );
}

