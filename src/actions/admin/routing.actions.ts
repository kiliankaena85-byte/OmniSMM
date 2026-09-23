'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requireStaffPermission } from '@/lib/server/rbac';
import { revalidatePath } from 'next/cache';
import { SettingsProvider } from '@/lib/settings';
import { applyBeautifulRounding } from '@/lib/financial-constants';
import { providerService } from '@/services/providers/provider.service';
import { auditAdminAwaitable } from '@/lib/admin-audit';

const swapSchema = z.object({
  serviceId: z.string(),
  newRouteId: z.string(),
  reason: z.string().min(5, "Пожалуйста, укажите причину переключения (минимум 5 символов)"),
  understandRisk: z.boolean().refine(val => val === true, "Вы должны подтвердить понимание рисков")
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getServiceRoutes(serviceId: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return requireStaffPermission('catalog', 'view', async (admin) => {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      include: { provider: true }
    });
    
    if (!service) throw new Error("Услуга не найдена");

    const routes = await db.serviceRoute.findMany({
      where: { serviceId },
      include: { provider: true },
      orderBy: { priority: 'asc' }
    });

    return { service, routes };
  });
}

export async function previewHotSwap(serviceId: string, newRouteId: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      include: { provider: true }
    });
    if (!service) throw new Error("Услуга не найдена");

    const targetRoute = await db.serviceRoute.findUnique({
      where: { id: newRouteId },
      include: { provider: true }
    });
    if (!targetRoute) throw new Error("Целевой маршрут не найден");

    const recentOrders = await db.order.count({
      where: { 
        serviceId, 
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        ...(service.tenantId ? { tenantId: service.tenantId } : {})
      }
    });

    const existingActiveOrders = await db.order.count({
      where: {
        serviceId,
        status: { in: ['AWAITING_PAYMENT', 'PENDING', 'IN_PROGRESS'] },
        ...(service.tenantId ? { tenantId: service.tenantId } : {})
      }
    });

    return {
      success: true,
      data: {
        currentProvider: service.provider?.name || "Unknown",
        targetProvider: targetRoute.provider.name,
        estimatedDailyOrders: recentOrders,
        unaffectedExistingOrders: existingActiveOrders,
        warning: "Внимание: Убедитесь, что лимиты (Min/Max) у нового провайдера совпадают с текущими настройками услуги."
      }
    };
  });
}

export async function executeHotSwap(input: z.infer<typeof swapSchema>) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const parsed = swapSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0].message);
    }

    const { serviceId, newRouteId, reason } = parsed.data;

    await db.$transaction(async (tx) => {
      const service = await tx.service.findUnique({
        where: { id: serviceId }
      });
      if (!service) throw new Error("Услуга не найдена");

      const targetRoute = await tx.serviceRoute.findUnique({
        where: { id: newRouteId },
        include: { provider: true }
      });
      if (!targetRoute) throw new Error("Маршрут не найден");
      if (!targetRoute.isActive) throw new Error("Целевой маршрут отключен");

      const oldProviderId = service.providerId;

      // 1. LIVE-check: Fetch fresh services from Provider API to prevent arbitrage and verify availability
      if (!targetRoute.provider) throw new Error("У целевого маршрута отсутствует конфигурация провайдера");
      const providerInstance = await providerService.getProviderInstance(targetRoute.provider);
      const liveServices = await providerService.getServicesWithCache(targetRoute.provider, providerInstance, false);
      const liveSvc = liveServices.find(s => s.service.toString() === targetRoute.providerServiceId.toString());

      if (!liveSvc) {
        throw new Error(`Целевой провайдер не предоставляет услугу с внешним ID ${targetRoute.providerServiceId}`);
      }

      const rawRate = parseFloat(liveSvc.rate);
      if (isNaN(rawRate) || rawRate <= 0) {
        throw new Error(`Целевой провайдер вернул невалидный тариф ${liveSvc.rate} для услуги ${targetRoute.providerServiceId}`);
      }

      const newRate = rawRate;

      // 2. Fetch shadow catalog record in DB to keep it updated as well
      const shadowSvc = await tx.shadowService.findUnique({
        where: {
          providerId_externalId: {
            providerId: targetRoute.providerId,
            externalId: String(targetRoute.providerServiceId)
          }
        }
      });
      if (shadowSvc) {
        await tx.shadowService.update({
          where: { id: shadowSvc.id },
          data: { rate: newRate }
        });
      }

      const usdToRub = await SettingsProvider.getExchangeRateUSD();
      const newProviderCurrency = targetRoute.provider?.balanceCurrency || 'USD';
      const exchangeRate = newProviderCurrency === 'RUB' ? 1.0 : usdToRub;
      const SAFETY_FLOOR_MARKUP = 1.5; // fallback
      const newPricePer1000Cents = Math.round(
        applyBeautifulRounding(newRate * Math.max(service.markup, SAFETY_FLOOR_MARKUP) * exchangeRate) * 100
      );

      await tx.serviceRoute.updateMany({
        where: { serviceId, isPrimary: true },
        data: { isPrimary: false }
      });

      await tx.serviceRoute.update({
        where: { id: newRouteId },
        data: { isPrimary: true }
      });

      await tx.service.update({
        where: { id: serviceId },
        data: {
          providerId: targetRoute.providerId,
          externalId: targetRoute.providerServiceId,
          rate: newRate,
          pricePer1000Cents: newPricePer1000Cents,
          providerCurrency: newProviderCurrency
        }
      });

      await tx.routingAuditLog.create({
        data: {
          serviceId,
          action: 'SWAP',
          fromProviderId: oldProviderId,
          toProviderId: targetRoute.providerId,
          reason,
          adminId: admin.id
        }
      });
    });

    revalidatePath(`/admin/services/${serviceId}/routing`);
    revalidatePath('/admin/catalog');
    return { success: true };
  });
}

