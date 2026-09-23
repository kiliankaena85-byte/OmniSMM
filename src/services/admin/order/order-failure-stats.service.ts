import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export class OrderFailureStatsService {
  /**
   * Get refund and failure monitoring stats
   */
  static async getRefundAndFailureStats(startDate?: Date, endDate?: Date, tenantId?: string) {
    const isSingleTenant = tenantId && tenantId !== 'all';
    const where: Prisma.OrderWhereInput = { AND: [] };
    if (startDate && endDate) where.createdAt = { gte: startDate, lte: endDate };
    if (isSingleTenant) where.tenantId = tenantId;

    const [totalOrders, canceledOrders, partialOrders, errorOrders] = await Promise.all([
      db.order.count({ where }),
      db.order.count({ where: { ...where, status: 'CANCELED' } }),
      db.order.count({ where: { ...where, status: 'PARTIAL' } }),
      db.order.count({ where: { ...where, status: 'ERROR' } }),
    ]);

    const problematicCount = canceledOrders + partialOrders + errorOrders;
    const failureRate = totalOrders > 0 ? ((problematicCount / totalOrders) * 100).toFixed(1) : '0';

    const problematicOrders = await db.order.findMany({
      where: { ...where, status: { in: ['CANCELED', 'PARTIAL', 'ERROR'] } },
      select: {
        charge: true,
        status: true,
        service: {
          select: {
            name: true,
            category: { select: { network: { select: { name: true } } } },
          },
        },
      },
      take: 50,
    });

    let totalRefundsKopecks = BigInt(0);
    const serviceFailMap = new Map<string, { name: string; network: string; count: number }>();

    for (const po of problematicOrders) {
      totalRefundsKopecks += BigInt(po.charge);
      const sName = po.service?.name || 'Неизвестная услуга';
      const netName = po.service?.category?.network?.name || '—';
      const cur = serviceFailMap.get(sName) || { name: sName, network: netName, count: 0 };
      cur.count += 1;
      serviceFailMap.set(sName, cur);
    }

    const topFailingServices = Array.from(serviceFailMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      totalOrders,
      canceledOrders,
      partialOrders,
      errorOrders,
      problematicCount,
      failureRate,
      totalRefundsKopecks,
      topFailingServices,
    };
  }
}
