'use server';

import { requireStaffPermission } from "@/lib/server/rbac";
import {
  providerBalanceService,
  CachedProviderBalance,
  GlobalLiquiditySummary,
} from "@/services/admin/provider-balance.service";

export type ProviderBalanceActionResult =
  | { success: true; data: CachedProviderBalance }
  | { success: false; error: string };

export type AllProviderBalancesActionResult =
  | { success: true; data: CachedProviderBalance[] }
  | { success: false; error: string };

export type GlobalLiquidityActionResult =
  | ({ success: true; data: GlobalLiquiditySummary } & GlobalLiquiditySummary)
  | { success: false; error: string };

/**
 * Server Action: Fetches cached balance and health status for a single provider.
 */
export async function getProviderBalanceAction(
  providerId: string,
  forceRefresh = false
): Promise<ProviderBalanceActionResult> {
  return requireStaffPermission('providers', 'view', async () => {
    try {
      const data = await providerBalanceService.getProviderBalance(providerId, forceRefresh);
      return { success: true, data };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Не удалось получить баланс провайдера.';
      return { success: false, error: errMsg };
    }
  });
}

/**
 * Server Action: Fetches cached balances for all active providers.
 */
export async function getAllProviderBalancesAction(
  forceRefresh = false
): Promise<AllProviderBalancesActionResult> {
  return requireStaffPermission('providers', 'view', async () => {
    try {
      const data = await providerBalanceService.getAllProviderBalances(forceRefresh);
      return { success: true, data };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Не удалось получить балансы провайдеров.';
      return { success: false, error: errMsg };
    }
  });
}

/**
 * Server Action: Fetches aggregated global liquidity and 24h burn metrics.
 */
export async function getGlobalProviderLiquidityAction(
  forceRefresh = false
): Promise<GlobalLiquidityActionResult> {
  return requireStaffPermission('providers', 'view', async () => {
    try {
      const summary = await providerBalanceService.getGlobalLiquiditySummary(forceRefresh);
      return {
        success: true,
        ...summary,
        data: summary,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Не удалось получить сводку по ликвидности.';
      return { success: false, error: errMsg };
    }
  });
}

/**
 * Server Action: Synchronizes provider balance and auto-flushes any waiting PENDING_CHECK orders.
 */
export async function syncAndFlushProviderOrdersAction(
  providerId: string
): Promise<{ success: boolean; data?: import('@/services/providers/balance-autoflush.service').AutoFlushResult; error?: string }> {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    try {
      const { BalanceAutoFlushService } = await import('@/services/providers/balance-autoflush.service');
      const result = await BalanceAutoFlushService.checkAndFlushProvider(providerId, {
        initiatedBy: { id: admin.id, email: admin.email },
        forceRefresh: true
      });
      return { success: true, data: result };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Не удалось выполнить синхронизацию и запуск заказов.';
      return { success: false, error: errMsg };
    }
  });
}
