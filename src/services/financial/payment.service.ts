import { db } from '@/lib/db';
import { runSerializableTransaction } from '@/lib/transactions';
import { WalletOps } from './wallet-ops';
import { revalidatePath } from 'next/cache';
import { sendOrderPaidMail } from '@/lib/smtp';
import { logPromoCodeUsageIfNeeded } from '@/services/marketing-utils';
import { PromoAutomationService } from '../users/promo-automation.service';
import { SecurityAlertService } from '@/services/security/security-alert.service';

function safeRevalidatePath(path: string, type?: 'layout' | 'page') {
  try {
    revalidatePath(path, type);
  } catch (err) {
    const msg = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err);
    console.warn(`[Cache] revalidatePath failed for ${path}:`, msg);
  }
}

export class PaymentService {
  /**
   * Confirms a payment and activates the linked order.
   * Called by webhook handlers (YooKassa, CryptoBot).
   * 
   * Flow: Payment PENDING → SUCCEEDED → Order AWAITING_PAYMENT → PENDING
   */
  async confirmPayment(
    gatewayId: string, 
    amount: number | bigint, 
    userId: string, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isDevSandbox = false,
    gatewayType: 'yookassa' | 'cryptobot' | 'robokassa' = 'yookassa',
    internalPaymentId?: string,
    metadataType?: string,
    receiptId?: string
  ): Promise<boolean> {
    const activatedOrders: { id: string; isDripFeed: boolean; userId: string; amount: number; userEmail?: string | null; serviceName?: string | null; numericId?: number }[] = [];
    let paidAmountBigInt = BigInt(amount);
    let isOrderFlow = false;

    try {
      // 1. Double-check against real gateway API in production
      const isMockPayment = gatewayId.startsWith('test_') || gatewayId.startsWith('mock_');
      if (process.env.NODE_ENV === 'production' && gatewayType === 'yookassa' && !isDevSandbox && !isMockPayment) {
        let paymentTenantId = 'smmplan';
        if (internalPaymentId) {
          const p = await db.payment.findUnique({ where: { id: internalPaymentId }, select: { tenantId: true } });
          if (p?.tenantId) paymentTenantId = p.tenantId;
        } else if (gatewayId) {
          const p = await db.payment.findUnique({ where: { gatewayId }, select: { tenantId: true } });
          if (p?.tenantId) paymentTenantId = p.tenantId;
        }

        const { SettingsManager } = await import('@/lib/settings');
        const isTestMode = await SettingsManager.isTestMode(paymentTenantId);
        if (!isTestMode) {
          const secrets = await SettingsManager.getPaymentSecrets(paymentTenantId);
          
          // We attempt to verify with YooKassa if secrets are configured
          if (secrets.yookassaShopId && secrets.yookassaSecretKey) {
            const authHeader = 'Basic ' + Buffer.from(`${secrets.yookassaShopId}:${secrets.yookassaSecretKey}`).toString('base64');
            try {
                const response = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
                    headers: { 'Authorization': authHeader },
                    signal: AbortSignal.timeout(15000)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.status !== 'succeeded') {
                        throw new Error(`PAYMENT_NOT_SUCCEEDED: Real gateway status is ${data.status}`);
                    }
                    const realAmount = Math.round(parseFloat(data.amount.value) * 100);
                    if (realAmount < amount) {
                        throw new Error(`PAYMENT_AMOUNT_MISMATCH: Webhook amount ${amount} exceeds Real amount ${realAmount}`);
                    }
                    console.info(`[Payment] Safely verified YooKassa payment ${gatewayId}`);
                } else {
                    throw new Error(`GATEWAY_ERROR: Failed to contact YooKassa API or Payment Not Found (${response.status})`);
                }
            } catch (e: unknown) {
                console.error(`[Payment] Verification Exploit Blocked: ${(e instanceof Error ? e.message : String(e))}`);
                return false; // Reject payment
            }
          } else {
             console.error(`[Payment] YooKassa verification failed for ${gatewayId} due to missing secrets in admin panel! Rejecting for safety.`);
             return false;
          }
        }
      }

