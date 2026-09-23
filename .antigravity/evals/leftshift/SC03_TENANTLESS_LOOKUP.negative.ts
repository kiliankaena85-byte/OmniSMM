// SC03 Negative Fixture: Tenant-Scoped Query Pattern
import { tenantWhere } from '@/lib/tenant-scope';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOrder(db: any, session: any, id: string) {
  const order = await db.order.findFirst({
    where: tenantWhere(session, { id })
  });
  return order;
}