const addRouteSchema = z.object({
  serviceId: z.string(),
  providerId: z.string(),
  providerServiceId: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/, "Неверный формат внешнего ID"),
});

export async function addServiceRoute(input: z.infer<typeof addRouteSchema>) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const parsed = addRouteSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0].message);
    }
    const { serviceId, providerId, providerServiceId } = parsed.data;

    await db.$transaction(async (tx) => {
      const service = await tx.service.findUnique({ where: { id: serviceId } });
      if (!service) throw new Error("Услуга не найдена");

      const provider = await tx.provider.findUnique({ where: { id: providerId } });
      if (!provider || !provider.isActive) throw new Error("Провайдер не найден или отключен");

      const existingRoute = await tx.serviceRoute.findUnique({
        where: {
          serviceId_providerId: { serviceId, providerId }
        }
      });
      if (existingRoute) throw new Error("Маршрут для этого провайдера уже существует");

      const routesCount = await tx.serviceRoute.count({ where: { serviceId } });
      const isPrimary = routesCount === 0;

      const maxPriorityRoute = await tx.serviceRoute.findFirst({
        where: { serviceId },
        orderBy: { priority: 'desc' }
      });
      const priority = maxPriorityRoute ? maxPriorityRoute.priority + 1 : 0;

      await tx.serviceRoute.create({
        data: {
          serviceId,
          providerId,
          providerServiceId,
          isPrimary,
          isActive: true,
          priority,
          failoverMode: "manual"
        }
      });

      await tx.routingAuditLog.create({
        data: {
          serviceId,
          action: 'ADD_ROUTE',
          toProviderId: providerId,
          reason: `Добавлен маршрут (Внешний ID: ${providerServiceId})`,
          adminId: admin.id
        }
      });
    });

    revalidatePath(`/admin/services/${serviceId}/routing`);
    revalidatePath('/admin/catalog');
    return { success: true };
  });
}

export async function toggleRouteStatus(routeId: string) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    let serviceId = '';
    await db.$transaction(async (tx) => {
      const route = await tx.serviceRoute.findUnique({ where: { id: routeId } });
      if (!route) throw new Error("Маршрут не найден");
      serviceId = route.serviceId;

      if (route.isPrimary) {
        throw new Error("Нельзя отключить Primary маршрут");
      }

      if (route.isActive) { // Turning off
        const activeRoutesCount = await tx.serviceRoute.count({
          where: { serviceId: route.serviceId, isActive: true }
        });
        if (activeRoutesCount <= 1) {
          throw new Error("Нельзя отключить единственный активный маршрут");
        }
      }

      await tx.serviceRoute.update({
        where: { id: routeId },
        data: { isActive: !route.isActive }
      });

      await tx.routingAuditLog.create({
        data: {
          serviceId: route.serviceId,
          action: 'TOGGLE_STATUS',
          reason: `Статус маршрута ${route.providerId} изменен на ${!route.isActive}`,
          adminId: admin.id
        }
      });
    });
    
    revalidatePath(`/admin/services/${serviceId}/routing`);
    return { success: true };
  });
}

