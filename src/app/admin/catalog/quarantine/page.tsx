import { db } from '@/lib/db';
import { QuarantineClient } from './quarantine-client';
import { AlertTriangle } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { headers, cookies } from 'next/headers';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';
import { verifySession } from '@/lib/session';
import { enforceSectionAccess } from '@/lib/server/rbac';

interface ServiceWithRelations {
  id: string;
  numericId?: number;
  name: string;
  rate: number;
  pendingRate: number | null;
  quarantineReason: string | null;
  cooldownReason: string | null;
  quarantinedAt: Date | null;
  cooldownUntil: Date | null;
  externalId: string | null;
  updatedAt: Date;
  category: {
    name: string;
    network: { slug: string } | null;
  };
  provider: { id: string; name: string } | null;
}

interface AutoFixLog {
  id: string;
  target: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
}

interface QuarantineItemDto {
  id: string;
  numericId: number | null;
  name: string;
  categoryName: string;
  networkSlug: string;
  providerId: string | null;
  providerName: string;
  currentRate: number;
  pendingRate: number | null;
  quarantineReason: string;
  quarantinedAt: string;
  externalId: string;
  cooldownUntil: string | null;
}

interface AutoFixItemDto {
  id: string;
  serviceId: string;
  serviceNumericId?: number | null;
  serviceName: string;
  categoryName: string;
  networkSlug: string;
  providerId: string | null;
  providerName: string;
  externalId: string | null;
  oldValue: Record<string, string | number | null> | null;
  newValue: Record<string, string | number | null> | null;
  createdAt: string;
}

export const dynamic = 'force-dynamic';

type Props = {
  searchParams?: Promise<{ tenant?: string }>;
};

export default async function QuarantinePage({ searchParams }: Props) {
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

  const tenantServiceCondition = tenantFilter ? { category: { tenantId: tenantFilter } } : {};

  const [quarantined, zombies, blockedByApi, autoFixLogs] = await Promise.all([
    db.service.findMany({
      where: { 
        isQuarantined: true,
        ...tenantServiceCondition,
      },
      include: { category: { include: { network: true } }, provider: { select: { id: true, name: true } } },
      orderBy: { quarantinedAt: 'desc' },
    }) as Promise<ServiceWithRelations[]>,
    db.service.findMany({
      where: { 
        cooldownReason: 'ZOMBIE_AUTO_DISABLED', 
        isActive: false,
        ...tenantServiceCondition,
      },
      include: { category: { include: { network: true } }, provider: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    }) as Promise<ServiceWithRelations[]>,
    db.service.findMany({
      where: {
        cooldownUntil: { gt: new Date() },
        cooldownReason: { not: 'ZOMBIE_AUTO_DISABLED' },
        ...tenantServiceCondition,
      },
      include: { category: { include: { network: true } }, provider: { select: { id: true, name: true } } },
      orderBy: { cooldownUntil: 'desc' },
    }) as Promise<ServiceWithRelations[]>,
    db.adminAuditLog.findMany({
      where: { action: 'SERVICE_AUTO_FIX' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) as Promise<AutoFixLog[]>,
  ]);


  const mapToDto = (s: ServiceWithRelations): QuarantineItemDto => ({
    id: s.id,
    numericId: s.numericId ?? null,
    name: s.name,
    categoryName: s.category.name,
    networkSlug: s.category.network?.slug ?? 'unknown',
    providerId: s.provider?.id ?? null,
    providerName: s.provider?.name ?? '—',
    currentRate: s.rate,
    pendingRate: s.pendingRate,
    quarantineReason: s.quarantineReason ?? s.cooldownReason ?? '',
    quarantinedAt: s.quarantinedAt && !isNaN(new Date(s.quarantinedAt).getTime()) ? new Date(s.quarantinedAt).toISOString() : '',
    externalId: s.externalId ?? '',
    cooldownUntil: s.cooldownUntil && !isNaN(new Date(s.cooldownUntil).getTime()) ? new Date(s.cooldownUntil).toISOString() : null,
  });

  const priceSpikes = quarantined.map(mapToDto);
  const zombieItems = zombies.map(mapToDto);
  const apiErrors = blockedByApi.map(mapToDto);

  const serviceIds = autoFixLogs.map(l => l.target);
  const servicesInfo = await db.service.findMany({
    where: { id: { in: serviceIds } },
    select: {
      id: true,
      numericId: true,
      name: true,
      externalId: true,
      category: { select: { name: true, network: { select: { slug: true } } } },
      provider: { select: { id: true, name: true } },
    },
  });

  const serviceInfoMap = new Map(servicesInfo.map(s => [s.id, s]));

  const autoFixes = autoFixLogs.map(log => {
    const sInfo = serviceInfoMap.get(log.target);
    let oldValueParsed = null;
    let newValueParsed = null;
    try {
      oldValueParsed = log.oldValue ? JSON.parse(log.oldValue) : null;
    } catch { /* ignore */ }
    try {
      newValueParsed = log.newValue ? JSON.parse(log.newValue) : null;
    } catch { /* ignore */ }

    return {
      id: log.id,
      serviceId: log.target,
      serviceNumericId: sInfo?.numericId ?? null,
      serviceName: sInfo?.name ?? `Услуга #${log.target.slice(0, 8)}`,
      categoryName: sInfo?.category?.name ?? '—',
      networkSlug: sInfo?.category?.network?.slug ?? 'unknown',
      providerId: sInfo?.provider?.id ?? null,
      providerName: sInfo?.provider?.name ?? '—',
      externalId: sInfo?.externalId ?? null,
      oldValue: oldValueParsed,
      newValue: newValueParsed,
      createdAt: log.createdAt.toISOString(),
    };
  });

  const totalAnomalies = priceSpikes.length + zombieItems.length + apiErrors.length;

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10">
      <AdminTabbedHeader
        icon={AlertTriangle}
        title="Карантин цен и аномалий"
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground font-medium text-xs">
            <span>Карантин цен, зомби-услуги и сбои API провайдеров.</span>
            {totalAnomalies > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/20 animate-pulse">
                Аномалий: {totalAnomalies}
              </span>
            )}
          </div>
        }
        tabs={CATALOG_TABS}
        onboardingKey="quarantine"
        onboarding={ONBOARDING_CONFIGS.quarantine}
      />
      <QuarantineClient 
        initialPriceSpikes={priceSpikes} 
        initialZombies={zombieItems} 
        initialApiErrors={apiErrors} 
        initialAutoFixes={autoFixes}
      />
    </div>
  );
}
