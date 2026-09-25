'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdmin } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { redis } from '@/lib/redis';
import { z } from 'zod';

export async function getSmartCampaigns(page: number = 1, limit: number = 20) {
  return requireStaffPermission('orders', 'view', async () => {
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      db.smartCampaign.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true } },
          service: { select: { name: true, category: { select: { name: true } } } },
          tasks: { select: { status: true } },
        },
      }),
      db.smartCampaign.count(),
    ]);

    const formattedCampaigns = campaigns.map((campaign) => {
      const totalTasks = campaign.tasks.length;
      const completedTasks = campaign.tasks.filter((t) => t.status === 'COMPLETED').length;

      return {
        id: campaign.id,
        userEmail: campaign.user.email,
        serviceName: campaign.service.name,
        categoryName: campaign.service.category?.name || 'Без категории',
        link: campaign.link,
        totalQuantity: campaign.totalQuantity,
        totalDays: campaign.totalDays,
        status: campaign.status,
        isTestMode: campaign.isTestMode,
        createdAt: campaign.createdAt,
        progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        tasksCount: totalTasks,
        completedTasksCount: completedTasks,
      };
    });

    return { success: true, data: { campaigns: formattedCampaigns, total, pages: Math.ceil(total / limit) } };
  });
}

export async function updateCampaignStatus(campaignId: string, status: 'RUNNING' | 'PAUSED') {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const campaign = await db.smartCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error('Кампания не найдена');
    }

    if (campaign.status === 'COMPLETED' || campaign.status === 'ERROR') {
      throw new Error('Нельзя изменить статус завершенной или ошибочной кампании');
    }

    const updated = await db.smartCampaign.update({
      where: { id: campaignId },
      data: { status },
    });

    const ipAddress = await getClientIp();
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SMART_DRIP_STATUS_CHANGE',
      target: campaignId,
      targetType: 'ORDER',
      oldValue: { status: campaign.status },
      newValue: { status },
      ipAddress,
    });

    revalidatePath('/admin/smart');
    return { success: true, data: updated };
  });
}

export async function getServiceConfigs() {
  return requireStaffPermission('catalog', 'view', async (admin) => {
    const tenantFilter = admin.tenantId ? { tenantId: admin.tenantId } : {};
    const services = await db.service.findMany({
      where: tenantFilter,
      orderBy: { name: 'asc' },
      include: {
        category: { select: { name: true, network: { select: { name: true, slug: true } } } },
        smartConfig: true,
      },
    });

    return { success: true, data: services };
  });
}

const serviceConfigSchema = z.object({
  isEnabled: z.boolean(),
  isTestMode: z.boolean(),
  minChunk: z.number().int().min(1),
  maxChunk: z.number().int().min(1),
  markup: z.number().min(1.0),
  useInviteBuffer: z.boolean().optional(),
  autoCompensate: z.boolean().optional(),
  checkIntervalMins: z.number().int().min(1).optional(),
});

export async function updateServiceConfig(
  serviceId: string,
  data: {
    isEnabled: boolean;
    isTestMode: boolean;
    minChunk: number;
    maxChunk: number;
    markup: number;
    useInviteBuffer?: boolean;
    autoCompensate?: boolean;
    checkIntervalMins?: number;
  }
) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const parsed = serviceConfigSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message || 'Некорректная конфигурация услуги');
    }
    const validatedData = parsed.data;

    const service = await db.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new Error('Услуга не найдена');
    }

    const oldConfig = await db.serviceSmartConfig.findUnique({
      where: { serviceId },
    });

    const updatedConfig = await db.serviceSmartConfig.upsert({
      where: { serviceId },
      update: {
        isEnabled: data.isEnabled,
        isTestMode: data.isTestMode,
        minChunk: data.minChunk,
        maxChunk: data.maxChunk,
        markup: data.markup,
        useInviteBuffer: data.useInviteBuffer ?? false,
        autoCompensate: data.autoCompensate ?? true,
        checkIntervalMins: data.checkIntervalMins ?? 120,
      },
      create: {
        serviceId,
        isEnabled: data.isEnabled,
        isTestMode: data.isTestMode,
        minChunk: data.minChunk,
        maxChunk: data.maxChunk,
        markup: data.markup,
        useInviteBuffer: data.useInviteBuffer ?? false,
        autoCompensate: data.autoCompensate ?? true,
        checkIntervalMins: data.checkIntervalMins ?? 120,
      },
    });

    const ipAddress = await getClientIp();
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_SMART_CONFIG_UPDATE',
      target: serviceId,
      targetType: 'CATALOG',
      oldValue: oldConfig || {},
      newValue: updatedConfig,
      ipAddress,
    });

    revalidatePath('/admin/smart');
    return { success: true, data: updatedConfig };
  });
}