export async function changeRoutePriority(routeId: string, direction: 'up' | 'down') {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    let serviceId = '';
    await db.$transaction(async (tx) => {
      const route = await tx.serviceRoute.findUnique({ where: { id: routeId } });
      if (!route) throw new Error("Маршрут не найден");
      serviceId = route.serviceId;

      const siblingRoute = await tx.serviceRoute.findFirst({
        where: {
          serviceId: route.serviceId,
          priority: direction === 'up' ? { lt: route.priority } : { gt: route.priority }
        },
        orderBy: { priority: direction === 'up' ? 'desc' : 'asc' }
      });

      if (!siblingRoute) {
         return; // Cannot move further
      }

      await tx.serviceRoute.update({
        where: { id: route.id },
        data: { priority: siblingRoute.priority }
      });

      await tx.serviceRoute.update({
        where: { id: siblingRoute.id },
        data: { priority: route.priority }
      });
    });

    revalidatePath(`/admin/services/${serviceId}/routing`);
    return { success: true };
  });
}

export async function deleteServiceRoute(routeId: string) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    let serviceId = '';
    await db.$transaction(async (tx) => {
      const route = await tx.serviceRoute.findUnique({ where: { id: routeId } });
      if (!route) throw new Error("Маршрут не найден");
      serviceId = route.serviceId;

      if (route.isPrimary) {
        throw new Error("Нельзя удалить Primary маршрут. Сначала назначьте другой маршрут основным.");
      }

      const routeService = await tx.service.findUnique({
        where: { id: route.serviceId },
        select: { tenantId: true }
      });

      const activeOrders = await tx.order.count({
        where: {
          serviceId: route.serviceId,
          providerId: route.providerId,
          status: { in: ['AWAITING_PAYMENT', 'PENDING', 'IN_PROGRESS'] },
          ...(routeService?.tenantId ? { tenantId: routeService.tenantId } : {})
        }
      });

      if (activeOrders > 0) {
        throw new Error(`Нельзя удалить маршрут: есть ${activeOrders} активных заказов у этого провайдера.`);
      }

      await tx.serviceRoute.delete({ where: { id: routeId } });

      await tx.routingAuditLog.create({
        data: {
          serviceId: route.serviceId,
          action: 'DELETE_ROUTE',
          reason: `Маршрут удален (Провайдер: ${route.providerId})`,
          adminId: admin.id
        }
      });
    });

    revalidatePath(`/admin/services/${serviceId}/routing`);
    return { success: true };
  });
}