      // 2. Atomic transaction: confirm payment + activate order
      await runSerializableTransaction(async (tx) => {
        // Find payment by internal ID (preferred) or gateway ID
        let payment = null;
        if (internalPaymentId) {
          payment = await tx.payment.findUnique({ where: { id: internalPaymentId } });
        }
        if (!payment) {
          payment = await tx.payment.findUnique({ where: { gatewayId } });
        }

        const receivedAmountBigInt = BigInt(amount);

        // 1. Process or Create Payment atomically via Upsert to prevent orphaned double-creation
        const currentPayment = payment
          ? await tx.payment.findUnique({ where: { id: payment.id } })
          : await tx.payment.findUnique({ where: { gatewayId } });

        if (currentPayment && currentPayment.status === 'SUCCEEDED') {
          console.info(`[Payment] ${gatewayId} already processed (atomic idempotency hit)`);
          return;
        }

        // [SECURITY CR-4 FIX] Gateway ID Consistency Guard
        if (currentPayment && currentPayment.gatewayId && currentPayment.gatewayId !== gatewayId) {
          console.error(`[Payment] Gateway ID mismatch for payment ${currentPayment.id}: expected ${currentPayment.gatewayId}, got ${gatewayId}`);
          throw new Error('PAYMENT_GATEWAY_ID_MISMATCH: Gateway ID mismatch detected.');
        }

        // [SECURITY CR-4 FIX] Currency Consistency Guard
        if (currentPayment && currentPayment.currency && currentPayment.currency !== 'RUB') {
          console.error(`[Payment] Currency mismatch for payment ${currentPayment.id}: expected RUB, got ${currentPayment.currency}`);
          throw new Error('PAYMENT_CURRENCY_MISMATCH: Unsupported payment currency.');
        }

        // [SECURITY CR-4 FIX] Exact Amount Verification: Reject both underpayment and overpayment exploits
        if (currentPayment && currentPayment.amount !== receivedAmountBigInt) {
          console.error(`[Payment] Amount mismatch exploit attempt for ${gatewayId}: expected ${currentPayment.amount}, got ${receivedAmountBigInt}`);
          void SecurityAlertService.record({
            event: 'PAYMENT_AMOUNT_MISMATCH_EXPLOIT',
            severity: 'CRITICAL',
            details: {
              paymentId: currentPayment.id,
              expectedAmount: currentPayment.amount.toString(),
              receivedAmount: receivedAmountBigInt.toString(),
              gatewayId,
              gatewayType
            }
          });
          throw new Error('PAYMENT_AMOUNT_MISMATCH: Amount received from gateway does not match expected payment amount.');
        }

        let processedPaymentId: string;
        let isOrderPayment: boolean;
        let linkedOrderId: string;
        let targetUserId: string;

        if (currentPayment) {
          // [SECURITY CR-4 FIX] Do NOT overwrite currentPayment.amount with webhook amount. Use expected payment.userId
          targetUserId = currentPayment.userId;
          if (userId && currentPayment.userId !== userId) {
            console.warn(`[Payment] User mismatch: caller passed ${userId}, payment bound to ${currentPayment.userId}. Using payment.userId.`);
          }

          const updated = await tx.payment.updateMany({
            where: { id: currentPayment.id, tenantId: currentPayment.tenantId, status: 'PENDING' },
            data: { status: 'SUCCEEDED', gatewayId, receiptId: receiptId || undefined }
          });
          if (updated.count === 0) {
            const fresh = await tx.payment.findUnique({
              where: { id: currentPayment.id },
              select: { status: true }
            });
            console.warn(
              `[Payment] No transition for ${currentPayment.id}. Current status: ${fresh?.status}`
            );
            return true;
          }
          processedPaymentId = currentPayment.id;
          isOrderPayment = !!currentPayment.orderId;
          linkedOrderId = currentPayment.orderId || '';
        } else {
          // [SECURITY] Orphan webhook rejected
          console.error(`[SECURITY] Orphan webhook rejected for gatewayId: ${gatewayId}. No PENDING payment found.`);
          throw new Error('ORPHAN_WEBHOOK: Stray webhooks are no longer allowed to credit accounts. All payments must be initiated by the system.');
        }

        const creditAmount = currentPayment ? currentPayment.amount : receivedAmountBigInt;

        // [FIN-009] Removed awardCommission from payment.service.ts. 
        // Referral commissions are now awarded in order.service.ts based on order margin.

        // Assign funds locally
        // NOTE (CHK-06 audit clarification): this single-order branch is REACHABLE via
        // retryCheckoutAction (it creates Payment with orderId set). It is mutually
        // exclusive with the basket branch below: this branch flips the order to PENDING,
        // so the basket findMany (AWAITING_PAYMENT only) never sees it again. Do NOT
        // remove. Idempotency keys: credit matches the basket branch
        // (gateway-credit-${paymentId}); charge is per-order (gateway-charge-${orderId}).
        if (isOrderPayment && linkedOrderId) {
          // Activate linked order
          const order = await tx.order.findUnique({ 
            where: { id: linkedOrderId },
            include: { user: { select: { email: true } }, service: { select: { name: true } } }
          });
          if (order && order.status === 'AWAITING_PAYMENT') {
            // [FIN-P0 Guard] Ensure credited amount is strictly >= order.charge to prevent underpaid activation
            if (creditAmount < order.charge) {
              console.error(`[SECURITY] Underpaid order activation blocked: order #${order.numericId} requires ${order.charge} kopecks, but payment credited only ${creditAmount} kopecks.`);
              void SecurityAlertService.record({
                event: 'UNDERPAID_ORDER_EXPLOIT_ATTEMPT',
                severity: 'CRITICAL',
                details: {
                  orderId: linkedOrderId,
                  orderNumericId: order.numericId,
                  requiredCharge: order.charge.toString(),
                  creditedAmount: creditAmount.toString(),
                  paymentId: processedPaymentId
                }
              });
              throw new Error(`UNDERPAID_ORDER: Credited amount (${creditAmount}) is less than required order charge (${order.charge})`);
            }

            await tx.order.update({
              where: { id: linkedOrderId },
              data: { status: 'PENDING' }
            });
            await logPromoCodeUsageIfNeeded(tx, linkedOrderId, targetUserId);
            if (order.promoCodeId) {
              const promo = await tx.promoCode.findUnique({ where: { id: order.promoCodeId } });
              if (promo) {
                const { marketingService } = await import('@/services/marketing.service');
                await marketingService.consumePromoCode(tx, promo.code).catch((err) => {
                  console.warn(`[MARKETING] Could not consume promo code ${promo.code} on payment confirmation:`, err);
                });
              }
            }
            activatedOrders.push({ 
              id: order.id, 
              isDripFeed: order.isDripFeed, 
              userId: targetUserId, 
              amount: Number(creditAmount),
              userEmail: order.user?.email ?? null,
              serviceName: order.service?.name ?? null,
              numericId: order.numericId 
            });
            await WalletOps.credit(tx, targetUserId, creditAmount,
              `Оплата заказа #${order.numericId} через шлюз`,
              { idempotencyKey: `gateway-credit-${processedPaymentId}` }
            );
            await WalletOps.charge(tx, targetUserId, order.charge,
              `Списание за заказ #${order.numericId}`,
              { idempotencyKey: `gateway-charge-${order.id}` }
            );
          }
        }

        // --- NEW BASKET LOGIC (Deposit-Driven 1:N Orders) ---
        const basketTenantId = currentPayment?.tenantId;
        const basketOrders = await tx.order.findMany({ 
          where: { 
            paymentId: processedPaymentId, 
            status: 'AWAITING_PAYMENT',
            ...(basketTenantId ? { tenantId: basketTenantId } : {})
          },
          include: { user: { select: { email: true } }, service: { select: { name: true } } }
        });
        if (basketOrders.length > 0) {
           await tx.order.updateMany({
              where: { 
                paymentId: processedPaymentId, 
                status: 'AWAITING_PAYMENT',
                ...(basketTenantId ? { tenantId: basketTenantId } : {})
              },
              data: { status: 'PENDING' }
           });
           
           for (const order of basketOrders) {
              activatedOrders.push({ 
                id: order.id, 
                isDripFeed: order.isDripFeed, 
                userId: targetUserId, 
                amount: Number(order.charge),
                userEmail: order.user?.email ?? null,
                serviceName: order.service?.name ?? null,
                numericId: order.numericId 
              });
              await logPromoCodeUsageIfNeeded(tx, order.id, targetUserId);
              if (order.promoCodeId) {
                const promo = await tx.promoCode.findUnique({ where: { id: order.promoCodeId } });
                if (promo) {
                  const { marketingService } = await import('@/services/marketing.service');
                  await marketingService.consumePromoCode(tx, promo.code).catch((err) => {
                    console.warn(`[MARKETING] Could not consume basket promo code ${promo.code} on payment confirmation:`, err);
                  });
                }
              }
           }

            // Credit full expected paid amount first to currentPayment.userId
            await WalletOps.credit(tx, targetUserId, creditAmount,
              `Оплата корзины заказов через шлюз`,
              { idempotencyKey: `gateway-credit-${processedPaymentId}` }
            );

            // Batch deduct total charge and log ledger entries
            const totalChargeCents = basketOrders.reduce((sum, order) => sum + order.charge, BigInt(0));
            
            // [FIN-P0 Guard] Ensure credited amount is strictly >= totalChargeCents to prevent underpaid basket activation
            if (creditAmount < totalChargeCents) {
              console.error(`[SECURITY] Underpaid basket activation blocked: basket requires ${totalChargeCents} kopecks, but payment credited only ${creditAmount} kopecks.`);
              throw new Error(`UNDERPAID_BASKET: Credited amount (${creditAmount}) is less than required basket charge (${totalChargeCents})`);
            }

            await WalletOps.charge(
              tx,
              targetUserId,
              totalChargeCents,
              `Списание за оплату корзины заказов (${basketOrders.length} шт.)`,
              { idempotencyKey: `gateway-basket-charge-${processedPaymentId}` }
            );

        }

        if (!isOrderPayment && basketOrders.length === 0) {
          // Direct top-up (Deposit) - Increment User Balance securely via targetUserId and expected creditAmount!
          await WalletOps.credit(tx, targetUserId, creditAmount,
            `Пополнение баланса через ${gatewayType}`,
            { idempotencyKey: `deposit-${processedPaymentId}` }
          );
        }

        paidAmountBigInt = creditAmount;
        isOrderFlow = isOrderPayment || basketOrders.length > 0;
      });

