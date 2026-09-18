import { db } from '@/lib/db';
import { RefreshCw } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { OPERATIONS_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { RefillsTable, RefillItemDTO } from './client-table';
import { enforceSectionAccess } from '@/lib/server/rbac';
import { SettingsProvider } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AdminRefillsPage() {
  await enforceSectionAccess('orders');

  const [
    rawRefills,
    totalCount,
    pendingCount,
    inProgressCount,
    completedCount,
    rejectedCount,
    errorCount,
    isRefillModuleEnabled,
  ] = await Promise.all([
    db.refill.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        order: {
          select: {
            id: true,
            numericId: true,
            link: true,
            quantity: true,
            createdAt: true,
            user: { select: { id: true, email: true } },
            service: {
              select: {
                id: true,
                name: true,
                provider: { select: { id: true, name: true } },
                category: {
                  select: {
                    name: true,
                    network: { select: { name: true, slug: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.refill.count(),
    db.refill.count({ where: { status: 'PENDING' } }),
    db.refill.count({ where: { status: 'IN_PROGRESS' } }),
    db.refill.count({ where: { status: 'COMPLETED' } }),
    db.refill.count({ where: { status: 'REJECTED' } }),
    db.refill.count({ where: { status: 'ERROR' } }),
    SettingsProvider.isRefillModuleEnabled(),
  ]);

  const refills: RefillItemDTO[] = rawRefills.map((r) => ({
    id: r.id,
    numericId: r.numericId,
    status: r.status,
    externalId: r.externalId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    order: {
      id: r.order.id,
      numericId: r.order.numericId,
      link: r.order.link,
      quantity: r.order.quantity,
      createdAt: r.order.createdAt,
      user: {
        id: r.order.user.id,
        email: r.order.user.email,
      },
      service: {
        id: r.order.service.id,
        name: r.order.service.name,
        provider: r.order.service.provider,
        category: r.order.service.category,
      },
    },
  }));

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10">
      <AdminTabbedHeader
        icon={RefreshCw}
        title="Гарантийные Докрутки (Refills)"
        description={`Всего: ${totalCount} • Ожидают: ${pendingCount} • В работе: ${inProgressCount} • Выполнены: ${completedCount} • Отклонены: ${rejectedCount} • Ошибки: ${errorCount}`}
        tabs={OPERATIONS_TABS}
        onboardingKey="refills"
        onboarding={ONBOARDING_CONFIGS.refills}
      />

      <RefillsTable refills={refills} isModuleEnabled={isRefillModuleEnabled} />
    </div>
  );
}

