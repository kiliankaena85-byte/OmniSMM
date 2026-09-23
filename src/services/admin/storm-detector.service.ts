import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

export interface StormServiceAlert {
  serviceId: string;
  serviceName: string;
  networkName: string;
  categoryName: string;
  providerName: string;
  ordersCount: number;
  cancelCount: number;
  distinctUsersCount: number;
  failureRate: number; // in percentage e.g. 55%
  severity: 'WARNING' | 'CRITICAL';
  sampleOrderIds: number[];
  sampleExternalIds: string[];
  ticketTemplate: string;
  detectedAt: Date;
}

export interface StormRadarReport {
  isShadowMode: boolean;
  windowHours: number;
  totalAuditedServices: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  alerts: StormServiceAlert[];
}

class StormDetectorService {
  /**
   * Safe list of errors that indicate USER FAULT, not a provider/social network storm.
   * These are excluded from the storm calculation.
   */
  private readonly USER_FAULT_KEYWORDS = [
    'invalid link',
    'private account',
    'private profile',
    'account not found',
    'bad url',
    'already completed',
    'profile is private',
    'link unreachable',
    'неверная ссылка',
    'приватный аккаунт',
    'закрытый профиль',
  ];

  private isUserFault(errorMsg: string | null | undefined): boolean {
    if (!errorMsg) return false;
    const lower = errorMsg.toLowerCase();
    return this.USER_FAULT_KEYWORDS.some(kw => lower.includes(kw));
  }

  /**
   * Run the rolling-window storm audit with fail-safe guardrails.
   */
  async auditServiceStorms(options: {
    windowHours?: number;
    minOrders?: number;
    minUsers?: number;
    tenantId?: string;
  } = {}): Promise<StormRadarReport> {
    const {
      windowHours = 24,
      minOrders = 2, // Low threshold for development/early detection, >= 2 in test
      minUsers = 1,
      tenantId
    } = options;

    const cacheKey = `admin:storm_report:${tenantId || 'all'}:${windowHours}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as StormRadarReport;
      }
    } catch {
      // Redis fallback to DB query
    }

    const isSingleTenant = tenantId && tenantId !== 'all';
    const cutoffDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    // Fetch all orders created in the rolling window
        const where: Prisma.OrderWhereInput = {
      createdAt: { gte: cutoffDate },
    };
    if (isSingleTenant) {
      where.tenantId = tenantId;
    }

    const orders = await db.order.findMany({
      where,
      select: {
        id: true,
        numericId: true,
        externalId: true,
        status: true,
        error: true,
        userId: true,
        serviceId: true,
        service: {
          select: {
            id: true,
            name: true,
            provider: { select: { name: true } },
            category: {
              select: {
                name: true,
                network: { select: { name: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 1000
    });

    // Group orders by serviceId
    const serviceMap = new Map<string, {
      service: NonNullable<(typeof orders)[0]['service']>;
      totalOrders: number;
      canceledOrders: number;
      distinctUserIds: Set<string>;
      sampleNumericIds: number[];
      sampleExternalIds: string[];
    }>();

    for (const o of orders) {
      if (!o.service) continue;
      const sId = o.service.id;

      if (!serviceMap.has(sId)) {
        serviceMap.set(sId, {
          service: o.service,
          totalOrders: 0,
          canceledOrders: 0,
          distinctUserIds: new Set<string>(),
          sampleNumericIds: [],
          sampleExternalIds: []
        });
      }

      const entry = serviceMap.get(sId)!;
      entry.totalOrders += 1;
      entry.distinctUserIds.add(o.userId);

      // Check if order was canceled due to provider fault (not user link error)
      const isCanceledOrError = o.status === 'CANCELED' || o.status === 'ERROR' || o.status === 'PARTIAL';
      const userError = this.isUserFault(o.error);

      if (isCanceledOrError && !userError) {
        entry.canceledOrders += 1;
        if (entry.sampleNumericIds.length < 5) {
          entry.sampleNumericIds.push(o.numericId);
        }
        if (o.externalId && entry.sampleExternalIds.length < 5) {
          entry.sampleExternalIds.push(o.externalId);
        }
      }
    }

    const alerts: StormServiceAlert[] = [];
    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    for (const [sId, data] of serviceMap.entries()) {
      // Guardrail 1: Minimum sample size & distinct users
      if (data.totalOrders < minOrders || data.distinctUserIds.size < minUsers) {
        healthyCount += 1;
        continue;
      }

      const failureRate = Math.round((data.canceledOrders / data.totalOrders) * 100);

      if (failureRate >= 45) {
        criticalCount += 1;
        const extIdsStr = data.sampleExternalIds.length > 0 
          ? data.sampleExternalIds.join(', ')
          : data.sampleNumericIds.map(id => `#${id}`).join(', ');

        const ticketTemplate = `Здравствуйте! По услуге "${data.service.name}" наблюдаются массовые автоматические отмены заказов (${failureRate}% сбоев за последние ${windowHours}ч). Примеры упавших заказов: [${extIdsStr}]. Подскажите, проводятся ли техработы на стороне соцсети и когда ожидается стабилизация потока?`;

        alerts.push({
          serviceId: sId,
          serviceName: data.service.name,
          networkName: data.service.category?.network?.name || '—',
          categoryName: data.service.category?.name || '—',
          providerName: data.service.provider?.name || 'Основной поставщик',
          ordersCount: data.totalOrders,
          cancelCount: data.canceledOrders,
          distinctUsersCount: data.distinctUserIds.size,
          failureRate,
          severity: 'CRITICAL',
          sampleOrderIds: data.sampleNumericIds,
          sampleExternalIds: data.sampleExternalIds,
          ticketTemplate,
          detectedAt: new Date()
        });
      } else if (failureRate >= 25) {
        warningCount += 1;
        alerts.push({
          serviceId: sId,
          serviceName: data.service.name,
          networkName: data.service.category?.network?.name || '—',
          categoryName: data.service.category?.name || '—',
          providerName: data.service.provider?.name || 'Основной поставщик',
          ordersCount: data.totalOrders,
          cancelCount: data.canceledOrders,
          distinctUsersCount: data.distinctUserIds.size,
          failureRate,
          severity: 'WARNING',
          sampleOrderIds: data.sampleNumericIds,
          sampleExternalIds: data.sampleExternalIds,
          ticketTemplate: '',
          detectedAt: new Date()
        });
      } else {
        healthyCount += 1;
      }
    }

    // Sort alerts by severity (CRITICAL first), then highest failure rate
    alerts.sort((a, b) => {
      if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
      if (b.severity === 'CRITICAL' && a.severity !== 'CRITICAL') return 1;
      return b.failureRate - a.failureRate;
    });

    const report: StormRadarReport = {
      isShadowMode: true, // Stage 1: Safe Shadow Monitoring
      windowHours,
      totalAuditedServices: serviceMap.size,
      healthyCount,
      warningCount,
      criticalCount,
      alerts
    };

    try {
      await redis.set(cacheKey, JSON.stringify(report), 'EX', 60);
    } catch {
      // Redis write failure is non-fatal
    }

    return report;
  }
}

export const stormDetectorService = new StormDetectorService();
