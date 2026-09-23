export const dynamic = "force-dynamic";

import ClientPage from "./client-page";
import type { Metadata } from 'next';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { getTenantDashboardViews } from '@/tenants/factory';

import { headers } from 'next/headers';
import { resolveTenantFromRequest } from '@/lib/tenant-resolver-edge';

export const metadata: Metadata = {
  title: 'Новый заказ',
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await verifySession();
  const sp = await searchParams;
  const reqHeaders = await headers();
  const tenantId = resolveTenantFromRequest(reqHeaders);

  let userEmail = "";
  let userBalanceCents = 0;

  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true, balance: true }
    });
    userEmail = user?.email || "";
    userBalanceCents = user?.balance ? Number(user.balance) : 0;
  }

  let initialReorderData = null;
  if (sp.reorderServiceId && sp.reorderCategoryId && sp.reorderQty) {
    initialReorderData = {
      serviceId: sp.reorderServiceId as string,
      categoryId: sp.reorderCategoryId as string,
      link: (sp.reorderLink as string) || "",
      quantity: parseInt(sp.reorderQty as string, 10) || 100
    };
  }

  const { NewOrderView } = await getTenantDashboardViews(tenantId);
  const ActiveNewOrderView = NewOrderView || ClientPage;

  return (
    <ActiveNewOrderView
      userEmail={userEmail}
      userBalanceCents={userBalanceCents}
      initialReorderData={initialReorderData}
      tenantId={tenantId}
    />
  );
}