      // Invalidate user dashboard cache so they see the new order & spending immediately
      safeRevalidatePath('/dashboard', 'layout');
      
      // Dispatch paid orders to processing queue
      if (activatedOrders.length > 0) {
        const { ordersQueue } = await import('@/lib/queue-manager');
        for (const activated of activatedOrders) {
          await ordersQueue.add('order-dispatch', { orderId: activated.id }, { jobId: `dispatch-${activated.id}`, delay: 3 * 60 * 1000 }); // 3 min cooling-off
          
          if (activated.userEmail && activated.serviceName) {
            void sendOrderPaidMail(
              activated.userEmail,
              activated.numericId?.toString() ?? activated.id,
              activated.serviceName
            ).catch(err => console.error('[H1] sendOrderPaidMail failed', err));
          }
        }
      }

      // Notify user directly in Telegram if user has linked Telegram ID
      try {
        const userWithTg = await db.user.findUnique({
          where: { id: userId },
          select: { telegramId: true, balance: true }
        });
        if (userWithTg?.telegramId) {
          const { bot } = await import('@/bot');
          const amountRub = (Number(paidAmountBigInt) / 100).toLocaleString('ru-RU');
          const newBal = (Number(userWithTg.balance) / 100).toFixed(2);
          if (isOrderFlow || activatedOrders.length > 0) {
            await bot.telegram.sendMessage(
              userWithTg.telegramId,
              `🎉 <b>ОПЛАТА ЗАКАЗА ПОДТВЕРЖДЕНА!</b>\n────────────────────\n` +
              `Сумма: <b>${amountRub} ₽</b>\n` +
              `Заказ передан в обработку и скоро будет запущен!\n\n` +
              `<i>Отслеживать статус можно в разделе «📦 Мои заказы».</i>`,
              { parse_mode: 'HTML' }
            );
          } else {
            await bot.telegram.sendMessage(
              userWithTg.telegramId,
              `🎉 <b>БАЛАНС УСПЕШНО ПОПОЛНЕН!</b>\n────────────────────\n` +
              `Сумма: <b>+${amountRub} ₽</b>\n` +
              `Текущий баланс: <b>${newBal} ₽</b> ✅\n\n` +
              `<i>Вы можете приступить к оформлению заказов прямо сейчас.</i>`,
              { parse_mode: 'HTML' }
            );
          }
        }
      } catch (tgNotifyErr) {
        console.warn('[PaymentService] Telegram user notification skipped:', tgNotifyErr);
      }

