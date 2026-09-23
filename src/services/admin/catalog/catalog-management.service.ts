import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { paginatedQuery, type PaginatedResult } from '@/lib/pagination';
import { auditAdmin } from '@/lib/admin-audit';
import { SettingsProvider } from '@/lib/settings';
import {
  applyPricingLadder,
  SAFETY_FLOOR_MARKUP,
  TOTAL_MANDATORY_DEDUCTIONS,
  applyBeautifulRounding
} from '@/lib/financial-constants';
import { tenantVisibilityFilter } from '@/lib/tenant-scope';
import { getCostRub } from '@/lib/pricing/currency-invariant';

export type CatalogRow = {
  id: string;
  numericId: number;
  name: string;
  description: string | null;
  icon?: string | null;
  rate: number;
  costPer1kRub?: number | null;
  providerCurrency?: string | null;
  minQty: number;
  maxQty: number;
  markup: number;
  pricePer1000Cents: number;
  isActive: boolean;
  providerId: string | null;
  externalId: string | null;
  providerStatus?: string | null;
  isDripFeedEnabled: boolean;
  isRefillEnabled: boolean;
  isQuarantined?: boolean;
  quarantineReason?: string | null;
  isCancelEnabled?: boolean;
  targetType?: string | null;
  customDataType?: string | null;
  customDataLabel?: string | null;
  isMediaGroupAware?: boolean;
  requireWarning?: boolean;
  warningMessage?: string | null;
  cooldownReason?: string | null;
  clientRequirement?: string | null;
  clientConfirmation?: string | null;
  qualityTier?: string | null;
  createdAt?: Date | string | null;
  category: { id: string; name: string; icon?: string | null; network?: { name: string; slug: string; icon?: string | null } | null };
  _count: { orders: number };
};

export class CatalogManagementService {
  /**
   * Paginated service list with category, markup, and order count.
   */
  static async listServices(params: {
    cursor?: string;
    page?: number;
    search?: string;
    categoryId?: string;
    providerId?: string;
    isActive?: boolean;
    hideDeleted?: boolean;
    providerStatus?: string;
    externalId?: string;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    networkSlug?: string;
    tenantId?: string;
  }): Promise<PaginatedResult<CatalogRow>> {
    const andConditions: Prisma.ServiceWhereInput[] = [];

    if (params.tenantId && params.tenantId !== 'all') {
      andConditions.push({ tenantId: { in: [params.tenantId, 'all'] } });
    }

    if (params.categoryId && params.categoryId !== 'all') {
      andConditions.push({ categoryId: params.categoryId });
    } else if (params.networkSlug && params.networkSlug !== 'ALL' && params.networkSlug !== 'all') {
      andConditions.push({ category: { network: { slug: params.networkSlug } } });
    }

    if (params.providerId && params.providerId !== 'all') {
      andConditions.push({ providerId: params.providerId === 'none' ? null : params.providerId });
    }

    if (params.hideDeleted) {
      andConditions.push({
        isActive: true,
        OR: [
          { cooldownReason: null },
          { cooldownReason: { notIn: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] } },
        ],
      });
    }

    if (params.isActive !== undefined) {
      andConditions.push({ isActive: params.isActive });
    }