export async function getSmartGlobalStatus(explicitTenantId?: string) {
  return requireStaffPermission('settings', 'view', async (user, _role, activeTenantId) => {
    const tenantId = explicitTenantId || activeTenantId || user.tenantId || 'smmplan';
    const disabled = (await redis.get(`smart:${tenantId}:disabled`)) === 'true';
    return { success: true, disabled };
  });
}

export async function toggleSmartGlobalStatus(disabled: boolean, explicitTenantId?: string) {
  return requireStaffPermission('settings', 'edit', async (admin, _role, activeTenantId) => {
    const tenantId = explicitTenantId || activeTenantId || admin.tenantId || 'smmplan';
    await redis.set(`smart:${tenantId}:disabled`, String(disabled));

    const ipAddress = await getClientIp();
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SMART_GLOBAL_TOGGLE',
      target: `smart:${tenantId}`,
      targetType: 'SETTINGS',
      oldValue: { disabled: !disabled },
      newValue: { disabled, tenantId },
      ipAddress,
    });

    revalidatePath('/admin/smart');
    return { success: true, disabled };
  });
}

const bulkServiceConfigSchema = z.object({
  isEnabled: z.boolean(),
  isTestMode: z.boolean().optional(),
  minChunk: z.number().int().min(1).optional(),
  maxChunk: z.number().int().min(1).optional(),
  markup: z.number().min(1.0).optional(),
});

export async function bulkUpdateServiceConfigs(
  serviceIds: string[],
  data: {
    isEnabled: boolean;
    isTestMode?: boolean;
    minChunk?: number;
    maxChunk?: number;
    markup?: number;
  }
) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const parsed = bulkServiceConfigSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message || 'Некорректная конфигурация услуг');
    }
    const validatedData = parsed.data;

    if (!serviceIds || serviceIds.length === 0) {
      throw new Error('Не переданы ID услуг');
    }

    const results = [];
    for (const serviceId of serviceIds) {
      const updatedConfig = await db.serviceSmartConfig.upsert({
        where: { serviceId },
        create: {
          serviceId,
          isEnabled: validatedData.isEnabled,
          isTestMode: validatedData.isTestMode ?? false,
          minChunk: validatedData.minChunk ?? 10,
          maxChunk: validatedData.maxChunk ?? 500,
          markup: validatedData.markup ?? 1.5,
        },
        update: {
          isEnabled: validatedData.isEnabled,
          ...(validatedData.isTestMode !== undefined ? { isTestMode: validatedData.isTestMode } : {}),
          ...(validatedData.minChunk !== undefined ? { minChunk: validatedData.minChunk } : {}),
          ...(validatedData.maxChunk !== undefined ? { maxChunk: validatedData.maxChunk } : {}),
          ...(validatedData.markup !== undefined ? { markup: validatedData.markup } : {}),
        },
      });
      results.push(updatedConfig);
    }

    const ipAddress = await getClientIp();
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_SMART_CONFIG_BULK_UPDATE',
      target: `bulk:${serviceIds.length}`,
      targetType: 'CATALOG',
      oldValue: { count: serviceIds.length },
      newValue: { isEnabled: data.isEnabled, isTestMode: data.isTestMode },
      ipAddress,
    });

    revalidatePath('/admin/smart');
    return { success: true, count: results.length };
  });
}
