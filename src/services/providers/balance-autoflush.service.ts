/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Smart Provider Balance Recovery & Auto-Flush Engine
 *
 * Implements RAC-2026 Distributed Safety Guards:
 * 1. Provider-level mutual exclusion lock (lock:provider:flush:${providerId})
 * 2. Strict error classification (only INSUFFICIENT_PROVIDER_BALANCE is auto-flushed)
 * 3. Rate-limited batch enqueuing with BullMQ
 * 4. Circuit Breaker Fail-Fast on mid-batch balance depletion
 * 5. Emergency Global Kill-Switch (autoflush:enabled)
 * 6. Non-repudiation append-only audit logging
 */

import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { ordersQueue } from '@/lib/queue-manager';
import { ProviderBalanceService } from '@/services/admin/provider-balance.service';
import { auditAdminAwaitable } from '@/lib/admin-audit';

export interface AutoFlushResult {
  providerId: string;
  providerName: string;
  flushedCount: number;
  skippedCount: number;
  currentBalanceRub: number;
  status: 'SUCCESS' | 'SKIPPED' | 'HALTED_NO_BALANCE' | 'DISABLED_KILLSWITCH' | 'LOCKED';
  message: string;
}

export class BalanceAutoFlushService {
  private static readonly providerBalanceService = new ProviderBalanceService();
  private static readonly PROVIDER_LOCK_TTL_SECONDS = 45;
  private static readonly MIN_BALANCE_THRESHOLD_RUB = 50; // Minimum 50 RUB balance to attempt flush
  private static readonly BATCH_LIMIT = 50; // Process max 50 orders per cycle to prevent queue choking

  /**
   * Checks if an order's hold error is strictly due to provider balance insufficiency.
   */
  static isBalanceRelatedError(errorMessage: string | null | undefined): boolean {
    if (!errorMessage) return false;
    const lower = errorMessage.toLowerCase();

    // Explicit tag or typical provider API error strings for low balance
    const balanceKeywords = [
      'insufficient_provider_balance',
      'not enough funds',
      'not enough balance',
      'low balance',
      'balance too low',
      'insufficient balance',
      'недостаточно средств',
      'нет денег',
      'недостаточно денег',
      'пополните баланс',
      'error_not_enough_funds',
      'not_enough_funds',
      'not_enough_balance',
      'out of balance',
    ];

    // Exclude fatal link / profile errors that shouldn't be auto-retried
    const fatalKeywords = [
      'invalid link',
      'private',
      'link is broken',
      'closed profile',
      'bad link',
      'невалидная ссылка',
      'закрытый профиль',
      'price_drift_hold',
    ];

    const hasFatal = fatalKeywords.some((k) => lower.includes(k));
    if (hasFatal) return false;

    return balanceKeywords.some((k) => lower.includes(k));
  }