      // Check and issue promotional loyalty rewards based on new total spent
      PromoAutomationService.checkAndIssueLoyalty(userId).catch(console.error);

      return true;
    } catch (e: unknown) {
      console.error('[PaymentService] Error confirming payment:', (e instanceof Error ? e.message : String(e)));
      return false;
    }
  }

  /**
   * Confirms a payment directly by paymentId (for mock/test flows).
   */
  async confirmPaymentById(paymentId: string): Promise<boolean> {
    try {
      let capturedUserId: string | null = null;
      const activatedOrders: { id: string; isDripFeed: boolean; userEmail?: string | null; serviceName?: string | null; numericId?: number }[] = [];

      await db.$transaction(async (tx) => {
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId }
        });

        const updatedPayment = await tx.payment.updateMany({
          where: { 
            id: paymentId,
            tenantId: payment.tenantId,
            status: 'PENDING'
          },
          data: { 
            status: 'SUCCEEDED',
            gatewayId: `test_${Date.now()}`
          }
        });

        // If count is 0, another concurrent call already activated it
        if (updatedPayment.count === 0) return;

        capturedUserId = payment.userId;

        // [FIN-009] Removed awardCommission from payment.service.ts.
        // Referral commissions are now awarded in order.service.ts based on order margin.

        // Activate linked order
        if (payment.orderId) {
          const order = await tx.order.findUnique({
            where: { id: payment.orderId },
            include: { user: { select: { email: true } }, service: { select: { name: true } } }
          });

          if (order && order.status === 'AWAITING_PAYMENT') {
            await tx.order.update({
              where: { id: payment.orderId },
              data: { status: 'PENDING' }
            });
            await logPromoCodeUsageIfNeeded(tx, payment.orderId, payment.userId);
            activatedOrders.push({ 
              id: order.id, 
              isDripFeed: order.isDripFeed,
              userEmail: order.user?.email ?? null,
              serviceName: order.service?.name ?? null,
              numericId: order.numericId
            });
            
            await WalletOps.credit(tx, payment.userId, Number(payment.amount),
              `Оплата заказа #${order.numericId} через шлюз`,
              { idempotencyKey: `gateway-credit-${paymentId}` }
            );
            await WalletOps.charge(tx, payment.userId, Number(order.charge),
              `Списание за заказ #${order.numericId}`,
              { idempotencyKey: `gateway-charge-${order.id}` }
            );
          }
        }

        // --- NEW BASKET LOGIC (TEST MODE) ---
        const basketOrders = await tx.order.findMany({ 
          where: { paymentId: paymentId, tenantId: payment.tenantId, status: 'AWAITING_PAYMENT' },
          include: { user: { select: { email: true } }, service: { select: { name: true } } }
        });
        if (basketOrders.length > 0) {
           await tx.order.updateMany({
              where: { paymentId: paymentId, tenantId: payment.tenantId, status: 'AWAITING_PAYMENT' },
              data: { status: 'PENDING' }
           });
           
           for (const order of basketOrders) {
              activatedOrders.push({ 
                id: order.id, 
                isDripFeed: order.isDripFeed,
                userEmail: order.user?.email ?? null,
                serviceName: order.service?.name ?? null,
                numericId: order.numericId
              });
              await logPromoCodeUsageIfNeeded(tx, order.id, payment.userId);
           }

            // Credit full paid amount first
            await WalletOps.credit(tx, payment.userId, Number(payment.amount),
              `Оплата корзины заказов через шлюз`,
              { idempotencyKey: `gateway-credit-${paymentId}` }
            );

            // Batch deduct total charge and log ledger entries
            const totalChargeCents = basketOrders.reduce((sum, order) => sum + order.charge, BigInt(0));
            
            await WalletOps.charge(
              tx,
              payment.userId,
              totalChargeCents,
              `Списание за оплату корзины заказов (${basketOrders.length} шт.)`,
              { idempotencyKey: `gateway-basket-charge-${paymentId}` }
            );

        }

        if (!payment.orderId && basketOrders.length === 0) {
          // Direct top-up (Deposit) - Increment User Balance securely!
          await WalletOps.credit(tx, payment.userId, Number(payment.amount),
            `Пополнение баланса через yookassa`,
            { idempotencyKey: `deposit-${paymentId}` }
          );
        }
      }, { isolationLevel: 'Serializable', timeout: 15000 });

      safeRevalidatePath('/dashboard', 'layout');

      // Dispatch paid orders to processing queue
      if (activatedOrders.length > 0) {
        const { ordersQueue } = await import('@/lib/queue-manager');
        for (const activated of activatedOrders) {
          await ordersQueue.add('order-dispatch', { orderId: activated.id }, { jobId: `dispatch-${activated.id}`, delay: 3 * 60 * 1000 }); // 3 min cooling-off
          
          if (activated.userEmail && activated.serviceName) {
            void sendOrderPaidMail(
              activated.userEmail,
              activated.numericId?.toString() ?? activated.id,
              activated.serviceName
            ).catch(err => console.error('[H1] sendOrderPaidMail failed', err));
          }
        }
      }

      if (capturedUserId) {
        PromoAutomationService.checkAndIssueLoyalty(capturedUserId).catch(console.error);
      }

      return true;
    } catch (e: unknown) {
      console.error('[PaymentService] Error:', (e instanceof Error ? e.message : String(e)));
      return false;
    }
  }
}

export const paymentService = new PaymentService();

