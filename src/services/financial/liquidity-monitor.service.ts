import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { sendAdminAlert } from '@/lib/notifications';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'LiquidityMonitorService' });

export interface LiquidityMetricsDTO {
  tenantId: string;
  totalUserLiabilitiesCents: bigint;
  totalUserLiabilitiesRub: number;
  availableLiquidCents: bigint;
  availableLiquidRub: number;
  lcr: number;
  status: 'HEALTHY' | 'WARNING' | 'DEFICIT';
  recommendation: string;
  timestamp: Date;
}

// Memory cache for alert cooldown (1 hour per tenant)
const alertCooldowns: Record<string, number> = {};

export class LiquidityMonitorService {
  public static readonly TARGET_LCR = 1.15;
  public static readonly MIN_SAFE_LCR = 1.00;

  /**
   * Calculates Liquidity Coverage Ratio (LCR) for a tenant or platform-wide:
   * LCR = (Settled Gateway Inflows in 30d + Working Float) / User Balance Liabilities
   */
  static async getMetrics(tenantId?: string): Promise<LiquidityMetricsDTO> {
    const resolvedTenant = tenantId || 'smmplan';
    const isSingleTenant = resolvedTenant !== 'all';
    const tenantFilter = isSingleTenant ? Prisma.sql`AND u."tenantId" = ${resolvedTenant}` : Prisma.empty;
    const paymentTenantFilter = isSingleTenant ? Prisma.sql`AND p."tenantId" = ${resolvedTenant}` : Prisma.empty;

    // 1. Calculate total active user balances (Platform Liabilities)
    const liabilityRows = await db.$queryRaw<Array<{ total_liabilities: bigint | null }>>`
      SELECT COALESCE(SUM(u.balance), 0)::BIGINT AS total_liabilities
      FROM "User" u
      WHERE u."isDeleted" = false
        AND u.role = 'USER'
        AND u."staffRoleId" IS NULL
        ${tenantFilter}
    `;

    const totalUserLiabilitiesCents = liabilityRows[0]?.total_liabilities ?? BigInt(0);

    // 2. Calculate liquid inflows in transit / working capital (last 30 days of settled payments)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const inflowRows = await db.$queryRaw<Array<{ total_inflows: bigint | null }>>`
      SELECT COALESCE(SUM(p.amount), 0)::BIGINT AS total_inflows
      FROM "Payment" p
      WHERE p.status IN ('SUCCEEDED', 'PAID')
        AND p."createdAt" >= ${thirtyDaysAgo}
        ${paymentTenantFilter}
    `;

    // 3. Liquid funds proxy:
    // In e-commerce/SaaS, available liquid assets = recent 30-day net volume + base working capital reserve
    // Base float: minimum 50,000 RUB (5,000,000 cents) reserve buffer per tenant
    const baseFloatCents = BigInt(5_000_000);
    const thirtyDayNetInflows = inflowRows[0]?.total_inflows ?? BigInt(0);
    // Net factoring 3.5% YooKassa acquiring fee:
    const netInflowsCents = (thirtyDayNetInflows * BigInt(965)) / BigInt(1000);
    const availableLiquidCents = netInflowsCents + baseFloatCents;

    // 4. Calculate LCR ratio
    let lcr = 99.9;
    if (totalUserLiabilitiesCents > BigInt(0)) {
      lcr = Number(availableLiquidCents) / Number(totalUserLiabilitiesCents);
      lcr = Math.round(lcr * 100) / 100;
    }

    // 5. Determine status & recommendation
    let status: 'HEALTHY' | 'WARNING' | 'DEFICIT';
    let recommendation: string;

    if (lcr >= this.TARGET_LCR) {
      status = 'HEALTHY';
      recommendation = `Ликвидность в норме (LCR ${lcr}x ≥ 1.15x). Резервы покрывают обязательства перед клиентами с буфером 15%+.`;
    } else if (lcr >= this.MIN_SAFE_LCR) {
      status = 'WARNING';
      recommendation = `Внимание: буфер ликвидности снижен (LCR ${lcr}x). Рекомендуется пополнить рабочий капитал или ускорить вывод с эквайринга.`;
    } else {
      status = 'DEFICIT';
      recommendation = `КРИТИЧЕСКИЙ ДЕФИЦИТ (LCR ${lcr}x < 1.00x)! Обязательства перед пользователями превышают доступный рабочий остаток. Риск кассового разрыва.`;
    }

    return {
      tenantId: resolvedTenant,
      totalUserLiabilitiesCents,
      totalUserLiabilitiesRub: Number(totalUserLiabilitiesCents) / 100,
      availableLiquidCents,
      availableLiquidRub: Number(availableLiquidCents) / 100,
      lcr,
      status,
      recommendation,
      timestamp: new Date(),
    };
  }

  /**
   * Evaluates liquidity and triggers High-Priority Telegram Alert if LCR is below safe threshold.
   * Respects 1-hour cooldown between duplicate alerts.
   */
  static async checkAndAlertLiquidity(tenantId?: string): Promise<LiquidityMetricsDTO> {
    const metrics = await this.getMetrics(tenantId);
    const now = Date.now();
    const lastAlert = alertCooldowns[metrics.tenantId] || 0;
    const cooldownMs = 60 * 60 * 1000; // 1 hour

    if (metrics.status === 'DEFICIT' && (now - lastAlert > cooldownMs)) {
      alertCooldowns[metrics.tenantId] = now;
      log.error('Liquidity Iron Dome DEFICIT alert triggered', {
        tenantId: metrics.tenantId,
        lcr: metrics.lcr,
        liabilitiesRub: metrics.totalUserLiabilitiesRub,
        liquidRub: metrics.availableLiquidRub,
      });

      sendAdminAlert(
        `🚨 <b>CRITICAL: Кассовый дефицит ликвидности (Liquidity Iron Dome)!</b>\n` +
        `Тенант: <code>${metrics.tenantId}</code>\n` +
        `LCR: <b>${metrics.lcr}x</b> (норма: ≥ 1.15x)\n` +
        `Обязательства по балансам: <b>${metrics.totalUserLiabilitiesRub.toLocaleString('ru-RU')} ₽</b>\n` +
        `Доступные активы (30d + резерв): <b>${metrics.availableLiquidRub.toLocaleString('ru-RU')} ₽</b>\n` +
        `<i>${metrics.recommendation}</i>`,
        'CRITICAL'
      );
    } else if (metrics.status === 'WARNING' && (now - lastAlert > cooldownMs * 2)) {
      alertCooldowns[metrics.tenantId] = now;
      log.warn('Liquidity Iron Dome WARNING', {
        tenantId: metrics.tenantId,
        lcr: metrics.lcr,
      });

      sendAdminAlert(
        `⚠️ <b>Предупреждение: Буфер ликвидности снижен (LCR < 1.15x)</b>\n` +
        `Тенант: <code>${metrics.tenantId}</code>\n` +
        `LCR: <b>${metrics.lcr}x</b> (целевой: 1.15x)\n` +
        `Обязательства: <b>${metrics.totalUserLiabilitiesRub.toLocaleString('ru-RU')} ₽</b>\n` +
        `Доступно: <b>${metrics.availableLiquidRub.toLocaleString('ru-RU')} ₽</b>`,
        'WARNING'
      );
    }

    return metrics;
  }
}
