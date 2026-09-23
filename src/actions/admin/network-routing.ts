'use server';

// ==============================================================
// Network Routing Rules Server Actions (Clash Verge Pattern)
// Enterprise centralized proxy routing management
// ==============================================================

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import type { 
  NetworkRoutingConfig, 
  ServiceTogglesConfig, 
  SubsystemServiceType,
  RoutingTargetType
} from '@/types/provider-proxy';
import { UniversalNetworkRouter, IMMUTABLE_DIRECT_PATTERNS } from '@/lib/network/network-router';

export async function getNetworkRoutingConfigAction(): Promise<
  { success: true; data: NetworkRoutingConfig } | { success: false; error: string }
> {
  return requireStaffPermission('providers', 'view', async () => {
    const config = await UniversalNetworkRouter.getConfig();
    return { success: true, data: config };
  });
}

export async function saveNetworkRoutingConfigAction(
  newConfig: NetworkRoutingConfig
): Promise<{ success: true; data: NetworkRoutingConfig } | { success: false; error: string }> {
  return requireStaffPermission('providers', 'edit', async (user) => {
    // Validate rules
    if (!newConfig || !Array.isArray(newConfig.rules)) {
      throw new Error('Некорректный формат конфигурации правил');
    }

    // Ensure Russian fintech invariants cannot be overridden by user
    // Ensure Russian fintech invariants cannot be overridden by foreign untrusted proxies
    for (const rule of newConfig.rules) {
      const lowerPayload = (rule.payload || '').toLowerCase().trim();
      for (const locked of IMMUTABLE_DIRECT_PATTERNS) {
        if (
          (lowerPayload === locked || lowerPayload.endsWith('.' + locked)) &&
          rule.target !== 'DIRECT' &&
          rule.target !== 'RU_SOVEREIGN_POOL'
        ) {
          throw new Error(`Домен ${locked} является критическим узлом РФ и может быть направлен только DIRECT или через суверенный резерв (RU_SOVEREIGN_POOL).`);
        }
      }
    }

    // Save to SystemSettings.geminiProxy if systemProxyUrl changed
    if (newConfig.systemProxyUrl !== undefined) {
      await db.systemSettings.updateMany({
        where: { id: 'smmplan' },
        data: {
          geminiProxy: newConfig.systemProxyUrl ? newConfig.systemProxyUrl.trim() : null
        }
      });
    }

    // Update in-memory router & invalidate cache
    UniversalNetworkRouter.invalidateCache();

    const ip = await getClientIp();
    await auditAdminAwaitable({
      adminId: user.id,
      adminEmail: user.email,
      action: 'UPDATE_NETWORK_ROUTING_RULES',
      targetType: 'SYSTEM_SETTINGS',
      target: 'network_router',
      ipAddress: ip,
      newValue: {
        rulesCount: newConfig.rules.length,
        serviceToggles: newConfig.serviceToggles,
        systemProxyUrl: newConfig.systemProxyUrl
      }
    });

    revalidatePath('/admin/settings');
    return { success: true, data: newConfig };
  });
}

export async function updateServiceToggleAction(
  service: keyof ServiceTogglesConfig,
  target: RoutingTargetType,
  proxyId?: string | null
): Promise<{ success: true; data: ServiceTogglesConfig } | { success: false; error: string }> {
  return requireStaffPermission('providers', 'edit', async (user) => {
    if (service === 'paymentsRu' && target !== 'DIRECT' && target !== 'RU_SOVEREIGN_POOL') {
      throw new Error('Российские платежные шлюзы (ЮKassa, Robokassa) разрешено направлять только DIRECT или через суверенный резерв (RU_SOVEREIGN_POOL).');
    }

    const currentConfig = await UniversalNetworkRouter.getConfig();
    const updatedToggles: ServiceTogglesConfig = {
      ...currentConfig.serviceToggles,
      [service]: target as any,
      [`${String(service)}ProxyId`]: proxyId || null
    };

    const newConfig: NetworkRoutingConfig = {
      ...currentConfig,
      serviceToggles: updatedToggles
    };

    UniversalNetworkRouter.invalidateCache();

    const ip = await getClientIp();
    await auditAdminAwaitable({
      adminId: user.id,
      adminEmail: user.email,
      action: 'UPDATE_SERVICE_PROXY_TOGGLE',
      targetType: 'SYSTEM_SETTINGS',
      target: service,
      ipAddress: ip,
      newValue: { service, target, proxyId }
    });

    revalidatePath('/admin/settings');
    return { success: true, data: updatedToggles };
  });
}

export async function inspectRouteAction(
  url: string,
  service?: SubsystemServiceType
): Promise<
  | { success: true; data: Awaited<ReturnType<typeof UniversalNetworkRouter.inspectRoute>> }
  | { success: false; error: string }
> {
  return requireStaffPermission('providers', 'view', async () => {
    if (!url || !url.trim()) {
      throw new Error('Укажите корректный URL для проверки');
    }
    const report = await UniversalNetworkRouter.inspectRoute(url.trim(), service);
    return { success: true, data: report };
  });
}