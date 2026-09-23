import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { getTenantDashboardViews } from '@/tenants/factory';
import { TenantErrorBoundary } from '@/tenants/TenantErrorBoundary';

import { resolveTenantFromRequest } from '@/lib/tenant-resolver-edge';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqHeaders = await headers();
  const tenantId = resolveTenantFromRequest(reqHeaders);

  const session = await verifySession(tenantId);
  if (!session) redirect('/login');

  const [user, unreadTicketsCount] = await Promise.all([
    db.user.findFirst({
      where: { id: session.userId, tenantId },
      select: { email: true, balance: true, tenantId: true },
    }),
    db.ticket.count({
      where: {
        userId: session.userId,
        tenantId,
        status: 'PENDING',
      },
    }),
  ]);

  if (!user) redirect('/login');

  const userForClient = {
    email: user.email,
    tenantId: user.tenantId,
    balanceCents: Number(user.balance),
    unreadTicketsCount,
  };

  const { ShellLayout } = await getTenantDashboardViews(tenantId);

  return (
    <TenantErrorBoundary tenantId={tenantId}>
      <ShellLayout user={userForClient}>{children}</ShellLayout>
    </TenantErrorBoundary>
  );
}
