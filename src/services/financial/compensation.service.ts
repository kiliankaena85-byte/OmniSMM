/**
 * MANDATORY INTEGRITY WARNING:
 * DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
 */

import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'CompensationService' });

export class CompensationService {
  /**
   * Tracks and stores actual provider cost and real margin delta for an order
   * when it transitions to a terminal state (COMPLETED, PARTIAL, CANCELED, ERROR).
   * 
   * @param orderId ID of the order to evaluate
   * @param providerCharge Raw charge returned by the provider API
   */
  static async trackCompensation(orderId: string, providerCharge?: string | null): Promise<void> {
    try {
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: { service: true }
      });

      if (!order) {
        log.warn('Order not found for compensation tracking', { orderId });
        return;
      }

      let actualProviderCostCents = 0;
      const status = order.status;

      if (status === 'CANCELED' || status === 'ERROR') {
        actualProviderCostCents = 0;
      } else {
        // Parse provider charge
        let parsedCharge: number | null = null;
        if (providerCharge !== undefined && providerCharge !== null) {
          const cleaned = String(providerCharge).trim();
          if (cleaned !== '') {
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
              parsedCharge = num;
            }
          }
        }

        if (parsedCharge !== null) {
          const isUsd = order.service.providerCurrency === 'USD';
          if (isUsd) {
            const usdToRub = order.usdToRubRate || (await SettingsProvider.getExchangeRateUSD());
            // Converting USD charge to RUB cents: charge * usdToRub * 100
            actualProviderCostCents = Math.round(parsedCharge * usdToRub * 100);
          } else {
            // RUB currency
            actualProviderCostCents = Math.round(parsedCharge * 100);
          }
        } else {
          // Fallback calculations when charge is missing or invalid
          if (status === 'PARTIAL') {
            // Proportional cost calculation based on quantity and remains for partial
            const remains = order.remains;
            const quantity = order.quantity;
            const providerCost = Number(order.providerCost);
            const completedQty = Math.max(0, quantity - remains);
            actualProviderCostCents = quantity > 0 ? Math.round((providerCost * completedQty) / quantity) : 0;
          } else {
            // COMPLETED or other positive statuses
            actualProviderCostCents = Number(order.providerCost);
          }
        }
      }

      const actualProviderCost = BigInt(actualProviderCostCents);

      // Query ledger entries starting with refund_${order.id}_ to find all refunds related to the order and sum them
      const refunds = await db.ledgerEntry.findMany({
        where: {
          tenantId: order.tenantId || 'smmplan',
          OR: [
            { idempotencyKey: { startsWith: `refund_${order.id}_` } },
            { idempotencyKey: { endsWith: `_order_${order.id}` } },
            { idempotencyKey: { endsWith: `-${order.id}` } }
          ]
        }
      });

      let totalRefundedCents = BigInt(0);
      for (const refund of refunds) {
        totalRefundedCents += refund.amount;
      }

      // Calculate realMarginDelta = order.providerCost - totalRefundedCents - actualProviderCost
      const realMarginDelta = order.providerCost - totalRefundedCents - actualProviderCost;

      // Update the order in the database
      await db.order.updateMany({
        where: {
          id: order.id,
          tenantId: order.tenantId || 'smmplan'
        },
        data: {
          actualProviderCost,
          realMarginDelta
        }
      });

      log.info('Compensation tracking complete', {
        orderId,
        status,
        actualProviderCost: actualProviderCost.toString(),
        totalRefundedCents: totalRefundedCents.toString(),
        realMarginDelta: realMarginDelta.toString()
      });
    } catch (error) {
      log.error('Failed to track compensation', {
        orderId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