  /**
   * Flushes PENDING_CHECK orders for a specific provider if its balance is healthy.
   * Thread-safe with Redis distributed mutex.
   */
  static async checkAndFlushProvider(
    providerId: string,
    options?: { initiatedBy?: { id: string; email: string }; forceRefresh?: boolean }
  ): Promise<AutoFlushResult> {
    // 1. Emergency Kill-Switch Check
    try {
      const killSwitch = await redis.get('autoflush:enabled');
      if (killSwitch === 'false' || killSwitch === '0') {
        return {
          providerId,
          providerName: 'Unknown',
          flushedCount: 0,
          skippedCount: 0,
          currentBalanceRub: 0,
          status: 'DISABLED_KILLSWITCH',
          message: 'Auto-Flush глобально отключен аварийным рубильником (Kill-Switch).',
        };
      }
    } catch {
      // Redis fallback: proceed safely
    }

    // 2. Distributed Mutex Lock (Provider-Level) — Fail-Closed Invariant
    const lockKey = `lock:provider:flush:${providerId}`;
    let lockAcquired = false;
    try {
      const acquired = await redis.set(lockKey, '1', 'EX', this.PROVIDER_LOCK_TTL_SECONDS, 'NX');
      lockAcquired = acquired === 'OK';
    } catch {
      // Fail-closed: Never proceed if lock acquisition cannot be guaranteed to prevent double-spending
      lockAcquired = false;
    }

    if (!lockAcquired) {
      return {
        providerId,
        providerName: 'Unknown',
        flushedCount: 0,
        skippedCount: 0,
        currentBalanceRub: 0,
        status: 'LOCKED',
        message: 'Процесс отправки для данного поставщика уже выполняется другим потоком.',
      };
    }

    try {
      // 3. Fetch Provider Details
      const provider = await db.provider.findUnique({
        where: { id: providerId },
        select: { id: true, name: true, isActive: true, balanceCurrency: true },
      });

      if (!provider || !provider.isActive) {
        return {
          providerId,
          providerName: provider?.name || 'Unknown',
          flushedCount: 0,
          skippedCount: 0,
          currentBalanceRub: 0,
          status: 'SKIPPED',
          message: 'Поставщик не найден или отключен.',
        };
      }

      // 4. Live Balance Check
      const balanceData = await this.providerBalanceService.getProviderBalance(
        providerId,
        options?.forceRefresh ?? false
      );

      if (balanceData.status === 'error' || balanceData.balanceRub < this.MIN_BALANCE_THRESHOLD_RUB) {
        return {
          providerId,
          providerName: provider.name,
          flushedCount: 0,
          skippedCount: 0,
          currentBalanceRub: balanceData.balanceRub,
          status: 'HALTED_NO_BALANCE',
          message: `Баланс поставщика (${balanceData.balanceRub.toFixed(2)} ₽) ниже минимального порога (${this.MIN_BALANCE_THRESHOLD_RUB} ₽). Заказы не запущены.`,
        };
      }

      // 5. Query candidate PENDING_CHECK orders for this provider (capped at 5 retries to prevent infinite loops)
      const candidateOrders = await db.order.findMany({
        where: {
          providerId,
          status: 'PENDING_CHECK',
          retryCount: { lt: 5 },
        },
        orderBy: { createdAt: 'asc' },
        take: this.BATCH_LIMIT,
        select: {
          id: true,
          numericId: true,
          error: true,
          charge: true,
          providerCost: true,
          retryCount: true,
          tenantId: true,
        },
      });

      if (candidateOrders.length === 0) {
        return {
          providerId,
          providerName: provider.name,
          flushedCount: 0,
          skippedCount: 0,
          currentBalanceRub: balanceData.balanceRub,
          status: 'SUCCESS',
          message: 'Нет отложенных заказов в статусе PENDING_CHECK для данного поставщика.',
        };
      }

      // 6. Filter orders that specifically failed due to balance issues
      const eligibleOrders = candidateOrders.filter((o) =>
        this.isBalanceRelatedError(o.error)
      );

      const skippedCount = candidateOrders.length - eligibleOrders.length;
      let flushedCount = 0;
      let remainingLiquidityRub = balanceData.balanceRub;

      // 7. Atomic reset and queue push with Batch Liquidity check
      for (const order of eligibleOrders) {
        const orderCostRub = order.providerCost
          ? Number(order.providerCost) / 100
          : (order.charge ? Number(order.charge) / 100 : 0);
        if (orderCostRub > 0 && remainingLiquidityRub < orderCostRub) {
          // Break early if remaining balance cannot cover the next order
          break;
        }
        if (orderCostRub > 0) {
          remainingLiquidityRub -= orderCostRub;
        }

        // Clear duplicate dispatch mutex in case it was set previously
        await redis.del(`order:dispatched:${order.id}`).catch(() => {});

        await db.order.update({
          where: { id: order.id },
          data: {
            status: 'PENDING',
            error: null,
            retryCount: { increment: 1 },
          },
        });

        const jobId = `dispatch-${order.id}-${Date.now()}`;
        await ordersQueue.add('order-dispatch', { orderId: order.id, tenantId: order.tenantId }, { jobId });
        flushedCount++;
      }

      // Unfreeze services of this provider that were put in cooldown due to API failures
      if (flushedCount > 0) {
        try {
          await db.service.updateMany({
            where: {
              providerId,
              cooldownReason: 'HIGH_API_FAILURES',
              cooldownUntil: { gt: new Date() }
            },
            data: {
              cooldownUntil: null,
              cooldownReason: null
            }
          });
        } catch { /* ignore */ }
      }

      // 8. Audit Log & Team Alert
      if (flushedCount > 0) {
        try {
          const { OrderTriageAlertService } = await import('@/services/orders/order-triage-alert.service');
          await OrderTriageAlertService.sendBalanceAutoFlushAlert({
            providerName: provider.name,
            balanceRub: balanceData.balanceRub,
            flushedCount,
            skippedCount,
          });
        } catch { /* ignore */ }
      }

      if (flushedCount > 0) {
        await auditAdminAwaitable({
          adminId: options?.initiatedBy?.id || 'system-cron',
          adminEmail: options?.initiatedBy?.email || 'system-cron@smmplan.pro',
          action: 'PROVIDER_BATCH_AUTOFLUSH',
          target: providerId,
          targetType: 'PROVIDER',
          newValue: {
            flushedCount,
            skippedCount,
            balanceRub: balanceData.balanceRub,
            remainingLiquidityRub,
            initiatedBy: options?.initiatedBy?.email || 'SYSTEM_CRON',
          },
        }).catch((err) => console.error('[BalanceAutoFlush] Audit log failed:', err));
      }

      return {
        providerId,
        providerName: provider.name,
        flushedCount,
        skippedCount,
        currentBalanceRub: balanceData.balanceRub,
        status: 'SUCCESS',
        message: `Успешно отправлено в очередь: ${flushedCount} заказов. Пропущено (не балансовые ошибки): ${skippedCount}.`,
      };
    } finally {
      // Release lock
      try {
        await redis.del(lockKey);
      } catch { /* ignore */ }
    }
  }

  /**
   * Sweeps all active providers and flushes eligible orders if balance was restored.
   */
  static async sweepAllProviders(): Promise<AutoFlushResult[]> {
    const activeProviders = await db.provider.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const results: AutoFlushResult[] = [];
    for (const p of activeProviders) {
      try {
        const res = await this.checkAndFlushProvider(p.id, { forceRefresh: false });
        if (res.flushedCount > 0) {
          results.push(res);
        }
      } catch (err) {
        console.error(`[BalanceAutoFlush] Error sweeping provider ${p.id}:`, err);
      }
    }
    return results;
  }
}