export async function getProviderComparisonData(serviceId: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return requireStaffPermission('catalog', 'view', async (admin) => {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      include: { category: true, provider: true }
    });
    if (!service) throw new Error("Услуга не найдена");

    const routes = await db.serviceRoute.findMany({
      where: { serviceId },
      include: { provider: true },
      orderBy: { priority: 'asc' }
    });

    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const providerIds = Array.from(new Set(routes.map(r => r.providerId).filter(Boolean)));

    // Batch query 1: Fetch all route orders in a single SQL query
    const allRouteOrders = providerIds.length > 0 ? await db.order.findMany({
      where: {
        serviceId,
        providerId: { in: providerIds },
        createdAt: { gte: last7Days },
        ...(service.tenantId ? { tenantId: service.tenantId } : {})
      },
      select: {
        providerId: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    }) : [];

    // Group orders by providerId in-memory
    const ordersByProvider = new Map<string, typeof allRouteOrders>();
    for (const order of allRouteOrders) {
      if (!order.providerId) continue;
      const list = ordersByProvider.get(order.providerId) || [];
      list.push(order);
      ordersByProvider.set(order.providerId, list);
    }

    // Batch query 2: Fetch all shadow services in a single SQL query
    const shadowConditions = routes
      .filter(r => r.providerId && r.providerServiceId)
      .map(r => ({ providerId: r.providerId, externalId: String(r.providerServiceId) }));

    const allShadowSvcs = shadowConditions.length > 0 ? await db.shadowService.findMany({
      where: { OR: shadowConditions }
    }) : [];

    const shadowMap = new Map<string, typeof allShadowSvcs[0]>();
    for (const s of allShadowSvcs) {
      shadowMap.set(`${s.providerId}_${s.externalId}`, s);
    }

    const comparisonData = routes.map((route) => {
      // 1. Fetch SLA and ETA from grouped orders
      const routeOrders = ordersByProvider.get(route.providerId) || [];

      const terminalOrders = routeOrders.filter(o => ['COMPLETED', 'PARTIAL', 'CANCELED', 'ERROR'].includes(o.status));
      const totalTerminal = terminalOrders.length;
      const successful = routeOrders.filter(o => ['COMPLETED', 'PARTIAL'].includes(o.status)).length;
      const sla = totalTerminal > 0 ? (successful / totalTerminal) * 100 : 100.0;

      const completedOrders = routeOrders.filter(o => o.status === 'COMPLETED');
      let avgEtaSeconds = 0;
      if (completedOrders.length > 0) {
        const totalDuration = completedOrders.reduce((sum, o) => {
          const duration = (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 1000;
          return sum + duration;
        }, 0);
        avgEtaSeconds = Math.round(totalDuration / completedOrders.length);
      }

      // 2. Fetch real-time provider rate from in-memory shadowMap
      const shadowSvc = shadowMap.get(`${route.providerId}_${String(route.providerServiceId)}`);
      let providerRate: number | null = null;
      let providerMinQty: number | null = null;
      let providerMaxQty: number | null = null;

      if (shadowSvc) {
        providerRate = shadowSvc.rate;
        providerMinQty = shadowSvc.min;
        providerMaxQty = shadowSvc.max;
      }

      // 3. Fallback to DB properties if primary route and cache is missing/cold
      if (providerRate === null && route.isPrimary) {
        providerRate = service.rate;
        providerMinQty = service.minQty;
        providerMaxQty = service.maxQty;
      }

      // 4. Per-unit calculations
      let procurementRatePer1kUsd: number | null = null;
      let procurementRatePer1kRub: number | null = null;
      let procurementCostPerUnitUsd: number | null = null;
      let procurementCostPerUnitRub: number | null = null;
      let marginPerUnitRub: number | null = null;
      let markupPercent: number | null = null;

      if (providerRate !== null) {
        const currency = route.provider.balanceCurrency || 'USD';
        if (currency === 'RUB') {
          procurementRatePer1kRub = providerRate;
          procurementRatePer1kUsd = providerRate / usdToRub;
        } else {
          procurementRatePer1kUsd = providerRate;
          procurementRatePer1kRub = providerRate * usdToRub;
        }

        procurementCostPerUnitUsd = procurementRatePer1kUsd / 1000;
        procurementCostPerUnitRub = procurementRatePer1kRub / 1000;

        const rateExchange = service.providerCurrency === 'RUB' ? 1.0 : usdToRub;
        const retailPricePerUnitRub = applyBeautifulRounding(service.rate * service.markup * rateExchange) / 1000;
        marginPerUnitRub = retailPricePerUnitRub - procurementCostPerUnitRub;
        markupPercent = procurementCostPerUnitRub > 0 ? (marginPerUnitRub / procurementCostPerUnitRub) * 100 : 0;
      }

      // 5. Detect limit incompatibility
      let limitsMismatch = false;
      if (providerMinQty !== null && providerMaxQty !== null) {
        limitsMismatch = providerMinQty > service.minQty || providerMaxQty < service.maxQty;
      }

      return {
        routeId: route.id,
        providerId: route.providerId,
        providerName: route.provider.name,
        providerServiceId: route.providerServiceId,
        isPrimary: route.isPrimary,
        isActive: route.isActive,
        sla,
        avgEtaSeconds,
        providerMinQty,
        providerMaxQty,
        procurementRatePer1kUsd,
        procurementRatePer1kRub,
        procurementCostPerUnitUsd,
        procurementCostPerUnitRub,
        marginPerUnitRub,
        markupPercent,
        limitsMismatch
      };
    });

    return {
      success: true as const,
      data: comparisonData
    };
  });
}

export async function ensurePrimaryRouteAction(serviceId: string) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { id: true, providerId: true, externalId: true, name: true }
    });
    if (!service) return { success: false as const, error: 'Услуга не найдена' };
    if (!service.providerId || !service.externalId) {
      return { success: false as const, error: 'У услуги не задан провайдер или внешний ID' };
    }

    const existing = await db.serviceRoute.findFirst({ where: { serviceId } });
    if (existing) return { success: true as const, created: false, routeId: existing.id };

    // Invariant guard: verify providerServiceId is not corrupted
    const { assertValidServiceRoute } = await import('@/lib/validators/service-route-validator');
    try {
      await assertValidServiceRoute({
        serviceId,
        providerId: service.providerId,
        providerServiceId: service.externalId,
        isPrimary: true
      });
    } catch (valErr: any) {
      return { success: false as const, error: valErr.message || 'Ошибка валидации маршрута' };
    }

    // Идемпотентно: параллельное открытие двумя вкладками → уникальный constraint,
    // ловим P2002 и возвращаем существующий маршрут
    try {
      const route = await db.serviceRoute.create({
        data: {
          serviceId,
          providerId: service.providerId,
          providerServiceId: service.externalId,
          isPrimary: true,
          isActive: true,
          priority: 0,
          failoverMode: 'manual'
        }
      });
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'ROUTE_ENSURE_PRIMARY',
        target: serviceId,
        targetType: 'SERVICE',
        newValue: { routeId: route.id, providerId: service.providerId }
      });
      return { success: true as const, created: true, routeId: route.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existingRoute = await db.serviceRoute.findFirst({ where: { serviceId } });
        return { success: true as const, created: false, routeId: existingRoute?.id };
      }
      throw e;
    }
  });
}


