'use server';

import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';

export type SearchHit = {
  id: string;
  type: 'USER' | 'ORDER' | 'SERVICE';
  title: string;
  subtitle: string;
  href: string;
};

export async function globalOmniSearch(query: string): Promise<SearchHit[]> {
  const session = await verifySession();
  if (!session) return [];

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { staffRole: { include: { permissions: true } } },
  });

  if (!user || user.role === 'BANNED' || user.role === 'USER') return [];

  if (!query || query.length < 2) return [];

  const isSuperAdmin = user.role === 'OWNER' || user.role === 'ADMIN';
  const permissions = user.staffRole?.permissions || [];

  const canSearchClients = isSuperAdmin || permissions.some(
    p => p.section.toUpperCase() === 'CLIENTS' && (p.canView || p.canEdit)
  );
  const canSearchOrders = isSuperAdmin || permissions.some(
    p => p.section.toUpperCase() === 'ORDERS' && (p.canView || p.canEdit)
  );
  const canSearchCatalog = isSuperAdmin || permissions.some(
    p => p.section.toUpperCase() === 'CATALOG' && (p.canView || p.canEdit)
  );

  const hits: SearchHit[] = [];
  const qLower = query.toLowerCase();
  const tenantFilter = user.tenantId ? { tenantId: user.tenantId } : {};

  // 1. Search Users by Email (only if permitted)
  if (canSearchClients && (qLower.includes('@') || qLower.length > 3)) {
    const users = await db.user.findMany({
      where: {
        email: { contains: qLower, mode: 'insensitive' },
        ...tenantFilter
      },
      take: 5,
    });
    users.forEach((u) =>
      hits.push({
        id: u.id,
        type: 'USER',
        title: u.email,
        subtitle: `Баланс: ${(Number(u.balance) / 100).toFixed(2)} ₽ | Роль: ${u.role}`,
        href: `/admin/clients?q=${encodeURIComponent(u.email)}`,
      })
    );
  }

  // 2. Search Orders by numeric ID or external ID (only if permitted)
  const numId = parseInt(query.trim(), 10);
  if (canSearchOrders && !isNaN(numId)) {
    const orders = await db.order.findMany({
      where: {
        OR: [{ numericId: numId }, { externalId: query.trim() }],
        ...tenantFilter
      },
      take: 5,
      include: { user: true, service: { include: { category: true } } },
    });

    orders.forEach((o) =>
      hits.push({
        id: o.id,
        type: 'ORDER',
        title: `Заказ #${o.numericId} (API: ${o.externalId || 'Нет'})`,
        subtitle: `${o.service.category.name} - ${o.status}`,
        href: `/admin/orders?edit_order_id=${o.id}`,
      })
    );
  }

  // 3. Search Services by Name (only if permitted)
  if (canSearchCatalog && isNaN(numId) && qLower.length > 2) {
    const services = await db.service.findMany({
      where: {
        name: { contains: qLower, mode: 'insensitive' },
        ...tenantFilter
      },
      take: 5,
      include: { category: true },
    });
    services.forEach((s) =>
      hits.push({
        id: s.id,
        type: 'SERVICE',
        title: s.name,
        subtitle: `ID: ${s.numericId} | ${s.category.name}`,
        href: `/admin/catalog?service_id=${s.numericId}`,
      })
    );
  }

  return hits;
}
