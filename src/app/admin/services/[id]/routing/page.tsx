import { enforceSectionAccess } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import { RoutingPanelClient } from '@/components/admin/routing/RoutingPanelClient';
import { getProviderComparisonData } from '@/actions/admin/routing.actions';

export default async function ServiceRoutingPage({ params }: { params: Promise<{ id: string }> }) {
  await enforceSectionAccess('catalog');
  const { id } = await params;

  const service = await db.service.findUnique({
    where: { id },
    include: { provider: true, category: true }
  });

  if (!service) notFound();

  const routes = await db.serviceRoute.findMany({
    where: { serviceId: id },
    include: { provider: true },
    orderBy: { priority: 'asc' }
  });

  const needsRouteSeed = routes.length === 0 && !!service.providerId && !!service.externalId;

  const auditLogs = await db.routingAuditLog.findMany({
    where: { serviceId: id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const activeProviders = await db.provider.findMany({
    where: { isActive: true },
    select: { id: true, name: true }
  });

  const comparisonRes = await getProviderComparisonData(id);
  const comparisonData = comparisonRes.success ? comparisonRes.data : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Operational Routing (Hot-Swap)</h1>
        <p className="text-muted-foreground">
          Управление потоком трафика для услуги: <span className="font-semibold text-primary">{service.name}</span>
        </p>
      </div>

      {/* React Client Component to handle interactivity */}
      <RoutingPanelClient 
        service={service} 
        routes={routes} 
        auditLogs={auditLogs} 
        activeProviders={activeProviders}
        comparisonData={comparisonData}
        needsRouteSeed={needsRouteSeed}
      />
    </div>
  );
}