    if (params.providerStatus && params.providerStatus !== 'all') {
      if (params.providerStatus === 'active') {
        andConditions.push({
          providerId: { not: null },
          cooldownReason: null,
        });
      } else if (params.providerStatus === 'zombie') {
        andConditions.push({
          cooldownReason: { in: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] },
        });
      } else if (params.providerStatus === 'cooldown') {
        andConditions.push({
          isActive: true,
          cooldownUntil: { gt: new Date() },
          cooldownReason: { notIn: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] },
        });
      } else if (params.providerStatus === 'manual') {
        andConditions.push({
          providerId: null,
        });
      }
    }

    if (params.externalId?.trim()) {
      andConditions.push({ externalId: params.externalId.trim() });
    }

    if (params.search?.trim()) {
      const q = params.search.trim();
      const normalizedNumericQ = q.replace(/^[#№\s]+/, '').replace(/^id[\s:]*/i, '').trim();
      const lowerQ = q.toLowerCase();
      const numId = parseInt(normalizedNumericQ, 10);
      const isPureNumber = !isNaN(numId) && normalizedNumericQ === String(numId);
      const orConditions: Prisma.ServiceWhereInput[] = [];

      if (isPureNumber) {
        orConditions.push({ numericId: numId });
      }

      orConditions.push({ name: { contains: q, mode: 'insensitive' } });
      orConditions.push({ externalId: q });
      if (isPureNumber) {
        orConditions.push({ externalId: String(numId) });
      }

      const providers = await db.provider.findMany({ select: { id: true, name: true } });
      const matchedProvider = providers.find(p => p.id === q || p.name.toLowerCase() === lowerQ);
      if (matchedProvider) {
        orConditions.push({ providerId: matchedProvider.id });
      }

      const networks = await db.network.findMany({ select: { id: true, slug: true } });
      const matchedNetwork = networks.find(n => n.slug === lowerQ || lowerQ.includes(n.slug));
      if (matchedNetwork) {
        orConditions.push({ category: { networkId: matchedNetwork.id } });
      }

      andConditions.push({ OR: orConditions });
    }

    const where: Prisma.ServiceWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    let orderBy: Record<string, 'asc' | 'desc'> = { numericId: 'asc' };
    if (params.sortBy) {
      const order = params.sortOrder || 'asc';
      switch (params.sortBy) {
        case 'id':
          orderBy = { numericId: order };
          break;
        case 'name':
          orderBy = { name: order };
          break;
        case 'rate':
          orderBy = { rate: order };
          break;
        case 'markup':
          orderBy = { markup: order };
          break;
        case 'price':
          orderBy = { pricePer1000Cents: order };
          break;
        default:
          orderBy = { numericId: order };
          break;
      }
    }

    return paginatedQuery<CatalogRow>(db.service as never, {
      cursor: params.cursor,
      page: params.page,
      pageSize: params.pageSize || 50,
      where,
      orderBy,
      include: {
        category: { select: { id: true, name: true, icon: true, network: { select: { name: true, slug: true, icon: true } } } },
        _count: { select: { orders: true } },
      },
    });
  }

  /**
   * Updates service markup and recalculates prices with safety bounds.
   */
  static async updateMarkup(
    serviceId: string,
    newMarkup: number,
    admin: { id: string; email: string }
  ) {
    if (newMarkup < 1.0) throw new Error('Наценка не может быть меньше 1.0 (коэффициент x1)');
    if (newMarkup > 151.0) throw new Error('Наценка не может быть больше 151.0 (15000%)');

    const service = await db.service.findUniqueOrThrow({ where: { id: serviceId } });
    const oldMarkup = service.markup;
    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const costRub = getCostRub(service.rate, service.providerCurrency || 'RUB', usdToRub);

    await db.service.update({
      where: { id: serviceId },
      data: { 
        markup: newMarkup,
        costPer1kRub: costRub,
        pricePer1000Cents: Math.round(applyBeautifulRounding(costRub * newMarkup) * 100)
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'MARKUP_UPDATE',
      target: serviceId,
      targetType: 'SERVICE',
      oldValue: { markup: oldMarkup },
      newValue: { markup: newMarkup },
    });
  }

  /**
   * Toggles service active status with audit logging.
   */
  static async toggleService(serviceId: string, isActive: boolean, admin: { id: string; email: string }) {
    const service = await db.service.findUniqueOrThrow({ where: { id: serviceId } });
    const oldActive = service.isActive;

    await db.service.update({
      where: { id: serviceId },
      data: { 
        isActive,
        cooldownReason: isActive ? null : 'MANUAL_DEACTIVATED',
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isActive ? 'SERVICE_ACTIVATE' : 'SERVICE_DEACTIVATE',
      target: serviceId,
      targetType: 'SERVICE',
      oldValue: { isActive: oldActive },
      newValue: { isActive },
    });
  }

  /**
   * Soft deletes a service (marks inactive and flags cooldown).
   */
  static async softDeleteService(
    serviceId: string,
    admin: { id: string; email: string }
  ) {
    const service = await db.service.findUniqueOrThrow({ where: { id: serviceId } });

    await db.service.update({
      where: { id: serviceId },
      data: {
        isActive: false,
        cooldownReason: 'ZOMBIE_ARCHIVED',
        cooldownUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        name: service.name.startsWith('[ARCHIVED] ')
          ? service.name
          : `[ARCHIVED] ${service.name}`,
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_SOFT_DELETE',
      target: serviceId,
      targetType: 'SERVICE',
      oldValue: { name: service.name, isActive: service.isActive },
      newValue: { archived: true },
    });
  }

  /**
   * Catalog stats for the header and dashboard.
   */
  static async getCatalogStats(tenantId?: string, _startDate?: Date, _endDate?: Date) {
    const where: Prisma.ServiceWhereInput = {};
    if (tenantId && tenantId !== 'all') where.tenantId = { in: [tenantId, 'all'] };

    const categoryWhere: Prisma.CategoryWhereInput = {};
    if (tenantId && tenantId !== 'all') categoryWhere.tenantId = { in: [tenantId, 'all'] };

    const [totalServices, activeServices, categories] = await Promise.all([
      db.service.count({ where }),
      db.service.count({ where: { ...where, isActive: true } }),
      db.category.count({ where: categoryWhere }),
    ]);

    return { totalServices, activeServices, categories };
  }

  /**
   * Bulk updates markup for multiple services matching filter.
   */
  static async bulkUpdateMarkup(
    filter: { categoryId?: string; platform?: string; tenantId?: string; search?: string },
    newMarkup: number,
    admin: { id: string; email: string }
  ): Promise<{ updatedCount: number }> {
    if (newMarkup !== 0 && (newMarkup < 1.0 || newMarkup > 151.0)) {
      throw new Error('Наценка должна быть в диапазоне 1.0–151.0 или 0 (автокалькуляция)');
    }

    const where: Record<string, unknown> = {
      isQuarantined: false
    };
    if (filter.tenantId) where.tenantId = filter.tenantId;
    if (filter.categoryId) where.categoryId = filter.categoryId;
    if (filter.platform) where.category = { network: { slug: filter.platform } };

    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const services = await db.service.findMany({ where, select: { id: true, rate: true, providerCurrency: true } });

    const updates = services.map(s => {
      const costRub = getCostRub(s.rate, s.providerCurrency || 'RUB', usdToRub);
      let calculatedMarkup = newMarkup;
      if (newMarkup <= 0) {
        const retailFromLadder = applyPricingLadder(costRub);
        calculatedMarkup = costRub > 0 ? Math.round((retailFromLadder / costRub) * 100) / 100 : SAFETY_FLOOR_MARKUP;
        if (calculatedMarkup < SAFETY_FLOOR_MARKUP) calculatedMarkup = SAFETY_FLOOR_MARKUP;
      }
      return db.service.update({
        where: { id: s.id },
        data: { 
          markup: calculatedMarkup,
          costPer1kRub: costRub,
          pricePer1000Cents: Math.round(applyBeautifulRounding(costRub * calculatedMarkup) * 100)
        }
      });
    });

    for (let i = 0; i < updates.length; i += 50) {
      await db.$transaction(updates.slice(i, i + 50));
    }

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BULK_MARKUP_UPDATE',
      target: filter.categoryId || filter.platform || 'ALL',
      targetType: 'SERVICE',
      newValue: { markup: newMarkup <= 0 ? 'AUTO' : newMarkup, filter, updatedCount: services.length },
    });

    return { updatedCount: services.length };
  }

  /**
   * Markup Analytics: returns distribution of markups across all services.
   */
  static async getMarkupAnalytics(tenantId?: string): Promise<{
    averageMarkup: number;
    distribution: { label: string; count: number; percentage: number }[];
    autoMarkupCount: number;
    manualMarkupCount: number;
  }> {
    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      ...(tenantId && tenantId !== 'all' ? { tenantId: { in: [tenantId, 'all'] } } : {}),
    };

    const services = await db.service.findMany({
      where,
      select: { markup: true },
    });

    if (services.length === 0) {
      return {
        averageMarkup: 0,
        distribution: [],
        autoMarkupCount: 0,
        manualMarkupCount: 0,
      };
    }

    const brackets = [
      { min: 1.0, max: 1.5, label: '1.0x - 1.5x (Низкая)', count: 0 },
      { min: 1.5, max: 2.0, label: '1.5x - 2.0x (Стандарт)', count: 0 },
      { min: 2.0, max: 3.0, label: '2.0x - 3.0x (Оптимум)', count: 0 },
      { min: 3.0, max: 5.0, label: '3.0x - 5.0x (Высокая)', count: 0 },
      { min: 5.0, max: Infinity, label: '5.0x+ (Максимальная)', count: 0 },
    ];

    let totalMarkup = 0;
    for (const s of services) {
      totalMarkup += s.markup;
      for (const b of brackets) {
        if (s.markup >= b.min && s.markup < b.max) {
          b.count++;
          break;
        }
      }
    }

    const total = services.length;
    return {
      averageMarkup: Math.round((totalMarkup / total) * 100) / 100,
      distribution: brackets.map(b => ({
        label: b.label,
        count: b.count,
        percentage: Math.round((b.count / total) * 100),
      })),
      autoMarkupCount: 0,
      manualMarkupCount: total,
    };
  }

  /**
   * Category list for catalog filter dropdowns.
   */
  static async listCategories(tenantId?: string) {
    const tenantFilter = tenantId && tenantId !== 'all' ? { in: [tenantId, 'all'] } : undefined;
    const rows = await db.category.findMany({
      where: tenantId && tenantId !== 'all' ? { tenantId: tenantVisibilityFilter(tenantId) } : undefined,
      select: {
        id: true,
        name: true,
        network: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        _count: {
          select: {
            services: {
              where: tenantFilter ? { tenantId: tenantFilter } : undefined
            }
          }
        },
      },
      orderBy: { name: 'asc' },
    });

    return rows.map(c => ({
      id: c.id,
      name: c.name,
      network: c.network ? {
        id: c.network.id,
        name: c.network.name,
        slug: c.network.slug
      } : null,
      serviceCount: c._count.services,
    }));
  }

  /**
   * Total count of quarantined services.
   */
  static async getQuarantineCount(tenantId?: string): Promise<number> {
    const tenantWhere = tenantId && tenantId !== 'all' ? { in: [tenantId, 'all'] } : undefined;
    return db.service.count({
      where: {
        isQuarantined: true,
        ...(tenantWhere ? { tenantId: tenantWhere } : {}),
      },
    });
  }

  /**
   * Quick counts of catalog health for the notification badge.
   */
  static async getCatalogHealthCounts(tenantId?: string): Promise<{ quarantine: number; zombies: number; cooldown: number }> {
    const now = new Date();
    const tenantWhere = tenantId && tenantId !== 'all' ? { in: [tenantId, 'all'] } : undefined;

    const [quarantine, zombies, cooldown] = await Promise.all([
      db.service.count({
        where: {
          isQuarantined: true,
          ...(tenantWhere ? { tenantId: tenantWhere } : {}),
        },
      }),
      db.service.count({
        where: {
          cooldownReason: { in: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] },
          ...(tenantWhere ? { tenantId: tenantWhere } : {}),
        },
      }),
      db.service.count({
        where: {
          isActive: true,
          cooldownUntil: { gt: now },
          cooldownReason: { notIn: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] },
          ...(tenantWhere ? { tenantId: tenantWhere } : {}),
        },
      }),
    ]);

    return { quarantine, zombies, cooldown };
  }
}
