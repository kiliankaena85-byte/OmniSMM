import React from 'react';
import { db } from '@/lib/db';
import { enforceSectionAccess } from '@/lib/server/rbac';
import { TenantsManager } from './tenants-manager';
import { Globe } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS } from '@/components/admin/navigation-data';

export const dynamic = 'force-dynamic';

export default async function AdminTenantsPage() {
  await enforceSectionAccess('settings');

  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      systemSettings: {
        select: {
          siteName: true,
          siteDescription: true,
          siteLogoUrl: true,
          siteFaviconUrl: true,
          isTestMode: true,
          maintenanceMode: true,
        }
      }
    }
  });

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10">
      <AdminTabbedHeader
        icon={Globe}
        title="Бренды и Мульти-арендаторы"
        description="Управление изолированными витринами (SMMplan, SMMflux), доменами и отдельными настройками."
        tabs={SYSTEM_TABS}
      />

      <TenantsManager initialTenants={tenants} />
    </div>
  );
}
