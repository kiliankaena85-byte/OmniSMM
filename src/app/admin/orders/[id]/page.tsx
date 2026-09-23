import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { ArrowLeft, Package } from 'lucide-react';
import { OrderStandaloneView } from './order-standalone-view';
import { enforceSectionAccess } from '@/lib/server/rbac';

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await enforceSectionAccess('orders');
  const session = await verifySession();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  // Find by ID or numericId
  const isNumeric = /^\d+$/.test(id);
  const order = await db.order.findFirst({
    where: isNumeric
      ? { numericId: parseInt(id, 10) }
      : { id },
    include: {
      user: { select: { id: true, email: true, balance: true } },
      provider: { select: { id: true, name: true, apiUrl: true } },
      service: {
        select: {
          id: true,
          name: true,
          numericId: true,
          etaP50Seconds: true,
          etaP90Seconds: true,
          etaSampleCount: true,
          etaSpeedClass: true,
          etaUpdatedAt: true,
          category: {
            select: {
              name: true,
              network: { select: { name: true, slug: true } }
            }
          }
        }
      }
    }
  });

  if (!order) {
    notFound();
  }

  const canSeeRates = Boolean(session.role && ['OWNER', 'ADMIN', 'MANAGER'].includes(session.role));

  return (
    <div className="w-full max-w-4xl mx-auto min-h-full flex flex-col gap-5 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Navigation Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 text-xs font-bold border border-border/40"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад к заказам</span>
          </Link>
          <div className="h-4 w-[1px] bg-border" />
          <h1 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Package className="w-4.5 h-4.5 text-primary" />
            <span>Заказ #{order.numericId}</span>
          </h1>
        </div>
      </div>

      {/* Standalone Interactive Bento View */}
      <OrderStandaloneView
        order={{
          id: order.id,
          numericId: order.numericId,
          externalId: order.externalId,
          link: order.link,
          quantity: order.quantity,
          remains: order.remains,
          status: order.status,
          charge: order.charge.toString(),
          providerCost: order.providerCost.toString(),
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
          isDripFeed: order.isDripFeed,
          dripExternalIds: order.dripExternalIds,
          runs: order.runs,
          interval: order.interval,
          currentRun: order.currentRun,
          error: order.error,
          user: { email: order.user.email, id: order.user.id },
          providerName: order.provider?.name || null,
          tenantId: order.tenantId,
          service: {
            name: order.service.name,
            category: {
              name: order.service.category.name,
              network: order.service.category.network ? { name: order.service.category.network.name } : null
            }
          }
        }}
        canSeeRates={canSeeRates}
      />
    </div>
  );
}