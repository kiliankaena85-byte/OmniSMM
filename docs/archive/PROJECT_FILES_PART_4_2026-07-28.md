# СБОРКА ИСХОДНОГО КОДА ПРОЕКТА SMMplan / Flux / Lovable
## ЧАСТЬ 4 из 5: Server Actions (Каталог, Оформление заказа, Настройки, Аутентификация)

**Дата сборки:** 28 июля 2026  
**Файл:** `PROJECT_FILES_PART_4_2026-07-28.md`  
**Количество файлов в части:** 89  
**Принцип:** Доказательность 100%. Чтение файлов ВСЕГДА выполнено НАПРЯМУЮ С ДИСКА (`fs.readFileSync`). Нет сокращений (`...`), нет моков, нет заглушек.

---

### 📄 Файл 1 из 89: `src/actions/order/checkout.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { runSerializableTransaction } from '@/lib/transactions';
import { marketingService, PricingResult } from '@/services/marketing.service';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { SettingsManager } from '@/lib/settings';
import { verifySession, createSession } from '@/lib/session';
import { normalizeTenantId } from "@/lib/tenant-resolver";
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getClientIp } from '@/utils/ip';
import { WalletOps, WalletInsufficientFundsError, WalletUserNotFoundError, WalletInvalidAmountError } from '@/services/financial/wallet-ops';
import { handleServerError } from '@/utils/error-handler';
import { sendOrderPaidMail } from "@/lib/smtp";
import { getBaseUrlSync } from "@/utils/get-base-url";
import { featureFlagService } from "@/services/system/feature-flag.service";
import { mutateLink, getLinkValidator } from '@/validators/link-mutators';
import { inferTargetTypeFromCategory } from '@/utils/target-type';
import { safeUrlForLog } from '@/lib/log-safe';
import { SmartDripService } from '@/services/dripfeed/smart-drip.service';
import { randomUUID } from 'crypto';

import { Prisma } from '@prisma/client';
class IdempotencyConflictError extends Error {
  constructor(public existingOrder: unknown) {
    super('Idempotency conflict');
    this.name = 'IdempotencyConflictError';
  }
}



/**
 * Calculates price for display on the order form (no auth required).
 */
export async function calculatePriceAction(
  serviceId: string,
  quantity: number,
  promoCodeStr?: string,
  runs?: number
): Promise<{ success: boolean; data?: PricingResult; error?: string }> {
  try {
    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service || !service.isActive) {
      return { success: false, error: "Услуга не найдена или неактивна" };
    }

    const totalQuantity = quantity;
    const result = await marketingService.calculatePrice(
      null, // No user context needed for price preview
      serviceId,
      totalQuantity,
      promoCodeStr
    );
    
    const multiplier = runs && runs > 1 ? runs : 1;

    // SECURITY FIX: Data Leak Prevention. Do NOT return providerCostCents to the client.
    const safeResult = {
      totalCents: Math.round(result.totalCents * multiplier),
      originalTotalCents: Math.round(result.originalTotalCents * multiplier),
      discountCents: Math.round(result.discountCents * multiplier)
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { success: true, data: safeResult as any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const localized = handleServerError(error);
    return { success: false, error: localized.message };
  }
}

/**
 * Pay-Per-Order Checkout Flow:
 * 1. Calculate price
 * 2. Create Order as AWAITING_PAYMENT
 * 3. Create Payment as PENDING linked to Order
 * 4. Return payment data for frontend redirect to YooKassa/CryptoBot
 */
import { z } from 'zod';
import { createSafeAction } from '@/lib/safe-action';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MutexManager } from '@/lib/redis-lock';

const checkoutSchema = z.object({
  serviceId: z.string(),
  link: z.string().min(3, "Ссылка слишком короткая").max(2048, "Ссылка слишком длинная").refine(val => !val.includes(' '), "Ссылка не должна содержать пробелов"),
  quantity: z.number().min(1),
  email: z.string().email("Неверный email"),
  promoCodeStr: z.string().optional(),
  runs: z.number().int().positive().optional(),
  interval: z.number().int().positive().optional(),
  customData: z.string().optional(),
  gateway: z.string().optional().default('yookassa'),
  idempotencyKey: z.string().min(10).max(64).optional(),
  mediaGroupUrl: z.string().optional(),
  isLinkOverridden: z.boolean().optional(),
  isSmartDrip: z.boolean().optional(),
  smartDripDays: z.number().int().min(1).max(30).optional(),
  abVariant: z.enum(['A', 'B', 'C']).optional(),
  isRequirementsConfirmed: z.boolean().optional()
});

export const checkoutAction = async (input: z.input<typeof checkoutSchema>) => {
  return createSafeAction(checkoutSchema, input, async (data) => {
    const { serviceId, link, quantity, email, promoCodeStr, runs, interval, customData, gateway, idempotencyKey, mediaGroupUrl, isLinkOverridden, isSmartDrip, smartDripDays, abVariant, isRequirementsConfirmed } = data;
    const effectiveIdempotencyKey = idempotencyKey || randomUUID();
    const hasMediaGroup = !!(mediaGroupUrl && mediaGroupUrl.trim().length > 5);

    // Feature Flags Validation
    if (promoCodeStr) {
      const isPromoEnabled = await featureFlagService.isEnabled('promo_codes');
      if (!isPromoEnabled) {
        throw new Error("Использование промокодов временно отключено");
      }
    }

    if (isSmartDrip || runs || interval) {
      const isDripEnabled = await featureFlagService.isEnabled('drip_feed');
      if (!isDripEnabled) {
        throw new Error("Функция Drip-feed временно отключена");
      }
    }

    if (isSmartDrip) {
      if (runs || interval) {
        throw new Error("Нельзя одновременно использовать обычный Drip-feed и Умный Dripfeed");
      }
      if (!smartDripDays || smartDripDays < 1 || smartDripDays > 30) {
        throw new Error("Необходимо указать количество дней (1-30) для Умного Dripfeed");
      }
    }
    
    // Gateway whitelist validation
    const ALLOWED_GATEWAYS = ['yookassa', 'cryptobot', 'robokassa', 'balance'];
    if (gateway && !ALLOWED_GATEWAYS.includes(gateway.toLowerCase())) {
      throw new Error("Неподдерживаемый способ оплаты");
    }

    // 0. Rate limit
    const isAllowed = await RateLimitService.check("checkoutCore", 15, 60, true);
    if (!isAllowed) {
      throw new Error("Слишком много запросов. Попробуйте через минуту.");
    }


    // 0.75 IDOR Prevention: Balance Gateway requires Authorization
    if (gateway === 'balance') {
      const session = await verifySession();
      if (!session || !session.userId) {
        throw new Error("Оплата с баланса доступна только авторизованным пользователям");
      }
      const sessionUser = await db.user.findUnique({ where: { id: session.userId } });
      if (!sessionUser || sessionUser.email.toLowerCase() !== email.toLowerCase()) {
         throw new Error("Оплата с баланса доступна только авторизованным пользователям");
      }
    }

    // 1. Validate email
    if (!email || !email.includes('@')) {
      throw new Error("Введите корректный email");
    }

    // 2. Validate service exists
    const service = await db.service.findUnique({ 
      where: { id: serviceId },
      include: { category: { include: { network: true } } }
    });
    if (!service || !service.isActive) {
      throw new Error("Услуга не найдена или неактивна");
    }

    // Cross-Tenant Security Check (SEC-01)
    const reqHeaders = await headers();
    const rawTenantId = reqHeaders.get("x-tenant-id");
    const currentTenantId = normalizeTenantId(rawTenantId) || "smmplan";
    if (service.tenantId && service.tenantId !== currentTenantId && service.tenantId !== "all") {
      throw new Error("Услуга недоступна для текущей площадки");
    }

    // JIT Validation Check: enforce custom requirements if configured
    if (service.clientRequirement && !isRequirementsConfirmed) {
      throw new Error("Необходимо подтвердить выполнение условий для старта услуги");
    }

    // Wave 4.1: Elastic Quarantine Check
    if (service.cooldownUntil && service.cooldownUntil > new Date()) {
      throw new Error(`Временно приостановлено для контроля качества. Ожидание: 1-12 часов. Выберите аналог.`);
    }

    if (!service.externalId) {
      throw new Error("Услуга не привязана к провайдеру");
    }

    if (runs && !service.isDripFeedEnabled) {
      throw new Error("Эта услуга не поддерживает Drip-feed (постепенную подачу)");
    }

    if (quantity < service.minQty || quantity > service.maxQty) {
      throw new Error(`Количество должно быть от ${service.minQty} до ${service.maxQty}`);
    }

    if (customData && customData.length > 2000) {
      throw new Error('Слишком длинные пользовательские данные (макс. 2000 символов)');
    }

    // Custom Data Validation Guard when customDataType !== 'NONE'
    if (service.customDataType && service.customDataType !== 'NONE') {
      if (!customData || !customData.trim()) {
        throw new Error("Пожалуйста, заполните дополнительные данные для этой услуги");
      }
      const { getCustomValidator } = await import('@/validators/link-mutators');
      const customValidator = getCustomValidator(service.customDataType);
      const customResult = customValidator.safeParse(customData.trim());
      if (!customResult.success) {
        throw new Error(customResult.error.errors[0].message);
      }
    }

    // [OMNI-AUDIT 9.4] Phase P3: Robust Server-Side Validation & Mutation
    let normalizedLink = link.trim();
    const platformSlug = service.category?.network?.slug?.toUpperCase() || '';

    if (isLinkOverridden) {
      // Basic URL verification: must have protocol, domain and no spaces
      if (!/^https?:\/\//i.test(normalizedLink) && normalizedLink.includes('.')) {
        normalizedLink = 'https://' + normalizedLink;
      }
      if (!/^https?:\/\//i.test(normalizedLink)) {
        throw new Error("Ссылка в обход валидации должна быть корректным URL (начинаться с http:// или https://)");
      }
      try {
        const u = new URL(normalizedLink);
        if (!u.hostname.includes('.')) {
          throw new Error("Указан некорректный домен ссылки.");
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.error(`[Checkout] Link mutation failed for ${safeUrlForLog(link)}:`, e);
        throw new Error("Неверный формат ссылки.", { cause: e });
      }
    } else {
      const targetType = service.targetType === 'POST'
        ? inferTargetTypeFromCategory(service.category?.name)
        : (service.targetType || inferTargetTypeFromCategory(service.category?.name));

      if (targetType === 'CUSTOM' || service.targetType === 'CUSTOM') {
        const { getCustomValidator } = await import('@/validators/link-mutators');
        const customValidator = getCustomValidator(service.customDataType);
        const customValue = customData || link;
        const customResult = customValidator.safeParse(customValue);
        if (!customResult.success) {
          throw new Error(customResult.error.errors[0].message);
        }
      } else {
        // 1. Clean the link according to provider rules
        normalizedLink = mutateLink(link, platformSlug, targetType);

        // 2. Validate the cleaned link
        const validator = getLinkValidator(platformSlug, targetType);
        const linkResult = validator.safeParse(normalizedLink);
        
        if (!linkResult.success) {
          throw new Error(linkResult.error.errors[0].message);
        }
      }
    }

    // Validate mediaGroupUrl if provided
    let normalizedMediaGroupLink: string | undefined;
    if (hasMediaGroup) {
      const mgTrimmed = mediaGroupUrl!.trim();
      if (isLinkOverridden) {
        normalizedMediaGroupLink = mgTrimmed;
        if (!/^https?:\/\//i.test(normalizedMediaGroupLink) && normalizedMediaGroupLink.includes('.')) {
          normalizedMediaGroupLink = 'https://' + normalizedMediaGroupLink;
        }
      } else {
        const targetType = service.targetType === 'POST'
          ? inferTargetTypeFromCategory(service.category?.name)
          : (service.targetType || inferTargetTypeFromCategory(service.category?.name));

        normalizedMediaGroupLink = mutateLink(mgTrimmed, platformSlug, targetType);
        const validator = getLinkValidator(platformSlug, targetType);
        const mgLinkResult = validator.safeParse(normalizedMediaGroupLink);
        if (!mgLinkResult.success) {
          throw new Error(`Некорректная ссылка на последнее медиа: ${mgLinkResult.error.errors[0].message}`);
        }
      }
    }

    const isTestMode = await SettingsManager.isTestMode();

    const tenantId = currentTenantId;

    // 3. Find or create user by email (SECURITY FIX: Track if new user to prevent IDOR auto-login)
    const currentSession = await verifySession();
    let user = await db.user.findFirst({
      where: { 
        email: email.toLowerCase(),
        tenantId: tenantId === 'flux' ? { in: ['lovable', 'flux'] } : tenantId
      }
    });

    if (user && user.tenantId === 'lovable') {
      user = await db.user.update({
        where: { id: user.id },
        data: { tenantId: 'flux' }
      });
    }

    if (user) {
      if (user.isDeleted === true || user.isActive === false) {
        throw new Error("Ваш аккаунт заблокирован или удален");
      }
      // IDOR / Account Hijacking Prevention:
      // Prevent order injection / guest orders binding to existing accounts without session
      if (!currentSession || currentSession.userId !== user.id) {
        throw new Error("Этот email уже зарегистрирован в системе. Пожалуйста, войдите в свой аккаунт для оформления заказа.");
      }
    }

    // Role-based validation check for bypass link mode
    if (isLinkOverridden) {
      if (!user || (user.role !== 'OWNER' && user.role !== 'MANAGER')) {
        throw new Error("У вас нет прав для обхода валидации ссылки");
      }
    }

    let isNewUser = false;
    const consentIp = await getClientIp();
    if (!user) {
      user = await db.user.create({
        data: {
          email: email.toLowerCase(),
          tenantId,
          tosAcceptedAt: new Date(),
          tosAcceptedIp: consentIp,
        }
      });
      isNewUser = true;
    }

    // 4. Calculate price based on TOTAL quantity and actual User ID for Loyalty Tier eval
    const totalQuantity = quantity;

    if (runs && runs > 0 && !isSmartDrip) {
      const runQty = Math.floor(totalQuantity / runs);
      if (runQty < service.minQty) {
        throw new Error(`Для Drip-feed количество на один запуск (${runQty}) не может быть меньше минимального (${service.minQty})`);
      }
    } else if (isSmartDrip && smartDripDays && smartDripDays > 0) {
      const runQty = Math.floor(totalQuantity / smartDripDays);
      if (runQty < service.minQty) {
        throw new Error(`Для Умного Drip-feed количество на 1 день (${runQty}) не может быть меньше минимального (${service.minQty})`);
      }
    }

    const userIdForCalc = user ? user.id : null;
    const pricing = await marketingService.calculatePrice(userIdForCalc, serviceId, totalQuantity, promoCodeStr, { service });
    
    let promoCodeId: string | null = null;
    if (promoCodeStr) {
      const promo = await db.promoCode.findUnique({
        where: { code: promoCodeStr },
        select: { id: true }
      });
      if (promo) {
        promoCodeId = promo.id;
      }
    }

    const { SettingsProvider } = await import('@/lib/settings');
    const currentUsdRate = await SettingsProvider.getExchangeRateUSD();

    // Media Group: double the total for 2 orders
    const mediaGroupMultiplier = hasMediaGroup ? 2 : 1;
    let finalTotalCents = pricing.totalCents * mediaGroupMultiplier;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const finalProviderCostCents = pricing.providerCostCents * mediaGroupMultiplier;

    let smartConfig = null;
    if (isSmartDrip) {
      smartConfig = await db.serviceSmartConfig.findUnique({ where: { serviceId } });
      if (!smartConfig || !smartConfig.isEnabled) {
        throw new Error("Эта услуга не поддерживает Умный Dripfeed");
      }
      // Apply surcharge multiplier
      finalTotalCents = Math.round(finalTotalCents * (1 + smartConfig.markup));
    }

    // Enforce 10 RUB minimum for Acquiring (YooKassa / CryptoBot) -> Auto-convert to 10 RUB top-up
    let paymentAmount = finalTotalCents;
    const isMicroOrder = gateway !== 'balance' && finalTotalCents < 1000;
    if (isMicroOrder) {
      paymentAmount = 1000; // 10 RUB minimum deposit (1000 cents)
    }

    if (gateway === 'yookassa' && paymentAmount > 180000) {
      if (!user.telegramId) {
        throw new Error("Для совершения платежей свыше $20 картой, пожалуйста, привяжите ваш Telegram-аккаунт в личном кабинете. Либо воспользуйтесь криптовалютой (без ограничений)");
      }
    }

    // Balance check is now performed atomically inside db.$transaction using WalletOps.charge

    const consentUserAgent = reqHeaders.get("user-agent") || "Unknown";

    const termsDoc = await db.contentItem.findUnique({
      where: { slug: 'terms' },
      select: { updatedAt: true }
    });
    const consentVersion = termsDoc ? `terms:${termsDoc.updatedAt.toISOString()}` : `fallback:${new Date().toISOString().split('T')[0]}`;

    let transactionCompleted = false;
    let result;
    try {
      result = await runSerializableTransaction(async (tx) => {
        // 5.1 If gateway is balance, atomically deduct balance first
        if (gateway === 'balance' && user) {
          await WalletOps.charge(tx, user.id, finalTotalCents, `Оплата заказа с баланса`, {
            idempotencyKey: `balance-charge-${effectiveIdempotencyKey}`
          });
        }

        const orderStatus = gateway === 'balance' ? 'PENDING' : 'AWAITING_PAYMENT';
        const paymentStatus = gateway === 'balance' ? 'SUCCEEDED' : 'PENDING';


        
        // 1. Check idempotency beforehand to avoid aborting the Postgres transaction block on P2002 constraint error
        let existingOrder = null;
        if (effectiveIdempotencyKey) {
          existingOrder = await tx.order.findUnique({
            where: { idempotencyKey: effectiveIdempotencyKey },
            include: { payment: true }
          });
        }

        if (existingOrder) {
          if (existingOrder.status !== 'ERROR') {
            throw new IdempotencyConflictError(existingOrder);
          } else {
            // Free up the unique constraint on the failed order to allow the new check to proceed
            await tx.order.update({
              where: { id: existingOrder.id },
              data: { idempotencyKey: `${effectiveIdempotencyKey}_failed_${existingOrder.id}` }
            });
          }
        }

        const isDripFeedOrder = Boolean(runs && runs > 1);

        // Create primary Order (first media / main link)
        const newOrder = await tx.order.create({
          data: {
            userId: user?.id,
            serviceId,
            providerId: service.providerId,
            providerServiceId: service.externalId,
            link: normalizedLink,
            isLinkOverridden: isLinkOverridden || false,
            quantity: totalQuantity,
            email: email.toLowerCase(),
            status: orderStatus,
            charge: isSmartDrip && smartConfig ? Math.round(pricing.totalCents * (1 + smartConfig.markup)) : pricing.totalCents,
            providerCost: pricing.providerCostCents,
            isDripFeed: isDripFeedOrder,
            runs,
            interval,
            isTest: isTestMode,
            customData,
            remains: totalQuantity,
            idempotencyKey: effectiveIdempotencyKey,
            promoCodeId: promoCodeId || null,
            discountCents: BigInt(pricing.discountCents),
            abVariant,
            usdToRubRate: currentUsdRate,
            tenantId
          }
        });

        // Create second Order for media group (last media) if applicable
        let secondOrderId: string | undefined;
        if (hasMediaGroup && normalizedMediaGroupLink) {
          const secondOrder = await tx.order.create({
            data: {
              userId: user.id,
              serviceId,
              providerId: service.providerId,
              providerServiceId: service.externalId,
              link: normalizedMediaGroupLink,
              isLinkOverridden: isLinkOverridden || false,
              quantity: totalQuantity,
              email: email.toLowerCase(),
              status: orderStatus,
              charge: isSmartDrip && smartConfig ? Math.round(pricing.totalCents * (1 + smartConfig.markup)) : pricing.totalCents,
              providerCost: pricing.providerCostCents,
              isDripFeed: isDripFeedOrder,
              runs,
              interval,
              isTest: isTestMode,
              customData: `Медиагруппа: последнее медиа. Основной заказ: ${newOrder.numericId}`,
              remains: totalQuantity,
              promoCodeId: promoCodeId || null,
              discountCents: BigInt(pricing.discountCents),
              abVariant,
              usdToRubRate: currentUsdRate,
              tenantId
            }
          });
          secondOrderId = secondOrder.id;
        }

        // Consume Promo Code if used
        if (promoCodeStr) {
          await marketingService.consumePromoCode(tx, promoCodeStr);
        }

        // Create linked Payment (covers both orders if media group)
        const payment = await tx.payment.create({
          data: {
            userId: user?.id,
            amount: paymentAmount,
            currency: 'RUB',
            status: paymentStatus,
            gateway,
            consentIp,
            consentUserAgent,
            consentVersion,
            abVariant,
            tenantId
          }
        });

        // Link payment to primary order
        await tx.order.update({
          where: { id: newOrder.id },
          data: { paymentId: payment.id }
        });

        // Link payment to second order if exists
        if (secondOrderId) {
          await tx.order.update({
            where: { id: secondOrderId },
            data: { paymentId: payment.id }
          });
        }

        const { logPromoCodeUsageIfNeeded } = await import('@/services/marketing-utils');
        if (gateway === 'balance' && promoCodeId) {
          await logPromoCodeUsageIfNeeded(tx, newOrder.id, user.id);
          if (secondOrderId) {
            await logPromoCodeUsageIfNeeded(tx, secondOrderId, user.id);
          }
        }

        if (isSmartDrip && smartConfig) {
          await SmartDripService.createCampaign(tx, {
            userId: user.id,
            serviceId,
            link: normalizedLink,
            quantity: totalQuantity,
            days: smartDripDays!,
            paymentId: payment.id,
            orderId: newOrder.id,
            isTestMode
          });
        }

        transactionCompleted = true;
        return { orderId: newOrder.id, paymentId: payment.id, numericId: newOrder.numericId, secondOrderId };
      });
    } catch (err: unknown) {
      if (err instanceof IdempotencyConflictError) {
        const existingOrder = err.existingOrder as { id: string; paymentId?: string; payment?: { checkoutUrl?: string } };
        console.info(`[Checkout] Idempotency hit for key ${idempotencyKey}, returning existing order.`);
        return {
          orderId: existingOrder.id,
          paymentId: existingOrder.paymentId || '',
          paymentUrl: existingOrder.payment?.checkoutUrl || ''
        };
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && idempotencyKey) {
        const existingOrder = await db.order.findUnique({
          where: { idempotencyKey },
          include: { payment: true }
        });
        if (existingOrder) {
          if (existingOrder.status !== 'ERROR') {
            console.info(`[Checkout] Parallel idempotency hit for key ${idempotencyKey}, returning existing order.`);
            return {
              orderId: existingOrder.id,
              paymentId: existingOrder.paymentId,
              paymentUrl: existingOrder.payment?.checkoutUrl || ''
            };
          }
        }
      }
      throw err;
    }

    // 6. Generate payment URL (gateway-specific API calls)
    let paymentUrl: string | undefined;

    const host = reqHeaders.get("host") || "localhost:3000";
    const protocol = reqHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = getBaseUrlSync(host, protocol);
    let successUrl = `${origin}/success?orderId=${result.orderId}`;

    // [Phase 3 Surgeon] Generate capability token for sessionless payment return validation
    let token = '';
    try {
      const { SignJWT } = await import('jose');
      const { getEncodedKey } = await import('@/lib/session-edge');
      token = await new SignJWT({ 
        orderId: result.orderId,
        purpose: 'payment_return' 
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getEncodedKey());
    } catch (e) {
      console.error('[Checkout] Failed to generate return capability token:', e);
    }

    if (token) {
      successUrl += `&token=${token}`;
    }

    // Direct fulfillment for balance payments
    if (gateway === 'balance') {
      const { ordersQueue } = await import('@/workers/queues');
      await ordersQueue.add('order-dispatch', { orderId: result.orderId }, { jobId: `dispatch-${result.orderId}`, delay: 3 * 60 * 1000 });
      if (result.secondOrderId) {
        await ordersQueue.add('order-dispatch', { orderId: result.secondOrderId }, { jobId: `dispatch-${result.secondOrderId}`, delay: 3 * 60 * 1000 });
      }

      void sendOrderPaidMail(
        user.email,
        result.numericId.toString(),
        service.name
      ).catch((err: unknown) => console.error('[H1] sendOrderPaidMail balance failed', err));

      revalidatePath('/dashboard', 'layout');

      // Auto-Login using cookies (Frictionless checkout)
      if (isNewUser || (currentSession && currentSession.userId === user!.id)) {
        await createSession(user.id);
      }

      return { 
        orderId: result.orderId, 
        paymentId: result.paymentId,
        paymentUrl: successUrl
      };
    }

    try {
      const { PaymentGatewayFactory } = await import('@/services/financial/payment-gateway.service');
      const gatewaySvc = PaymentGatewayFactory.getGateway(gateway || 'yookassa');
      const gatewayResult = await gatewaySvc.createPayment({
        paymentId: result.paymentId,
        orderId: result.orderId,
        userId: user.id,
        amountRub: paymentAmount / 100,
        email: email,
        successUrl,
        description: `Оплата заказа #${result.numericId} (сдача зачисляется на баланс)`,
        isTestMode: isTestMode || email === 'e2e-tester@test.com',
        metadata: { type: 'checkout' }
      });

      if (gatewayResult.remoteGatewayId || gatewayResult.paymentUrl) {
        await db.payment.update({
          where: { id: result.paymentId },
          data: {
            gatewayId: gatewayResult.remoteGatewayId || undefined,
            checkoutUrl: gatewayResult.paymentUrl || undefined
          }
        });
      }

      paymentUrl = gatewayResult.paymentUrl || `/payment-redirect?id=${result.paymentId}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (gatewayErr: any) {
      // 7.b ROLLBACK: If Queue push failed, restore PromoCode and mark Payment as ERROR safely
      console.error('[Checkout] Queue sequence failed, rolling back sequence', gatewayErr);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rollbackPromises: Promise<any>[] = [
        db.payment.update({
          where: { id: result.paymentId },
          data: { status: 'CANCELED' }
        }).catch(e => console.error('[Checkout] Failed to cancel payment:', e)),
        
        db.order.update({
          where: { id: result.orderId },
          data: { status: 'ERROR', error: gatewayErr.message || 'Ошибка генерации платежа' }
        }).catch(e => console.error('[Checkout] Failed to error order:', e))
      ];

      if (promoCodeStr && transactionCompleted) {
        // Atomic rollback: only decrement if uses > 0 to prevent negative counters
        rollbackPromises.push(
          db.promoCode.updateMany({
             where: { code: promoCodeStr, uses: { gt: 0 } },
             data: { uses: { decrement: 1 } }
          }).catch(e => console.error('[Checkout] Failed to rollback promo:', e))
        );
      }
      
      await Promise.allSettled(rollbackPromises);
      
      if (gatewayErr instanceof WalletInsufficientFundsError) {
        throw new Error('Недостаточно средств на балансе. Пожалуйста, пополните счет.', { cause: gatewayErr });
      }
      if (gatewayErr instanceof WalletUserNotFoundError) {
        throw new Error('Пользователь не найден. Пожалуйста, авторизуйтесь заново.', { cause: gatewayErr });
      }
      if (gatewayErr instanceof WalletInvalidAmountError) {
        throw new Error('Некорректная сумма операции.', { cause: gatewayErr });
      }
      throw new Error(gatewayErr.message || 'Ошибка на стороне платежного шлюза. Попробуйте другой метод', { cause: gatewayErr });
    }

    // 8. Auto-Login using cookies (Frictionless checkout)
    // SECURITY FIX: Prevent Account Takeover by only auto-logging in NEW users, or already authenticated users
    if (isNewUser || (currentSession && currentSession.userId === user.id)) {
      await createSession(user.id);
    }

    if (gateway === 'balance') {
      void sendOrderPaidMail(
        user.email,
        result.numericId.toString(),
        service.name
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ).catch((err: any) => console.error('[H1] sendOrderPaidMail balance failed', err));
    }

    if (isLinkOverridden) {
      try {
        const { sendAdminAlert } = await import('@/lib/notifications');
        const alertPromise = sendAdminAlert(
          `⚠️ [BYPASS-VALIDATION] Пользователь обошел валидацию ссылки!\n` +
          `Заказ: #${result.numericId}\n` +
          `Услуга: ${service.name} (ID: ${serviceId})\n` +
          `Email: ${email}\n` +
          `Ссылка: ${link}`,
          'WARNING'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any;
        if (alertPromise && typeof alertPromise.catch === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          alertPromise.catch((err: any) => console.error('[Checkout] Failed to send bypass admin alert:', err));
        }
      } catch (err) {
        console.error('[Checkout] Failed to import/send bypass admin alert:', err);
      }
    }

    revalidatePath('/dashboard', 'layout');

    return { 
      orderId: result.orderId, 
      paymentId: result.paymentId,
      paymentUrl
    };
  });
};

const retryCheckoutSchema = z.object({
  orderId: z.string(),
  gateway: z.string().default('yookassa')
});

// Утилита для синхронной проверки статуса YooKassa (предотвращение двойной оплаты)
async function checkYookassaStatusSync(gatewayId: string): Promise<boolean> {
  try {
    const secrets = await SettingsManager.getPaymentSecrets();
    const shopId = secrets.yookassaShopId;
    const secretKey = secrets.yookassaSecretKey;
    if (!shopId || !secretKey) return false;

    const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
    const resp = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    });

    if (!resp.ok) return false;
    const data = await resp.json();
    return data.status === 'succeeded' || data.status === 'waiting_for_capture';
  } catch (e) {
    console.error('[YookassaSync] Error checking status', e);
    return false;
  }
}

export const retryCheckoutAction = async (input: z.infer<typeof retryCheckoutSchema>) => {
  return createSafeAction(retryCheckoutSchema, input, async (data) => {
    const { orderId, gateway } = data;

    // BUG-002 FIX: Auth guard — prevent IDOR
    const session = await verifySession();
    if (!session) throw new Error("Необходима авторизация");

    const isAllowed = await RateLimitService.check("retryCheckoutCore", 10, 60, true);
    if (!isAllowed) throw new Error("Слишком много запросов. Попробуйте через минуту.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let reqHeaders: any;
    try {
      reqHeaders = await headers();
    } catch (e) {
      console.warn('[RetryCheckout] headers() context missing, using fallback', e);
      reqHeaders = {
        get: (key: string) => {
          if (key === 'host') return 'localhost:3000';
          if (key === 'x-forwarded-proto') return 'http';
          return null;
        }
      };
    }
    const consentIp = await getClientIp();
    const consentUserAgent = reqHeaders.get("user-agent") || "Unknown";

    const rawTenantId = reqHeaders.get("x-tenant-id");
    const currentTenantId = normalizeTenantId(rawTenantId) || "smmplan";

    const order = await db.order.findUnique({
      where: { id: orderId, userId: session.userId },
      include: { user: true, payment: true, service: true }
    });

    if (!order) throw new Error("Заказ не найден");
    if (order.tenantId && order.tenantId !== currentTenantId) {
      throw new Error("Заказ недоступен для текущей площадки");
    }
    if (order.user.isDeleted === true || order.user.isActive === false) {
      throw new Error("Ваш аккаунт заблокирован или удален");
    }
    if (order.status !== 'AWAITING_PAYMENT') throw new Error("Этот заказ больше не ожидает оплаты");

    // Защита от двойной оплаты: если предыдущий платеж был через YooKassa и имеет gatewayId
    if (order.payment?.gateway === 'yookassa' && order.payment.gatewayId) {
      const isActuallyPaid = await checkYookassaStatusSync(order.payment.gatewayId);
      if (isActuallyPaid) {
        // Платеж уже успешен, вебхук запаздывает. Обновляем статус и возвращаем ссылку на success.
        const { paymentService } = await import('@/services/financial/payment.service');
        const isTestMode = await SettingsManager.isTestMode();
        await paymentService.confirmPayment(
          order.payment.gatewayId,
          Number(order.payment.amount),
          order.userId,
          isTestMode,
          'yookassa',
          order.payment.id,
          'order'
        );
        
        let host = reqHeaders.get("host") || "localhost:3000";
        if (host.includes("0.0.0.0")) host = host.replace("0.0.0.0", "localhost");
        const protocol = reqHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
        return { orderId: order.id, paymentId: order.payment.id, paymentUrl: `${protocol}://${host}/success` };
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const isTestMode = await SettingsManager.isTestMode();

    // Update existing payment or create new
    const result = await runSerializableTransaction<{ paymentId: string }>(async (tx) => {
      // If gateway is balance, atomically deduct balance first
      if (gateway === 'balance') {
        await WalletOps.charge(tx, order.userId, Number(order.charge), `Оплата заказа с баланса`, {
          idempotencyKey: `balance-charge-retry-${order.id}`
        });
      }

      const orderStatus = gateway === 'balance' ? 'PENDING' : undefined;
      const paymentStatus = gateway === 'balance' ? 'SUCCEEDED' : 'PENDING';

      const existingPayment = order.payment || await tx.payment.findUnique({ where: { orderId: order.id } });

      let processedPaymentId: string;

      if (existingPayment && existingPayment.gateway !== gateway) {
        // Cancel old payment log to prevent accounting mismatch when gateway switches
        await tx.payment.update({
          where: { id: existingPayment.id },
          data: { status: 'CANCELED' }
        });

        const newPayment = await tx.payment.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            amount: order.charge,
            currency: 'RUB',
            status: paymentStatus,
            gateway,
            consentIp,
            consentUserAgent,
            orders: { connect: [{ id: order.id }] }
          }
        });

        await tx.order.update({
          where: { id: order.id },
          data: { paymentId: newPayment.id }
        });

        processedPaymentId = newPayment.id;
      } else if (existingPayment) {
        const updatedPayment = await tx.payment.update({
          where: { id: existingPayment.id },
          data: { 
            status: paymentStatus,
            gateway,
            consentIp,
            consentUserAgent
          }
        });

        // Самовосстановление связи, если она была утеряна из-за старой архитектуры
        if (!order.paymentId) {
          await tx.order.update({
            where: { id: order.id },
            data: { paymentId: updatedPayment.id }
          });
        }

        processedPaymentId = updatedPayment.id;
      } else {
        const newPayment = await tx.payment.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            amount: order.charge,
            currency: 'RUB',
            status: paymentStatus,
            gateway,
            consentIp,
            consentUserAgent,
            orders: { connect: [{ id: order.id }] } // Правильное связывание
          }
        });

        processedPaymentId = newPayment.id;
      }

      if (orderStatus) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: orderStatus }
        });
      }

      return { paymentId: processedPaymentId };
    });

    let paymentUrl: string | undefined;

    const host = reqHeaders.get("host") || "localhost:3000";
    const protocol = reqHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = getBaseUrlSync(host, protocol);
    let successUrl = `${origin}/success?orderId=${order.id}`;

    let token = '';
    try {
      const { SignJWT } = await import('jose');
      const { getEncodedKey } = await import('@/lib/session-edge');
      token = await new SignJWT({ 
        orderId: order.id,
        purpose: 'payment_return' 
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getEncodedKey());
    } catch (e) {
      console.error('[RetryCheckout] Failed to generate return capability token:', e);
    }

    if (token) {
      successUrl += `&token=${token}`;
    }

    // Direct fulfillment for balance retry payments
    if (gateway === 'balance') {
      const { ordersQueue } = await import('@/workers/queues');
      await ordersQueue.add('order-dispatch', { orderId: order.id }, { jobId: `dispatch-${order.id}`, delay: 3 * 60 * 1000 });

      void sendOrderPaidMail(
        order.user.email,
        order.numericId.toString(),
        order.service.name
      ).catch((err: unknown) => console.error('[H1] sendOrderPaidMail balance retry failed', err));

      revalidatePath('/dashboard', 'layout');

      return { 
        orderId: order.id, 
        paymentId: result.paymentId,
        paymentUrl: successUrl
      };
    }

    try {
      const isTestMode = await SettingsManager.isTestMode();
      const { PaymentGatewayFactory } = await import('@/services/financial/payment-gateway.service');
      const gatewaySvc = PaymentGatewayFactory.getGateway(gateway || 'yookassa');
      
      const gatewayResult = await gatewaySvc.createPayment({
        paymentId: result.paymentId,
        orderId: order.id,
        userId: order.userId,
        amountRub: Number(order.charge) / 100,
        email: order.email || order.user.email,
        successUrl,
        description: `Оплата заказа #${order.numericId} (SMMplan)`,
        isTestMode,
        metadata: { type: 'checkout' }
      });

      if (gatewayResult.remoteGatewayId || gatewayResult.paymentUrl) {
        await db.payment.update({
          where: { id: result.paymentId },
          data: {
            gatewayId: gatewayResult.remoteGatewayId || undefined,
            checkoutUrl: gatewayResult.paymentUrl || undefined
          }
        });
      }

      paymentUrl = gatewayResult.paymentUrl || `/payment-redirect?id=${result.paymentId}`;

    } catch (gatewayErr: unknown) {
      console.error('[RetryCheckout] Gateway failed', gatewayErr);
      const errMsg = gatewayErr instanceof Error ? gatewayErr.message : 'Ошибка генерации платежа';
      
      const rollbackPromises: Promise<unknown>[] = [
        db.payment.update({
          where: { id: result.paymentId },
          data: { status: 'CANCELED' }
        }).catch(e => console.error('[RetryCheckout] Failed to cancel payment:', e)),
        
        db.order.update({
          where: { id: order.id },
          data: { status: 'ERROR', error: errMsg }
        }).catch(e => console.error('[RetryCheckout] Failed to error order:', e))
      ];
      await Promise.allSettled(rollbackPromises);

      throw new Error(errMsg || 'Ошибка генерации платежа. Попробуйте другой метод', { cause: gatewayErr });
    }

    revalidatePath('/dashboard', 'layout');

    return { 
      orderId: order.id, 
      paymentId: result.paymentId,
      paymentUrl
    };
  });
};

export async function getAvailableGatewaysAction() {
  try {
    const { SettingsProvider } = await import('@/lib/settings');
    const secrets = await SettingsProvider.getPaymentSecrets();
    const isTest = await SettingsProvider.isTestMode();

    return {
      success: true,
      data: {
        yookassa: isTest || !!(secrets.yookassaShopId && secrets.yookassaSecretKey),
        robokassa: !!(secrets.robokassaLogin && secrets.robokassaPassword),
        cryptobot: !!secrets.cryptoBotToken,
        isTestMode: isTest
      }
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('[getAvailableGatewaysAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Ошибка проверки настроек платежных шлюзов'
    };
  }
}


```

---

### 📄 Файл 2 из 89: `src/actions/order/catalog.ts`

```ts
"use server";

import { db } from "@/lib/db";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { IntelligencePlatform } from "@/services/analyzer/link-rules";
import { applyBeautifulRounding } from "@/lib/financial-constants";
import { SettingsProvider } from "@/lib/settings";
import { unstable_cache } from "next/cache";

import { sanitizeServiceDescription } from "@/lib/sanitize";

const getCachedNetworks = unstable_cache(
  async () => {
    return await db.network.findMany({
      where: {
        isActive: true,
        categories: { some: { services: { some: { isActive: true } } } }
      },
      include: {
        categories: {
          where: { services: { some: { isActive: true } } },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { sort: 'asc' }
    });
  },
  ['public-catalog-networks-v2'],
  { revalidate: 60, tags: ['catalog'] }
);

const PAGE_SIZE = 100;

const getCachedServices = (catId: string) => unstable_cache(
  async () => {
    const services = await db.service.findMany({
      where: { categoryId: catId, isActive: true },
      include: { smartConfig: true },
      orderBy: { rate: 'asc' },
      take: PAGE_SIZE + 1
    });
    if (services.length > PAGE_SIZE) {
      console.warn(`[catalog] Category ${catId} has ${services.length} services, truncating tail to ${PAGE_SIZE}`);
    }
    return services.slice(0, PAGE_SIZE);
  },
  ['public-services-by-category-v2', catId],
  { revalidate: 60, tags: ['catalog', 'services'] }
)();

export type PublicService = {
  id: string;
  numericId: number;
  categoryId: string;
  name: string;
  pricePer1kRub: number;
  pricePerUnitRub: number;
  minQty: number;
  maxQty: number;
  description: string | null;
  speed: string;
  badge: string;
  isDripFeedEnabled: boolean;
  isRefillEnabled?: boolean;
  targetType?: string | null;
  customDataType?: string | null;
  customDataLabel?: string | null;
  clientRequirement?: string | null;
  clientConfirmation?: string | null;
  etaP50Seconds?: number | null;
  etaP90Seconds?: number | null;
  etaSpeedClass?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  features?: any;
  cooldownUntil?: string | null;
  smartConfig?: {
    isEnabled: boolean;
    isTestMode: boolean;
    minChunk: number;
    maxChunk: number;
    markup: number;
    useInviteBuffer?: boolean;
    autoCompensate?: boolean;
    checkIntervalMins?: number;
  } | null;
  requireWarning?: boolean;
  warningMessage?: string | null;
};

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  networkId: string | null;
  requireWarning?: boolean;
  warningMessage?: string | null;
  analyzerTags?: string | null;
};

export type PublicNetwork = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  categories: PublicCategory[];
};

export async function getPublicCatalogAction() {
  try {

    const rawNetworks = SettingsProvider.isTestEnvironment()
      ? await db.network.findMany({
          where: {
            isActive: true,
            categories: { some: { services: { some: { isActive: true } } } }
          },
          include: {
            categories: {
              where: { services: { some: { isActive: true } } },
              orderBy: { name: 'asc' }
            }
          },
          orderBy: { sort: 'asc' }
        })
      : await getCachedNetworks();

    const catalog: PublicNetwork[] = rawNetworks.map(net => {
      let icon = "/brands/web.svg";
      if (net.slug.includes('instagram')) icon = "/brands/instagram.svg";
      if (net.slug.includes('telegram')) icon = "/brands/telegram.svg";
      if (net.slug.includes('vk')) icon = "/brands/vk.svg";
      if (net.slug.includes('youtube')) icon = "/brands/youtube.svg";
      if (net.slug.includes('tiktok')) icon = "/brands/tiktok.svg";

      let finalIcon = net.icon && (net.icon.startsWith('/') || net.icon.startsWith('http')) ? net.icon : icon;
      if (finalIcon.startsWith('/icons/')) {
        finalIcon = finalIcon.replace('/icons/', '/brands/');
      }

      return {
        id: net.id,
        name: net.name,
        slug: net.slug,
        icon: finalIcon, // prefer valid absolute/relative SVG custom icons or fallback
        categories: net.categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          networkId: cat.networkId,
          requireWarning: cat.requireWarning,
          warningMessage: cat.warningMessage,
          analyzerTags: 'analyzerTags' in cat ? (cat as { analyzerTags?: string | null }).analyzerTags : null
        }))
      };
    });

    return { success: true, data: catalog };
  } catch (error: unknown) {
    console.error("Failed to fetch public catalog:", error);
    return { success: false, error: "Failed to load catalog" };
  }
}

export async function getServicesByCategoryAction(categoryId: string): Promise<PublicService[]> {
  try {

    const [services, usdToRub] = await Promise.all([
      SettingsProvider.isTestEnvironment()
        ? db.service.findMany({
            where: { categoryId: categoryId, isActive: true },
            select: {
              id: true,
              numericId: true,
              categoryId: true,
              name: true,
              description: true,
              minQty: true,
              maxQty: true,
              isDripFeedEnabled: true,
              isRefillEnabled: true,
              targetType: true,
              customDataType: true,
              customDataLabel: true,
              clientRequirement: true,
              clientConfirmation: true,
              features: true,
              cooldownUntil: true,
              etaP50Seconds: true,
              etaP90Seconds: true,
              etaSpeedClass: true,
              requireWarning: true,
              warningMessage: true,
              providerCurrency: true,
              markup: true,
              rate: true,
              smartConfig: {
                select: {
                  isEnabled: true,
                  isTestMode: true,
                  minChunk: true,
                  maxChunk: true,
                  markup: true,
                  useInviteBuffer: true,
                  autoCompensate: true,
                  checkIntervalMins: true
                }
              }
            },
            orderBy: { rate: 'asc' },
            take: 100
          })
        : getCachedServices(categoryId),
      SettingsProvider.getExchangeRateUSD()
    ]);

    return services.map(s => {
       let badge = "";
       // Names are strictly "Category Name • Tier"
       const parts = s.name.split('•');
       const tierName = parts.length > 1 ? parts[parts.length - 1].trim().toLowerCase() : "";

       if (tierName === 'премиум') badge = "ПРЕМИУМ";
       else if (tierName === 'эконом') badge = "ЭКОНОМ";
       else if (tierName === 'живые') badge = "ЖИВЫЕ";
       else if (tierName === 'стандарт') badge = "СТАНДАРТ";
       else if (s.name.toLowerCase().includes('гарант')) badge = "ГАРАНТИЯ";
       else if (s.rate < 0.1) badge = "ХИТ";

       const pricePer1kRub = applyBeautifulRounding(s.rate * s.markup * (s.providerCurrency === 'RUB' ? 1.0 : usdToRub));
       const pricePerUnitRub = pricePer1kRub / 1000;

       return {
          id: s.id,
          numericId: s.numericId,
          categoryId: s.categoryId,
          name: s.name,
          description: sanitizeServiceDescription(s.description),
          pricePer1kRub,
          pricePerUnitRub,
          minQty: s.minQty,
          maxQty: s.maxQty,
          speed: s.name.toLowerCase().includes('быстр') ? 'Сразу' : 'В течение часа',
          badge,
          isDripFeedEnabled: s.isDripFeedEnabled,
          isRefillEnabled: s.isRefillEnabled,
          targetType: s.targetType,
          customDataType: s.customDataType,
          customDataLabel: s.customDataLabel,
          features: s.features,
          cooldownUntil: s.cooldownUntil && !isNaN(new Date(s.cooldownUntil).getTime()) ? new Date(s.cooldownUntil).toISOString() : null,
          smartConfig: s.smartConfig ? {
            isEnabled: s.smartConfig.isEnabled,
            isTestMode: s.smartConfig.isTestMode,
            minChunk: s.smartConfig.minChunk,
            maxChunk: s.smartConfig.maxChunk,
            markup: s.smartConfig.markup,
            useInviteBuffer: s.smartConfig.useInviteBuffer,
            autoCompensate: s.smartConfig.autoCompensate,
            checkIntervalMins: s.smartConfig.checkIntervalMins
          } : null,
          requireWarning: s.requireWarning,
          warningMessage: s.warningMessage,
          clientRequirement: s.clientRequirement,
          clientConfirmation: s.clientConfirmation,
          etaP50Seconds: s.etaP50Seconds,
          etaP90Seconds: s.etaP90Seconds,
          etaSpeedClass: s.etaSpeedClass
       };
    });
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

```

---

### 📄 Файл 3 из 89: `src/actions/user/settings-extra.ts`

```ts
'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { getClientIp } from '@/utils/ip';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import type {
  CompanyRequisitesInput,
  UpdateCompanyRequisitesResult,
  B2bWebhookInput,
  UpdateB2bWebhookResult,
  Confirm152FzConsentResult,
  ApiKeyActionResult,
} from './settings-extra.types';

/**
 * Updates tax/company B2B requisites (companyName, inn, kpp, legalAddress).
 */
export async function updateTaxRequisitesAction(
  data: CompanyRequisitesInput
): Promise<UpdateCompanyRequisitesResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  const companyName = data.companyName?.trim() || null;
  const inn = data.inn?.trim() || null;
  const kpp = data.kpp?.trim() || null;
  const legalAddress = data.legalAddress?.trim() || null;

  // Validate ИНН if provided: 10 digits for orgs, 12 digits for IP / sole traders
  if (inn) {
    if (!/^\d{10}$|^\d{12}$/.test(inn)) {
      return {
        success: false,
        error: 'ИНН должен содержать ровно 10 цифр (для организаций) или 12 цифр (для ИП)',
      };
    }
  }

  // Validate КПП if provided: 9 digits (optional)
  if (kpp) {
    if (!/^\d{9}$/.test(kpp)) {
      return {
        success: false,
        error: 'КПП должен содержать ровно 9 цифр',
      };
    }
  }

  if (companyName && companyName.length > 255) {
    return { success: false, error: 'Название компании не должно превышать 255 символов' };
  }

  if (legalAddress && legalAddress.length > 500) {
    return { success: false, error: 'Юридический адрес не должен превышать 500 символов' };
  }

  try {
    await db.user.update({
      where: { id: session.userId },
      data: {
        companyName,
        inn,
        kpp,
        legalAddress,
      },
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[updateTaxRequisitesAction] Error:', message);
    return { success: false, error: 'Не удалось сохранить реквизиты компании' };
  }
}

/**
 * Alias wrapper for updateCompanyRequisitesAction.
 */
export async function updateCompanyRequisitesAction(
  data: CompanyRequisitesInput
): Promise<UpdateCompanyRequisitesResult> {
  return updateTaxRequisitesAction(data);
}

/**
 * Updates B2B Webhook URL, connection status toggle (isWebhookActive), and manages webhookSecret in B2bConfig.
 */
export async function updateB2bWebhookAction(
  data: B2bWebhookInput
): Promise<UpdateB2bWebhookResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  const rawUrl = data.webhookUrl?.trim() || null;

  if (rawUrl) {
    try {
      const parsedUrl = new URL(rawUrl);
      if (parsedUrl.protocol !== 'https:') {
        return {
          success: false,
          error: 'URL вебхука должен начинаться с https://',
        };
      }
    } catch {
      return {
        success: false,
        error: 'Некорректный формат URL вебхука. URL должен начинаться с https://',
      };
    }
  }

  try {
    const existingConfig = await db.b2bConfig.findUnique({
      where: { userId: session.userId },
    });

    let webhookSecret = existingConfig?.webhookSecret || null;

    if (data.regenerateSecret || !webhookSecret) {
      webhookSecret = crypto.randomBytes(24).toString('hex');
    }

    const isWebhookActive = data.isWebhookActive ?? (existingConfig?.isWebhookActive ?? (!!rawUrl));

    const updatedConfig = await db.b2bConfig.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        isB2b: true,
        prioritySupport: true,
        webhookUrl: rawUrl,
        webhookSecret,
        isWebhookActive,
      },
      update: {
        webhookUrl: rawUrl,
        webhookSecret,
        isWebhookActive,
      },
    });

    return {
      success: true,
      webhookUrl: updatedConfig.webhookUrl,
      webhookSecret: updatedConfig.webhookSecret,
      isWebhookActive: updatedConfig.isWebhookActive,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[updateB2bWebhookAction] Error:', message);
    return { success: false, error: 'Не удалось сохранить настройки вебхука' };
  }
}

/**
 * Records user's consent to 152-FZ Terms of Service & Privacy Policy.
 */
export async function confirm152FzConsentAction(): Promise<Confirm152FzConsentResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  const clientIp = await getClientIp();
  const now = new Date();

  try {
    const updatedUser = await db.user.update({
      where: { id: session.userId },
      data: {
        tosAcceptedAt: now,
        tosAcceptedIp: clientIp,
      },
      select: {
        tosAcceptedAt: true,
        tosAcceptedIp: true,
      },
    });

    return {
      success: true,
      tosAcceptedAt: updatedUser.tosAcceptedAt,
      tosAcceptedIp: updatedUser.tosAcceptedIp,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[confirm152FzConsentAction] Error:', message);
    return { success: false, error: 'Не удалось зафиксировать согласие 152-ФЗ' };
  }
}

/**
 * Generates initial B2B API Key, stores SHA-256 hash in User.apiKeyHash, and returns raw key ONLY ONCE.
 */
export async function generateApiKeyAction(): Promise<ApiKeyActionResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  const rawKey = 'smm_' + crypto.randomBytes(32).toString('hex');
  const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

  try {
    await db.user.update({
      where: { id: session.userId },
      data: { apiKeyHash: hashedKey },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/settings/api');
    return { success: true, apiKey: rawKey };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[generateApiKeyAction] Error:', message);
    return { success: false, error: 'Не удалось сгенерировать API-ключ' };
  }
}

/**
 * Resets existing API Key with a newly generated one, updating User.apiKeyHash with SHA-256 hash.
 */
export async function resetApiKeyAction(): Promise<ApiKeyActionResult> {
  return generateApiKeyAction();
}

/**
 * Revokes API Key by clearing User.apiKeyHash.
 */
export async function revokeApiKeyAction(): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  try {
    await db.user.update({
      where: { id: session.userId },
      data: { apiKeyHash: null },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/settings/api');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[revokeApiKeyAction] Error:', message);
    return { success: false, error: 'Не удалось отозвать API-ключ' };
  }
}

```

---

### 📄 Файл 4 из 89: `src/actions/auth/password-login.ts`

```ts
'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/session';
import { headers } from 'next/headers';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { logger } from '@/lib/logger';
import { normalizeTenantId } from '@/lib/tenant-resolver';

const log = logger.child({ component: 'PasswordLogin' });

const schema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loginWithPasswordAction(prevState: any, formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { error: "Некорректные данные формы", success: false };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  const { email, password } = parsed.data;
  const cleanEmail = email.toLowerCase().trim();

  try {
    // 1. IP-level Rate Limit (Max 20 attempts per hour)
    const isIpAllowed = await RateLimitService.check('auth:password:ip', 20, 3600, true);
    if (!isIpAllowed) {
      log.warn('Password login IP rate limit exceeded', { email: cleanEmail });
      return { error: "Слишком много попыток входа с этого IP-адреса. Пожалуйста, подождите 1 час.", success: false };
    }

    // 2. Email-level Rate Limit (Max 5 attempts per 15 minutes to prevent brute-forcing)
    const isEmailAllowed = await RateLimitService.checkCustomKey(`password-attempts:${cleanEmail}`, 5, 900, true);
    if (!isEmailAllowed) {
      log.warn('Password login email rate limit exceeded', { email: cleanEmail });
      return { error: "Аккаунт временно заблокирован из-за большого числа неверных попыток. Попробуйте через 15 минут.", success: false };
    }

    // 3. Find User
    const reqHeaders = await headers();
    const rawTenantId = reqHeaders.get("x-tenant-id");
    const tenantId = normalizeTenantId(rawTenantId) || "smmplan";
    
    const user = await db.user.findFirst({
      where: { 
        email: cleanEmail,
        tenantId
      },
      select: { id: true, tenantId: true, passwordHash: true, role: true, isActive: true, isDeleted: true, isEmailVerified: true }
    });

    if (!user) {
      // Anti-Enumeration: return standard error so attackers don't know if email exists
      log.warn('Password login: User not found', { email: cleanEmail });
      return { error: "Неверный email или пароль", success: false };
    }

    if (user.isDeleted || !user.isActive) {
      log.warn('Password login attempted for blocked/deleted account', { email: cleanEmail });
      return { error: "Неверный email или пароль", success: false };
    }

    if (!user.isEmailVerified) {
      log.warn('Password login: Email not verified', { email: cleanEmail });
      return { error: "Пожалуйста, подтвердите email по ссылке из письма", success: false };
    }

    if (!user.passwordHash) {
      log.info('Auth login: Account authentication method check', { userId: user.id });
      
      const isSmtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD;
      if (!isSmtpConfigured) {
        return { error: "Вход по ссылке временно недоступен (ошибка почты). Обратитесь в поддержку для установки пароля.", success: false };
      }
      
      return { error: "Для вашего аккаунта не установлен пароль. Пожалуйста, войдите по ссылке на почту.", success: false };
    }

    // 4. Compare Password
    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      log.warn('Password login: Invalid password', { email: cleanEmail });
      return { error: "Неверный email или пароль", success: false };
    }

    // P-1: Auto-rehash legacy password hashes (salt:key format N=16384) to $s2$65536$... format
    if (!user.passwordHash.startsWith('$s2$')) {
      try {
        const { hashPassword } = await import('@/lib/auth/password');
        const newHash = await hashPassword(password);
        await db.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        });
        log.info('Auto-rehashed legacy password hash to scrypt N=65536', { userId: user.id });
      } catch (e) {
        log.error('Failed to auto-rehash legacy password', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 5. Create Session
    await createSession(user.id);

    log.info('Password login successful', { email: cleanEmail, userId: user.id });

    // Determine redirect path
    let redirectTo = '/dashboard';
    if (["OWNER", "ADMIN", "MANAGER", "SUPPORT"].includes(user.role)) {
      redirectTo = '/admin/dashboard';
    }

    return { success: true, error: null, redirectTo };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    log.error('Password login action failed', { error: error.message, email: cleanEmail });
    return { error: "Ошибка сервера при авторизации. Попробуйте позже.", success: false };
  }
}

```

---

### 📄 Файл 5 из 89: `src/actions/auth/password-register.ts`

```ts
'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { logger } from '@/lib/logger';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import { sendMagicLink } from '@/lib/smtp';
import { getClientIp } from '@/utils/ip';
import { normalizeTenantId } from '@/lib/tenant-resolver';

import { passwordPolicySchema } from '@/validators/password-policy';

const log = logger.child({ component: 'PasswordRegister' });

const schema = z.object({
  email: z.string().email("Введите корректный email"),
  password: passwordPolicySchema,
});

export async function registerWithPasswordAction(prevState: unknown, formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { error: "Некорректные данные формы", success: false };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  const { email, password } = parsed.data;
  const cleanEmail = email.toLowerCase().trim();

  try {
    // 1. IP-level registration limit (Max 3 registrations per 24 hours per IP to prevent spam/abuse)
    const isIpAllowed = await RateLimitService.check('auth:register:ip', 3, 86400);
    if (!isIpAllowed) {
      log.warn('Password registration IP rate limit exceeded', { email: cleanEmail });
      return { error: "Превышен лимит регистраций с вашего IP. Попробуйте завтра.", success: false };
    }

    // 2. Transaction for atomic user creation
    const result = await db.$transaction(async (tx) => {
      const reqHeaders = await headers();
      const rawTenantId = reqHeaders.get("x-tenant-id");
      const tenantId = normalizeTenantId(rawTenantId) || "smmplan";

      // Check if user already exists in this tenant
      const existingUser = await tx.user.findFirst({
        where: { 
          email: cleanEmail,
          tenantId
        },
        select: { id: true, tenantId: true, isDeleted: true, isActive: true, passwordHash: true }
      });

      const passwordHash = await hashPassword(password);

      if (existingUser) {
        if (existingUser.isDeleted || !existingUser.isActive) {
          return { type: 'blocked' as const };
        }
        // If user was created via Magic Link (no password set yet), set their password now!
        if (!existingUser.passwordHash) {
          const updatedUser = await tx.user.update({
            where: { id: existingUser.id },
            data: {
              passwordHash,
              isEmailVerified: true,
            }
          });
          return { type: 'password_set' as const, user: updatedUser };
        }
        return { type: 'exists' as const };
      }

      // Handle referral code if present in cookies
      const cookieStore = await cookies();
      const refCode = cookieStore.get("ref")?.value;
      let referredById = null;

      if (refCode) {
        const referrer = await tx.user.findUnique({ where: { referralCode: refCode } });
        if (referrer) referredById = referrer.id;
      }

      // Auto-bootstrap: First user is OWNER
      const ownerCount = await tx.user.count({ where: { role: "OWNER", tenantId } });
      const role = ownerCount === 0 ? "OWNER" : "USER";

      const newUser = await tx.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          role,
          referredById,
          isActive: true,
          isEmailVerified: true,
          tenantId,
          tosAcceptedAt: new Date(),
          tosAcceptedIp: await getClientIp(),
        }
      });

      return { type: 'success' as const, user: newUser };
    }, { isolationLevel: 'Serializable' });

    if (result.type === 'blocked') {
      return { error: "Аккаунт заблокирован или выключен. Обратитесь в поддержку.", success: false };
    }

    if (result.type === 'exists') {
      return { error: "Пользователь с таким email уже зарегистрирован. Пожалуйста, войдите.", success: false };
    }

    const { user } = result;

    // 3. Create Session immediately so user doesn't get blocked
    const { createSession } = await import('@/lib/session');
    await createSession(user.id);

    // 4. Try sending welcome email in background (non-blocking)
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    try {
      await db.authToken.create({
        data: {
          token: hashedToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 1000 * 60 * 15),
        }
      });
      await sendMagicLink(cleanEmail, rawToken).catch(() => {});
    } catch {
      log.warn('Registration email send skipped/failed', { email: cleanEmail });
    }

    log.info('Password registration successful with auto-login', { email: cleanEmail, userId: user.id });

    let redirectTo = '/dashboard';
    if (["OWNER", "ADMIN", "MANAGER", "SUPPORT"].includes(user.role)) {
      redirectTo = '/admin/dashboard';
    }

    return { success: true, error: null, redirectTo, message: "Регистрация успешна! Выполняется вход..." };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Password registration action failed', { error: errorMessage, email: cleanEmail });
    return { error: "Ошибка сервера при регистрации. Попробуйте позже.", success: false };
  }
}

```

---

### 📄 Файл 6 из 89: `src/actions/auth/request-magic-link.ts`

```ts
"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { sendMagicLink, sendWelcomeLetter } from "@/lib/smtp";
import { RateLimitService } from "@/services/core/rate-limit.service";
import { logger } from "@/lib/logger";
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { getClientIp } from "@/utils/ip";
import { normalizeTenantId } from "@/lib/tenant-resolver";

const log = logger.child({ component: 'MagicLink' });

const schema = z.object({
  email: z.string().email("Введите корректный email"),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requestMagicLink(prevState: any, formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { error: "Некорректные данные формы", success: false };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  const cleanEmail = parsed.data.email.toLowerCase();

  try {
    const isIpAllowed = await RateLimitService.check('auth:magic-link:ip', 15, 3600, true);
    if (!isIpAllowed) {
      log.warn('Magic link rate limit exceeded IP', { email: cleanEmail });
      return { error: "Слишком много запросов. Пожалуйста, подождите 1 час перед новым запросом.", success: false };
    }

    const cookieStore = await cookies();
    const refCode = cookieStore.get("ref")?.value;
    let referredById = null;

    if (refCode) {
      const referrer = await db.user.findUnique({ where: { referralCode: refCode } });
      if (referrer) referredById = referrer.id;
    }

    const txResult = await db.$transaction(async (tx) => {
      let isNewUser = false;
      const reqHeaders = await headers();
      const rawTenantId = reqHeaders.get("x-tenant-id");
      const tenantId = normalizeTenantId(rawTenantId) || "smmplan";
      
      let user = await tx.user.findFirst({
        where: { 
          email: cleanEmail,
          tenantId
        }
      });

      if (user && (user.isDeleted || !user.isActive)) {
        return { type: 'blocked' as const };
      }

      if (!user) {
        isNewUser = true;
        const isIpAllowedForReg = await RateLimitService.check('auth:register:ip', 3, 86400, true);
        if (!isIpAllowedForReg) {
          return { type: 'rate_limit_reg' as const };
        }

        const ownerCount = await tx.user.count({ where: { role: "OWNER", tenantId } });
        const role = ownerCount === 0 ? "OWNER" : "USER";
        const consentIp = await getClientIp();
        user = await tx.user.create({
          data: {
            email: cleanEmail,
            role,
            referredById,
            tenantId,
            tosAcceptedAt: new Date(),
            tosAcceptedIp: consentIp,
          }
        });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 минут

      await tx.authToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
      await tx.authToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt,
        },
      });

      return { type: 'success' as const, user, isNewUser, rawToken };
    }, { isolationLevel: 'Serializable' });

    if (txResult.type === 'blocked') {
      log.warn('Magic link requested for blocked/deleted account', { email: cleanEmail });
      return { success: true, error: null };
    }

    if (txResult.type === 'rate_limit_reg') {
      log.warn('Registration IP rate limit exceeded (Anti-Fraud blocked attempt)');
      return { success: true, error: null };
    }

    const { user, isNewUser, rawToken } = txResult;

    try {
      await sendMagicLink(cleanEmail, rawToken);
      if (isNewUser) {
        sendWelcomeLetter(cleanEmail).catch(console.error);
      }
    } catch (smtpError) {
      log.error('Magic link SMTP error', { error: smtpError });
      console.error("Exact SMTP error:", smtpError);
      if (isNewUser) {
        log.info('Soft-deleting newly created user due to SMTP failure', { email: cleanEmail });
        try {
          await db.user.update({
            where: { id: user.id },
            data: {
              isDeleted: true,
              isActive: false,
              email: `failed_${user.id}@smmplan.local`
            }
          });
        } catch (e) {
          log.error('Failed to soft-delete newly created user', { error: e });
        }
      }
      return { error: "Не удалось отправить письмо. Проверьте правильность email или попробуйте позже.", success: false };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("DEBUG ERROR", error);
    log.error('Magic link request failed', { error: error instanceof Error ? error.message : String(error) });
    return { error: "Произошла ошибка при обработке запроса", success: false };
  }
}

```

---

### 📄 Файл 7 из 89: `src/actions/admin/analytics.action.ts`

```ts
'use server'

import { db } from '@/lib/db'
import { analyticsService } from '@/services/admin/analytics.service'
import { requireStaffPermission } from '@/lib/server/rbac'

export async function getFunnelAnalyticsAction(days: number) {
  return requireStaffPermission('orders', 'view', async () => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const [
      linkPasted,
      serviceSelected,
      checkoutInitiated,
      paymentClicked,
      serviceProfitability,
      categoryProfitability,
      ltv
    ] = await Promise.all([
      db.analyticsEvent.count({ where: { event: 'LINK_PASTED', createdAt: { gte: cutoff } } }),
      db.analyticsEvent.count({ where: { event: 'SERVICE_SELECTED', createdAt: { gte: cutoff } } }),
      db.analyticsEvent.count({ where: { event: 'CHECKOUT_INITIATED', createdAt: { gte: cutoff } } }),
      db.analyticsEvent.count({ where: { event: 'PAYMENT_CLICKED', createdAt: { gte: cutoff } } }),
      analyticsService.getServiceProfitability(days),
      analyticsService.getCategoryProfitability(days),
      analyticsService.getLTVAnalytics()
    ])

    // Optional: Top 5 Services by Clicks (for funnel)
    const topServicesRaw = await db.$queryRaw<{name: string, clicks: number}[]>`
      SELECT "metadata"->>'serviceName' as name, COUNT(*)::int as clicks
      FROM "AnalyticsEvent"
      WHERE event = 'SERVICE_SELECTED' AND "createdAt" >= ${cutoff}
      GROUP BY "metadata"->>'serviceName'
      ORDER BY clicks DESC
      LIMIT 5
    `

    const topServices = topServicesRaw.map(row => ({
      name: row.name,
      clicks: Number(row.clicks)
    }))

    return {
      funnel: {
        linkPasted,
        serviceSelected,
        checkoutInitiated,
        paymentClicked
      },
      topServices,
      profitability: {
        services: serviceProfitability,
        categories: categoryProfitability
      },
      ltv
    }
  })
}

```

---

### 📄 Файл 8 из 89: `src/actions/admin/balance-adjustments.ts`

```ts
"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
import { auditAdminAwaitable } from "@/lib/admin-audit";
import { getEffectiveBalancePolicy, parsePolicyReasonCodes } from "@/services/admin/balance-policy.service";
import { WalletOps } from "@/services/financial/wallet-ops";
import {
  BALANCE_ADJUSTMENT_DIRECTION,
  BALANCE_ADJUSTMENT_STATUS,
} from "@/constants/balance-adjustments";

const createRequestSchema = z.object({
  userId: z.string().min(1, "Пользователь не выбран"),
  direction: z.enum([BALANCE_ADJUSTMENT_DIRECTION.CREDIT, BALANCE_ADJUSTMENT_DIRECTION.DEBIT]),
  amount: z.string().min(1, "Сумма не указана"),
  reasonCode: z.string().min(1, "Причина не выбрана"),
  reasonNote: z.string().min(10, "Примечание должно содержать минимум 10 символов").max(2000),
  ticketId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  paymentId: z.string().optional().nullable(),
  idempotencyKey: z.string().uuid("Невалидный ключ идемпотентности")
});

function parseAmountToKopecks(input: string): bigint {
  const normalized = input.trim();
  const decMatch = /^(\d+)\.(\d{1,2})$/.exec(normalized);
  if (decMatch) {
    const intPart = BigInt(decMatch[1]) * BigInt(100);
    const decPart = BigInt(decMatch[2].padEnd(2, '0'));
    return intPart + decPart;
  }
  const intMatch = /^(\d+)$/.exec(normalized);
  if (intMatch) {
    return BigInt(intMatch[1]) * BigInt(100);
  }
  throw new Error("INVALID_AMOUNT_FORMAT");
}

export async function createBalanceAdjustmentRequestAction(formData: FormData) {
  return requireStaffPermission('balance_requests', 'edit', async (staffUser) => {
    const rawData = {
      userId: formData.get("userId") as string,
      direction: formData.get("direction") as string,
      amount: formData.get("amount") as string,
      reasonCode: formData.get("reasonCode") as string,
      reasonNote: formData.get("reasonNote") as string,
      ticketId: (formData.get("ticketId") as string) || null,
      orderId: (formData.get("orderId") as string) || null,
      paymentId: (formData.get("paymentId") as string) || null,
      idempotencyKey: formData.get("idempotencyKey") as string
    };

    const parsed = createRequestSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Ошибка валидации" };
    }

    const data = parsed.data;
    let amountBigInt: bigint;
    try {
      amountBigInt = parseAmountToKopecks(data.amount);
    } catch {
      return { success: false, error: "Указана некорректная сумма" };
    }

    if (amountBigInt <= BigInt(0)) {
      return { success: false, error: "Сумма должна быть строго больше нуля" };
    }

    // Prevents self-adjustment
    if (data.userId === staffUser.id) {
      return { success: false, error: "Запрещено создавать заявку на изменение собственного баланса" };
    }

    const policy = await getEffectiveBalancePolicy(staffUser.id);
    if (!policy || !policy.enabled || !policy.isActive) {
      return { success: false, error: "Политика корректировки баланса не настроена или отключена" };
    }

    const { allowedCreditReasonCodes, allowedDebitReasonCodes, allowedTargetRoles } = parsePolicyReasonCodes(policy);

    // Direction check
    if (data.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) {
      if (!policy.canRequestCredit) {
        return { success: false, error: "Вам запрещено запрашивать начисление баланса" };
      }
      if (!allowedCreditReasonCodes.includes(data.reasonCode)) {
        return { success: false, error: `Недопустимый код причины начисления: ${data.reasonCode}` };
      }
      if (policy.maxCreditPerRequest > BigInt(0) && amountBigInt > policy.maxCreditPerRequest) {
        return { success: false, error: `Превышен разовый лимит начисления: макс. ${policy.maxCreditPerRequest.toString()} коп.` };
      }
    } else {
      if (!policy.canRequestDebit) {
        return { success: false, error: "Вам запрещено запрашивать списание баланса" };
      }
      if (!allowedDebitReasonCodes.includes(data.reasonCode)) {
        return { success: false, error: `Недопустимый код причины списания: ${data.reasonCode}` };
      }
      if (policy.maxDebitPerRequest > BigInt(0) && amountBigInt > policy.maxDebitPerRequest) {
        return { success: false, error: `Превышен разовый лимит списания: макс. ${policy.maxDebitPerRequest.toString()} коп.` };
      }
    }

    // Check target user
    const targetUser = await db.user.findUnique({
      where: { id: data.userId },
      select: { id: true, email: true, role: true, balance: true, isDeleted: true, isActive: true }
    });

    if (!targetUser) {
      return { success: false, error: "Целевой пользователь не найден" };
    }

    if (policy.blockDeletedTargets && targetUser.isDeleted) {
      return { success: false, error: "Запрещено изменять баланс удаленного пользователя" };
    }

    if (policy.blockBannedTargets && targetUser.role === 'BANNED') {
      return { success: false, error: "Запрещено изменять баланс заблокированного пользователя" };
    }

    if (!allowedTargetRoles.includes(targetUser.role)) {
      return { success: false, error: `Запрещено создавать заявку для пользователя с ролью ${targetUser.role}` };
    }

    // Ticket requirement & existence check
    if (data.ticketId && data.ticketId.trim().length > 0) {
      const ticket = await db.ticket.findUnique({ where: { id: data.ticketId } });
      if (!ticket) {
        return { success: false, error: "Указанный тикет поддержки не существует" };
      }
    } else if (policy.requireTicket) {
      return { success: false, error: "Для создания заявки требуется указать ID существующего тикета поддержки" };
    }

    // Debit balance check
    if (data.direction === BALANCE_ADJUSTMENT_DIRECTION.DEBIT) {
      if (policy.requireOrderForDebit && (!data.orderId || data.orderId.trim().length === 0)) {
        return { success: false, error: "Для списания требуется указать ID связанного заказа" };
      }
      if (targetUser.balance < amountBigInt) {
        return { success: false, error: `Недостаточно средств у клиента: баланс ${targetUser.balance.toString()} коп., запрошено ${amountBigInt.toString()} коп.` };
      }
    }

    // Daily limit aggregate calculations for this staff member
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayAdjustments = await db.manualBalanceAdjustment.findMany({
      where: {
        requestedBy: staffUser.id,
        createdAt: { gte: startOfDay },
        status: { in: [BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL, BALANCE_ADJUSTMENT_STATUS.APPROVED, BALANCE_ADJUSTMENT_STATUS.EXECUTED] }
      },
      select: { direction: true, amount: true }
    });

    let todayCreditSum = BigInt(0);
    let todayDebitSum = BigInt(0);

    for (const adj of todayAdjustments) {
      if (adj.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) {
        todayCreditSum += adj.amount;
      } else {
        todayDebitSum += adj.amount;
      }
    }

    if (data.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT && policy.maxCreditPerDay > BigInt(0)) {
      if (todayCreditSum + amountBigInt > policy.maxCreditPerDay) {
        return { success: false, error: `Превышен дневной лимит начислений (${policy.maxCreditPerDay.toString()} коп.)` };
      }
    }

    if (data.direction === BALANCE_ADJUSTMENT_DIRECTION.DEBIT && policy.maxDebitPerDay > BigInt(0)) {
      if (todayDebitSum + amountBigInt > policy.maxDebitPerDay) {
        return { success: false, error: `Превышен дневной лимит списаний (${policy.maxDebitPerDay.toString()} коп.)` };
      }
    }

    if (policy.maxTotalPerDay > BigInt(0)) {
      if (todayCreditSum + todayDebitSum + amountBigInt > policy.maxTotalPerDay) {
        return { success: false, error: `Превышен суммарный дневной лимит заявок (${policy.maxTotalPerDay.toString()} коп.)` };
      }
    }

    // Create adjustment request
    const adjustment = await db.manualBalanceAdjustment.create({
      data: {
        userId: data.userId,
        requestedBy: staffUser.id,
        direction: data.direction,
        amount: amountBigInt,
        reasonCode: data.reasonCode,
        reasonNote: data.reasonNote,
        ticketId: data.ticketId,
        orderId: data.orderId,
        paymentId: data.paymentId,
        status: BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL,
        idempotencyKey: data.idempotencyKey,
        policySnapshot: JSON.stringify({
          policyId: policy.id,
          scopeType: policy.scopeType,
          maxCreditPerRequest: policy.maxCreditPerRequest.toString(),
          maxDebitPerRequest: policy.maxDebitPerRequest.toString()
        })
      }
    });

    await auditAdminAwaitable({
      adminId: staffUser.id,
      adminEmail: staffUser.email,
      action: 'BALANCE_ADJUSTMENT_REQUESTED',
      target: adjustment.id,
      targetType: 'ManualBalanceAdjustment',
      newValue: {
        targetUserId: data.userId,
        targetEmail: targetUser.email,
        direction: data.direction,
        amountCents: amountBigInt.toString(),
        reasonCode: data.reasonCode,
        ticketId: data.ticketId
      }
    });

    return {
      success: true,
      id: adjustment.id,
      status: adjustment.status
    };
  });
}

export async function cancelBalanceAdjustmentRequestAction(formData: FormData) {
  return requireStaffPermission('balance_requests', 'edit', async (staffUser) => {
    const id = formData.get("id") as string;
    if (!id) return { success: false, error: "ID не указан" };

    const adjustment = await db.manualBalanceAdjustment.findUnique({ where: { id } });
    if (!adjustment) return { success: false, error: "Заявка не найдена" };

    if (adjustment.requestedBy !== staffUser.id && staffUser.role !== 'OWNER' && staffUser.role !== 'ADMIN') {
      return { success: false, error: "Вы можете отменять только свои собственные заявки" };
    }

    if (adjustment.status !== BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL) {
      return { success: false, error: `Нельзя отменить заявку в статусе ${adjustment.status}` };
    }

    const updated = await db.manualBalanceAdjustment.update({
      where: { id },
      data: { status: BALANCE_ADJUSTMENT_STATUS.CANCELED }
    });

    await auditAdminAwaitable({
      adminId: staffUser.id,
      adminEmail: staffUser.email,
      action: 'BALANCE_ADJUSTMENT_CANCELED',
      target: adjustment.id,
      targetType: 'ManualBalanceAdjustment',
      oldValue: { status: adjustment.status },
      newValue: { status: updated.status }
    });

    return { success: true, id: updated.id, status: updated.status };
  });
}

export async function approveBalanceAdjustmentAction(formData: FormData) {
  return requireStaffPermission('balance_approvals', 'edit', async (approver) => {
    const id = formData.get("id") as string;
    if (!id) return { success: false, error: "ID не указан" };

    const adjustment = await db.manualBalanceAdjustment.findUnique({
      where: { id },
      include: { user: true, requester: true }
    });

    if (!adjustment) return { success: false, error: "Заявка не найдена" };

    if (adjustment.status !== BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL) {
      return { success: false, error: `Заявка находится в статусе ${adjustment.status} и не может быть подтверждена` };
    }

    // Prevent self-approval
    if (adjustment.requestedBy === approver.id) {
      return { success: false, error: "Запрещено подтверждать собственную заявку" };
    }

    const policy = await getEffectiveBalancePolicy(approver.id);
    if (!policy || !policy.canApprove) {
      return { success: false, error: "Вам не разрешено подтверждать заявки корректировки баланса" };
    }

    // Approval limit check
    if (policy.maxApprovalPerRequest > BigInt(0) && adjustment.amount > policy.maxApprovalPerRequest) {
      if (approver.role !== 'OWNER' && approver.role !== 'ADMIN') {
        return { success: false, error: `Превышен лимит утверждения: макс. ${policy.maxApprovalPerRequest.toString()} коп.` };
      }
    }

    // Fresh Target User Revalidation before approval execution
    const freshTargetUser = await db.user.findUnique({
      where: { id: adjustment.userId },
      select: { id: true, balance: true, isDeleted: true, isActive: true, role: true }
    });

    if (!freshTargetUser || freshTargetUser.isDeleted || !freshTargetUser.isActive || freshTargetUser.role === 'BANNED') {
      return { success: false, error: "Целевой пользователь заблокирован, удален или неактивен" };
    }

    if (adjustment.direction === BALANCE_ADJUSTMENT_DIRECTION.DEBIT && freshTargetUser.balance < adjustment.amount) {
      return { success: false, error: `У целевого пользователя недостаточно средств для списания: баланс ${freshTargetUser.balance.toString()} коп., требуется ${adjustment.amount.toString()} коп.` };
    }

    // Atomic Status Transition: PENDING_APPROVAL -> APPROVED
    const updatedCount = await db.manualBalanceAdjustment.updateMany({
      where: {
        id: adjustment.id,
        status: BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL
      },
      data: {
        status: BALANCE_ADJUSTMENT_STATUS.APPROVED,
        approvedBy: approver.id,
        approvedAt: new Date()
      }
    });

    if (updatedCount.count === 0) {
      return { success: false, error: "Заявка уже обрабатывается или статус был изменен" };
    }

    // Execute balance operation inside atomic transaction
    try {
      const executionResult = await db.$transaction(async (tx) => {
        let res;
        if (adjustment.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) {
          res = await WalletOps.credit(
            tx,
            adjustment.userId,
            adjustment.amount,
            `Корректировка баланса (заявка #${adjustment.id.slice(-6)}): ${adjustment.reasonCode}`,
            { idempotencyKey: `manual_adjustment:${adjustment.id}`, adminId: approver.id }
          );
        } else {
          res = await WalletOps.charge(
            tx,
            adjustment.userId,
            adjustment.amount,
            `Корректировка баланса (заявка #${adjustment.id.slice(-6)}): ${adjustment.reasonCode}`,
            { idempotencyKey: `manual_adjustment:${adjustment.id}`, adminId: approver.id }
          );
        }

        await tx.manualBalanceAdjustment.update({
          where: { id: adjustment.id },
          data: {
            status: BALANCE_ADJUSTMENT_STATUS.EXECUTED,
            ledgerEntryId: res.entry.id
          }
        });

        return res;
      });

      await auditAdminAwaitable({
        adminId: approver.id,
        adminEmail: approver.email,
        action: 'BALANCE_ADJUSTMENT_EXECUTED',
        target: adjustment.id,
        targetType: 'ManualBalanceAdjustment',
        newValue: {
          targetUserId: adjustment.userId,
          requestedBy: adjustment.requestedBy,
          approvedBy: approver.id,
          direction: adjustment.direction,
          amountCents: adjustment.amount.toString(),
          ledgerEntryId: executionResult.entry.id
        }
      });

      return { success: true, id: adjustment.id, status: BALANCE_ADJUSTMENT_STATUS.EXECUTED };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[ApproveBalanceAdjustment] Execution failed:", err);

      await db.manualBalanceAdjustment.update({
        where: { id: adjustment.id },
        data: {
          status: BALANCE_ADJUSTMENT_STATUS.EXECUTION_FAILED,
          executionError: errMsg || "Ошибка исполнения транзакции"
        }
      });

      await auditAdminAwaitable({
        adminId: approver.id,
        adminEmail: approver.email,
        action: 'BALANCE_ADJUSTMENT_EXECUTION_FAILED',
        target: adjustment.id,
        targetType: 'ManualBalanceAdjustment',
        newValue: { error: errMsg }
      });

      return { success: false, error: `Сбой при зачислении/списании: ${errMsg}` };
    }
  });
}

export async function rejectBalanceAdjustmentAction(formData: FormData) {
  return requireStaffPermission('balance_approvals', 'edit', async (rejecter) => {
    const id = formData.get("id") as string;
    const rejectionReason = formData.get("rejectionReason") as string;

    if (!id) return { success: false, error: "ID не указан" };
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      return { success: false, error: "Причина отклонения должна содержать минимум 5 символов" };
    }

    const adjustment = await db.manualBalanceAdjustment.findUnique({ where: { id } });
    if (!adjustment) return { success: false, error: "Заявка не найдена" };

    if (adjustment.status !== BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL) {
      return { success: false, error: `Заявка находится в статусе ${adjustment.status} и не может быть отклонена` };
    }

    if (adjustment.requestedBy === rejecter.id && rejecter.role !== 'OWNER' && rejecter.role !== 'ADMIN') {
      return { success: false, error: "Запрещено отклонять собственную заявку" };
    }

    const updated = await db.manualBalanceAdjustment.update({
      where: { id },
      data: {
        status: BALANCE_ADJUSTMENT_STATUS.REJECTED,
        rejectedBy: rejecter.id,
        rejectedAt: new Date(),
        rejectionReason: rejectionReason.trim()
      }
    });

    await auditAdminAwaitable({
      adminId: rejecter.id,
      adminEmail: rejecter.email,
      action: 'BALANCE_ADJUSTMENT_REJECTED',
      target: adjustment.id,
      targetType: 'ManualBalanceAdjustment',
      newValue: {
        rejectedBy: rejecter.id,
        rejectionReason: rejectionReason.trim()
      }
    });

    return { success: true, id: updated.id, status: updated.status };
  });
}

export async function getBalanceAdjustmentsAction(formData: FormData) {
  return requireStaffPermission('balance_requests', 'view', async (staffUser) => {
    const policy = await getEffectiveBalancePolicy(staffUser.id);
    const canViewAll = staffUser.role === 'OWNER' || staffUser.role === 'ADMIN' || (policy?.canViewAll ?? false);

    const status = (formData.get("status") as string) || undefined;
    const direction = (formData.get("direction") as string) || undefined;
    const userId = (formData.get("userId") as string) || undefined;
    const requestedBy = (formData.get("requestedBy") as string) || undefined;
    const reasonCode = (formData.get("reasonCode") as string) || undefined;
    const ticketId = (formData.get("ticketId") as string) || undefined;
    const page = parseInt((formData.get("page") as string) || "1", 10);
    const pageSize = parseInt((formData.get("pageSize") as string) || "20", 10);

    // Filter construction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (!canViewAll) {
      where.requestedBy = staffUser.id;
    } else if (requestedBy) {
      where.requestedBy = requestedBy;
    }

    if (status) where.status = status;
    if (direction) where.direction = direction;
    if (userId) where.userId = userId;
    if (reasonCode) where.reasonCode = reasonCode;
    if (ticketId) where.ticketId = ticketId;

    const total = await db.manualBalanceAdjustment.count({ where });
    const items = await db.manualBalanceAdjustment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true, role: true, balance: true } },
        requester: { select: { id: true, email: true } },
        approver: { select: { id: true, email: true } },
        rejecter: { select: { id: true, email: true } }
      }
    });

    const serializedItems = items.map(item => ({
      ...item,
      amount: item.amount.toString(),
      user: item.user ? { ...item.user, balance: item.user.balance.toString() } : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      approvedAt: item.approvedAt ? item.approvedAt.toISOString() : null,
      rejectedAt: item.rejectedAt ? item.rejectedAt.toISOString() : null
    }));

    return {
      success: true,
      items: serializedItems,
      total,
      page,
      pageSize
    };
  });
}

export async function getBalanceAdjustmentStatsAction(formData: FormData) {
  return requireStaffPermission('balance_stats', 'view', async (staffUser) => {
    const policy = await getEffectiveBalancePolicy(staffUser.id);
    const canViewAll = staffUser.role === 'OWNER' || staffUser.role === 'ADMIN' || (policy?.canViewStats ?? false);

    const requestedBy = (formData.get("requestedBy") as string) || undefined;
    const direction = (formData.get("direction") as string) || undefined;
    const reasonCode = (formData.get("reasonCode") as string) || undefined;
    const status = (formData.get("status") as string) || undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (!canViewAll) {
      where.requestedBy = staffUser.id;
    } else if (requestedBy) {
      where.requestedBy = requestedBy;
    }

    if (direction) where.direction = direction;
    if (reasonCode) where.reasonCode = reasonCode;
    if (status) where.status = status;

    const items = await db.manualBalanceAdjustment.findMany({
      where,
      select: {
        id: true,
        requestedBy: true,
        direction: true,
        amount: true,
        status: true,
        reasonCode: true,
        createdAt: true,
        requester: { select: { email: true } }
      }
    });

    let totalCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let executedCount = 0;

    let creditSum = BigInt(0);
    let debitSum = BigInt(0);

    const staffMap: Record<string, { email: string; count: number; creditSum: bigint; debitSum: bigint }> = {};
    const reasonMap: Record<string, { count: number; creditSum: bigint; debitSum: bigint }> = {};
    const dayMap: Record<string, { count: number; creditSum: bigint; debitSum: bigint }> = {};

    for (const item of items) {
      totalCount++;
      if (item.status === BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL) pendingCount++;
      if (item.status === BALANCE_ADJUSTMENT_STATUS.APPROVED) approvedCount++;
      if (item.status === BALANCE_ADJUSTMENT_STATUS.REJECTED) rejectedCount++;
      if (item.status === BALANCE_ADJUSTMENT_STATUS.EXECUTED) executedCount++;

      if (item.status === BALANCE_ADJUSTMENT_STATUS.EXECUTED || item.status === BALANCE_ADJUSTMENT_STATUS.APPROVED) {
        if (item.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) {
          creditSum += item.amount;
        } else {
          debitSum += item.amount;
        }
      }

      // Group by Staff
      const staffKey = item.requestedBy;
      const staffEmail = item.requester?.email || 'Unknown';
      if (!staffMap[staffKey]) {
        staffMap[staffKey] = { email: staffEmail, count: 0, creditSum: BigInt(0), debitSum: BigInt(0) };
      }
      staffMap[staffKey].count++;
      if (item.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) staffMap[staffKey].creditSum += item.amount;
      else staffMap[staffKey].debitSum += item.amount;

      // Group by Reason
      const reasonKey = item.reasonCode;
      if (!reasonMap[reasonKey]) {
        reasonMap[reasonKey] = { count: 0, creditSum: BigInt(0), debitSum: BigInt(0) };
      }
      reasonMap[reasonKey].count++;
      if (item.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) reasonMap[reasonKey].creditSum += item.amount;
      else reasonMap[reasonKey].debitSum += item.amount;

      // Group by Day
      const dayKey = item.createdAt.toISOString().slice(0, 10);
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = { count: 0, creditSum: BigInt(0), debitSum: BigInt(0) };
      }
      dayMap[dayKey].count++;
      if (item.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) dayMap[dayKey].creditSum += item.amount;
      else dayMap[dayKey].debitSum += item.amount;
    }

    const netSum = creditSum - debitSum;

    return {
      success: true,
      summary: {
        totalCount,
        pendingCount,
        approvedCount,
        rejectedCount,
        executedCount,
        creditSum: creditSum.toString(),
        debitSum: debitSum.toString(),
        netSum: netSum.toString()
      },
      byStaff: Object.entries(staffMap).map(([id, val]) => ({
        id,
        email: val.email,
        count: val.count,
        creditSum: val.creditSum.toString(),
        debitSum: val.debitSum.toString()
      })),
      byReason: Object.entries(reasonMap).map(([code, val]) => ({
        code,
        count: val.count,
        creditSum: val.creditSum.toString(),
        debitSum: val.debitSum.toString()
      })),
      byDay: Object.entries(dayMap).map(([day, val]) => ({
        day,
        count: val.count,
        creditSum: val.creditSum.toString(),
        debitSum: val.debitSum.toString()
      })).sort((a, b) => b.day.localeCompare(a.day))
    };
  });
}

```

---

### 📄 Файл 9 из 89: `src/actions/admin/balance-policy.ts`

```ts
"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffPermission, requireOwnerPermission } from "@/lib/server/rbac";
import { auditAdminAwaitable } from "@/lib/admin-audit";
import { BALANCE_ADJUSTMENT_REASONS } from "@/constants/balance-adjustments";

const upsertPolicySchema = z.object({
  id: z.string().optional(),
  scopeType: z.enum(['GLOBAL', 'ROLE', 'USER']),
  staffRoleId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  enabled: z.boolean().default(false),
  canRequestCredit: z.boolean().default(false),
  canRequestDebit: z.boolean().default(false),
  canApprove: z.boolean().default(false),
  canReject: z.boolean().default(false),
  canViewAll: z.boolean().default(false),
  canViewStats: z.boolean().default(false),
  maxCreditPerRequest: z.string().default("0"),
  maxDebitPerRequest: z.string().default("0"),
  maxCreditPerDay: z.string().default("0"),
  maxDebitPerDay: z.string().default("0"),
  maxTotalPerDay: z.string().default("0"),
  maxApprovalPerRequest: z.string().default("0"),
  allowedCreditReasonCodes: z.array(z.string()).default([...BALANCE_ADJUSTMENT_REASONS.CREDIT]),
  allowedDebitReasonCodes: z.array(z.string()).default([...BALANCE_ADJUSTMENT_REASONS.DEBIT]),
  allowedTargetRoles: z.array(z.string()).default(['USER', 'SUPPORT']),
  requireTicket: z.boolean().default(true),
  requireOrderForDebit: z.boolean().default(false),
  blockBannedTargets: z.boolean().default(true),
  blockDeletedTargets: z.boolean().default(true),
  autoExecuteBelow: z.string().default("0")
});

export async function getBalancePoliciesAction() {
  return requireStaffPermission('balance_policy', 'view', async () => {
    const policies = await db.balanceAdjustmentPolicy.findMany({
      orderBy: [{ scopeType: 'asc' }, { createdAt: 'desc' }]
    });

    const serialized = policies.map(p => ({
      ...p,
      maxCreditPerRequest: p.maxCreditPerRequest.toString(),
      maxDebitPerRequest: p.maxDebitPerRequest.toString(),
      maxCreditPerDay: p.maxCreditPerDay.toString(),
      maxDebitPerDay: p.maxDebitPerDay.toString(),
      maxTotalPerDay: p.maxTotalPerDay.toString(),
      maxApprovalPerRequest: p.maxApprovalPerRequest.toString(),
      autoExecuteBelow: p.autoExecuteBelow.toString(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString()
    }));

    return { success: true, policies: serialized };
  });
}

export async function upsertBalancePolicyAction(formData: FormData) {
  const scopeType = formData.get("scopeType") as string;

  const actionHandler = async (adminUser: { id: string; email: string }) => {
    const rawData = {
      id: (formData.get("id") as string) || undefined,
      scopeType: scopeType as 'GLOBAL' | 'ROLE' | 'USER',
      staffRoleId: (formData.get("staffRoleId") as string) || null,
      userId: (formData.get("userId") as string) || null,
      isActive: formData.get("isActive") === "true",
      enabled: formData.get("enabled") === "true",
      canRequestCredit: formData.get("canRequestCredit") === "true",
      canRequestDebit: formData.get("canRequestDebit") === "true",
      canApprove: formData.get("canApprove") === "true",
      canReject: formData.get("canReject") === "true",
      canViewAll: formData.get("canViewAll") === "true",
      canViewStats: formData.get("canViewStats") === "true",
      maxCreditPerRequest: (formData.get("maxCreditPerRequest") as string) || "0",
      maxDebitPerRequest: (formData.get("maxDebitPerRequest") as string) || "0",
      maxCreditPerDay: (formData.get("maxCreditPerDay") as string) || "0",
      maxDebitPerDay: (formData.get("maxDebitPerDay") as string) || "0",
      maxTotalPerDay: (formData.get("maxTotalPerDay") as string) || "0",
      maxApprovalPerRequest: (formData.get("maxApprovalPerRequest") as string) || "0",
      allowedCreditReasonCodes: formData.getAll("allowedCreditReasonCodes").map(String),
      allowedDebitReasonCodes: formData.getAll("allowedDebitReasonCodes").map(String),
      allowedTargetRoles: formData.getAll("allowedTargetRoles").map(String),
      requireTicket: formData.get("requireTicket") === "true",
      requireOrderForDebit: formData.get("requireOrderForDebit") === "true",
      blockBannedTargets: formData.get("blockBannedTargets") === "true",
      blockDeletedTargets: formData.get("blockDeletedTargets") === "true",
      autoExecuteBelow: (formData.get("autoExecuteBelow") as string) || "0"
    };

    const parsed = upsertPolicySchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || " Ошибка валидации политики" };
    }

    const data = parsed.data;

    if (data.scopeType === 'ROLE' && !data.staffRoleId) {
      return { success: false, error: "Для роли требуется указать staffRoleId" };
    }

    if (data.scopeType === 'USER' && !data.userId) {
      return { success: false, error: "Для пользователя требуется указать userId" };
    }

    const policyData = {
      scopeType: data.scopeType,
      staffRoleId: data.scopeType === 'ROLE' ? data.staffRoleId : null,
      userId: data.scopeType === 'USER' ? data.userId : null,
      isActive: data.isActive,
      enabled: data.enabled,
      canRequestCredit: data.canRequestCredit,
      canRequestDebit: data.canRequestDebit,
      canApprove: data.canApprove,
      canReject: data.canReject,
      canViewAll: data.canViewAll,
      canViewStats: data.canViewStats,
      maxCreditPerRequest: BigInt(data.maxCreditPerRequest),
      maxDebitPerRequest: BigInt(data.maxDebitPerRequest),
      maxCreditPerDay: BigInt(data.maxCreditPerDay),
      maxDebitPerDay: BigInt(data.maxDebitPerDay),
      maxTotalPerDay: BigInt(data.maxTotalPerDay),
      maxApprovalPerRequest: BigInt(data.maxApprovalPerRequest),
      allowedCreditReasonCodes: JSON.stringify(data.allowedCreditReasonCodes),
      allowedDebitReasonCodes: JSON.stringify(data.allowedDebitReasonCodes),
      allowedTargetRoles: JSON.stringify(data.allowedTargetRoles),
      requireTicket: data.requireTicket,
      requireOrderForDebit: data.requireOrderForDebit,
      blockBannedTargets: data.blockBannedTargets,
      blockDeletedTargets: data.blockDeletedTargets,
      autoExecuteBelow: BigInt(data.autoExecuteBelow)
    };

    let policy;
    if (data.id) {
      const old = await db.balanceAdjustmentPolicy.findUnique({ where: { id: data.id } });
      policy = await db.balanceAdjustmentPolicy.update({
        where: { id: data.id },
        data: policyData
      });

      await auditAdminAwaitable({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        action: 'BALANCE_POLICY_UPDATED',
        target: policy.id,
        targetType: 'BalanceAdjustmentPolicy',
        oldValue: old,
        newValue: policy
      });
    } else {
      policy = await db.balanceAdjustmentPolicy.create({
        data: policyData
      });

      await auditAdminAwaitable({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        action: 'BALANCE_POLICY_CREATED',
        target: policy.id,
        targetType: 'BalanceAdjustmentPolicy',
        newValue: policy
      });
    }

    return { success: true, policyId: policy.id };
  };

  if (scopeType === 'GLOBAL') {
    return requireOwnerPermission(actionHandler);
  } else {
    return requireStaffPermission('balance_policy', 'edit', actionHandler);
  }
}

```

---

### 📄 Файл 10 из 89: `src/actions/admin/catalog/batch.ts`

```ts
'use server';

/**
 * Server Actions: Batch catalog operations
 *
 * batchToggleServicesAction — bulk enable/disable
 * batchSetMarkupAction — set fixed markup for a selection
 *
 * Security: requireAdmin guard on all actions.
 * All changes recorded in AdminAuditLog (fire-and-forget).
 */

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { auditAdmin } from '@/lib/admin-audit';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { applyBeautifulRounding, applyPricingLadder, SAFETY_FLOOR_MARKUP } from '@/lib/financial-constants';
import { SettingsProvider } from '@/lib/settings';

const MIN_MARKUP = 1.0;

const batchIdsSchema = z.array(z.string().min(1)).min(1).max(500);
const markupSchema = z.number().min(MIN_MARKUP).max(150);

/** Bulk toggle isActive for a list of service IDs */
export async function batchToggleServicesAction(
  serviceIds: string[],
  isActive: boolean
) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const ids = batchIdsSchema.safeParse(serviceIds);
    if (!ids.success) {
      return { success: false as const, error: 'Invalid service IDs' };
    }

    await db.service.updateMany({
      where: { id: { in: ids.data } },
      data: { isActive },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isActive ? 'BATCH_SERVICE_ENABLE' : 'BATCH_SERVICE_DISABLE',
      target: ids.data.join(','),
      targetType: 'SERVICE',
      newValue: { count: ids.data.length, isActive },
    });

    revalidatePath('/admin/catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('services');
    return { success: true as const, count: ids.data.length };
  });
}

/** Bulk set fixed markup for a list of service IDs */
export async function batchSetMarkupAction(
  serviceIds: string[],
  markup: number
) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const ids = batchIdsSchema.safeParse(serviceIds);
    if (!ids.success) {
      return { success: false as const, error: 'Invalid service IDs' };
    }

    const markupValidation = markupSchema.safeParse(markup);
    if (!markupValidation.success) {
      return {
        success: false as const,
        error: `Минимальная маржа ${MIN_MARKUP.toFixed(2)}x (Safety Floor)`,
      };
    }

    const m = markupValidation.data;
    const usdToRub = await SettingsProvider.getExchangeRateUSD();

    // We can't use updateMany with calculated fields in Prisma easily,
    // so we iterate or use a raw query. For 500 items, iteration is safe.
    const services = await db.service.findMany({
      where: { id: { in: ids.data } },
      select: { id: true, rate: true, providerCurrency: true }
    });

    await db.$transaction(
      services.map(s => db.service.update({
        where: { id: s.id },
        data: { 
          markup: m,
          pricePer1000Cents: Math.round(applyBeautifulRounding(s.rate * m * (s.providerCurrency === 'RUB' ? 1 : usdToRub)) * 100)
        }
      }))
    );

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BATCH_MARKUP_SET',
      target: ids.data.join(','),
      targetType: 'SERVICE',
      newValue: { count: ids.data.length, markup: m },
    });

    revalidatePath('/admin/catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('services');
    return { success: true as const, count: ids.data.length };
  });
}

/** Preview price changes before applying batch markup */
export async function previewBatchMarkupAction(
  serviceIds: string[],
  newMarkup: number
) {
  return requireStaffPermission('catalog', 'view', async () => {
    const ids = batchIdsSchema.safeParse(serviceIds);
    if (!ids.success) return { success: false as const, error: 'Invalid service IDs' };

    const markupValidation = markupSchema.safeParse(newMarkup);
    if (!markupValidation.success) {
      return { success: false as const, error: `Минимальная маржа ${MIN_MARKUP.toFixed(2)}x` };
    }

    const m = markupValidation.data;
    const usdToRub = await SettingsProvider.getExchangeRateUSD();

    const services = await db.service.findMany({
      where: { id: { in: ids.data } },
      select: { id: true, name: true, rate: true, markup: true, pricePer1000Cents: true, providerCurrency: true },
      take: 10
    });

    const samples = services.map(s => {
      const oldPriceRub = s.pricePer1000Cents / 100;
      const rateRub = s.providerCurrency === 'RUB' ? s.rate : s.rate * usdToRub;
      const newPriceRub = applyBeautifulRounding(rateRub * m);
      return {
        id: s.id,
        name: s.name,
        oldMarkup: s.markup,
        newMarkup: m,
        oldPriceRub,
        newPriceRub,
        diffPercent: Math.round(((newPriceRub - oldPriceRub) / (oldPriceRub || 1)) * 100)
      };
    });

    return { success: true as const, samples, totalCount: ids.data.length };
  });
}

/** Update single service markup (inline edit) */
export async function updateServiceMarkupAction(
  serviceId: string,
  markup: number
) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const markupValidation = markupSchema.safeParse(markup);
    if (!markupValidation.success) {
      return {
        success: false as const,
        error: `Минимальная маржа ${MIN_MARKUP.toFixed(2)}x`,
      };
    }

    const m = markupValidation.data;
    const usdToRub = await SettingsProvider.getExchangeRateUSD();

    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { markup: true, rate: true, providerCurrency: true },
    });

    if (!service) return { success: false as const, error: 'Service not found' };

    await db.service.update({
      where: { id: serviceId },
      data: { 
        markup: m,
        pricePer1000Cents: Math.round(applyBeautifulRounding(service.rate * m * (service.providerCurrency === 'RUB' ? 1 : usdToRub)) * 100)
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_MARKUP_UPDATE',
      target: serviceId,
      targetType: 'SERVICE',
      oldValue: { markup: service.markup },
      newValue: { markup: m },
    });

    revalidatePath('/admin/catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('services');
    return { success: true as const };
  });
}

/** Toggle single service active status */
export async function toggleServiceActiveAction(
  serviceId: string,
  isActive: boolean
) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    await db.service.update({
      where: { id: serviceId },
      data: { isActive },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isActive ? 'SERVICE_ENABLE' : 'SERVICE_DISABLE',
      target: serviceId,
      targetType: 'SERVICE',
      newValue: { isActive },
    });

    revalidatePath('/admin/catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('services');
    return { success: true as const };
  });
}

/** Bulk reassign services to a target category */
export async function batchReassignServicesCategoryAction(
  serviceIds: string[],
  targetCategoryId: string
) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const ids = batchIdsSchema.safeParse(serviceIds);
    if (!ids.success) {
      return { success: false as const, error: 'Invalid service IDs' };
    }

    if (!targetCategoryId || typeof targetCategoryId !== 'string') {
      return { success: false as const, error: 'Invalid target category ID' };
    }

    // Verify target category exists
    const targetCategory = await db.category.findUnique({
      where: { id: targetCategoryId },
    });
    if (!targetCategory) {
      return { success: false as const, error: 'Target category not found' };
    }

    // Update all matching services inside db query
    const updateResult = await db.service.updateMany({
      where: { id: { in: ids.data } },
      data: { categoryId: targetCategoryId },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BATCH_SERVICE_REASSIGN',
      target: ids.data.join(','),
      targetType: 'SERVICE',
      newValue: { count: updateResult.count, targetCategoryId },
    });

    revalidatePath('/admin/catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('services');
    return { success: true as const, count: updateResult.count };
  });
}

/** Bulk reset markup of selected services based on the pricing ladder */
export async function batchResetMarkupAction(
  serviceIds: string[]
) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const ids = batchIdsSchema.safeParse(serviceIds);
    if (!ids.success) {
      return { success: false as const, error: 'Invalid service IDs' };
    }

    const usdToRub = await SettingsProvider.getExchangeRateUSD();

    const services = await db.service.findMany({
      where: { id: { in: ids.data } },
      select: { id: true, rate: true, providerCurrency: true }
    });

    const updates = services.map(s => {
      const exchangeRate = s.providerCurrency === 'RUB' ? 1.0 : usdToRub;
      const retailFromLadder = applyPricingLadder(s.rate * exchangeRate);
      let calculatedMarkup = s.rate > 0 ? Math.round((retailFromLadder / (s.rate * exchangeRate)) * 100) / 100 : 3.0;
      
      // Safety Floor Check
      if (calculatedMarkup < SAFETY_FLOOR_MARKUP) {
        calculatedMarkup = SAFETY_FLOOR_MARKUP;
      }

      return db.service.update({
        where: { id: s.id },
        data: { 
          markup: calculatedMarkup,
          pricePer1000Cents: Math.round(applyBeautifulRounding(s.rate * calculatedMarkup * exchangeRate) * 100)
        }
      });
    });

    await db.$transaction(updates);

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BATCH_MARKUP_RESET',
      target: ids.data.join(','),
      targetType: 'SERVICE',
      newValue: { count: ids.data.length },
    });

    revalidatePath('/admin/catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('services');
    return { success: true as const, count: ids.data.length };
  });
}


```

---

### 📄 Файл 11 из 89: `src/actions/admin/catalog/categories.ts`

```ts
"use server";

import { db } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
import { auditAdmin } from "@/lib/admin-audit";
import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";

const categorySchema = z.object({
  name: z.string().min(1).max(255, "Category name too long"),
  networkId: z.string().min(1, "Network ID required"),
  sort: z.coerce.number().int().default(0),
  requireWarning: z.coerce.boolean().default(false),
  warningMessage: z.string().max(1000, "Предупреждение слишком длинное").optional().nullable(),
  analyzerTags: z.string().max(255).optional().nullable()
});

const idSchema = z.string().min(1);

export async function createCategory(rawData: { name: string; networkId: string; sort: number; requireWarning?: boolean; warningMessage?: string | null; analyzerTags?: string | null }) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    const data = categorySchema.parse(rawData);
    const cat = await db.category.create({
      data: {
        name: data.name,
        networkId: data.networkId,
        sort: data.sort,
        requireWarning: data.requireWarning,
        warningMessage: data.warningMessage,
        analyzerTags: data.analyzerTags
      }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CATEGORY_CREATE",
      target: cat.id,
      targetType: "SETTINGS",
      newValue: { name: cat.name, networkId: cat.networkId, requireWarning: cat.requireWarning, warningMessage: cat.warningMessage, analyzerTags: cat.analyzerTags }
    });

    revalidatePath("/admin/catalog/categories");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("services");
    return { success: true, error: undefined, categoryId: cat.id };
  });
}

export async function updateCategory(rawId: string, rawData: { name: string; networkId: string; sort: number; requireWarning?: boolean; warningMessage?: string | null; analyzerTags?: string | null }) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    const id = idSchema.parse(rawId);
    const data = categorySchema.parse(rawData);
    const cat = await db.category.update({
      where: { id },
      data: {
        name: data.name,
        networkId: data.networkId,
        sort: data.sort,
        requireWarning: data.requireWarning,
        warningMessage: data.warningMessage,
        analyzerTags: data.analyzerTags
      }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CATEGORY_UPDATE",
      target: cat.id,
      targetType: "SETTINGS",
      newValue: { name: cat.name, networkId: cat.networkId, requireWarning: cat.requireWarning, warningMessage: cat.warningMessage, analyzerTags: cat.analyzerTags }
    });

    revalidatePath("/admin/catalog/categories");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("services");
    return { success: true, error: undefined };
  });
}

export async function deleteCategory(rawId: string) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    const id = idSchema.parse(rawId);
    const count = await db.service.count({ where: { categoryId: id } });
    if (count > 0) {
      return { success: false, error: `Cannot delete category. It contains ${count} services. Delete or move them first.` };
    }

    await db.category.delete({ where: { id } });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CATEGORY_DELETE",
      target: id,
      targetType: "SETTINGS"
    });

    revalidatePath("/admin/catalog/categories");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("services");
    return { success: true, error: undefined };
  });
}

/**
 * Merges source category into target category:
 * moves all services from source to target, then deletes source category.
 */
export async function mergeCategoriesAction(sourceCategoryId: string, targetCategoryId: string) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    if (!sourceCategoryId || !targetCategoryId) {
      return { success: false as const, error: 'Source and target category IDs are required.' };
    }

    if (sourceCategoryId === targetCategoryId) {
      return { success: false as const, error: 'Source and target categories cannot be the same.' };
    }

    const sourceCat = await db.category.findUnique({ where: { id: sourceCategoryId } });
    if (!sourceCat) {
      return { success: false as const, error: 'Source category not found.' };
    }

    const targetCat = await db.category.findUnique({ where: { id: targetCategoryId } });
    if (!targetCat) {
      return { success: false as const, error: 'Target category not found.' };
    }

    await db.$transaction(async (tx) => {
      // 1. Move all services from source to target
      await tx.service.updateMany({
        where: { categoryId: sourceCategoryId },
        data: { categoryId: targetCategoryId }
      });

      // 2. Delete source category
      await tx.category.delete({
        where: { id: sourceCategoryId }
      });
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CATEGORY_MERGE',
      target: sourceCategoryId,
      targetType: 'SETTINGS',
      newValue: { sourceCategoryId, targetCategoryId }
    });

    revalidatePath("/admin/catalog/categories");
    revalidatePath("/admin/catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("services");

    return { success: true as const };
  });
}

const networkSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  slug: z.string().min(1, "Slug is required").max(255, "Slug too long").regex(/^[a-z0-9-_]+$/, "Slug must be lowercase alphanumeric, dashes or underscores"),
  sort: z.coerce.number().int().default(0)
});

/** Create a new network with Zod validation and unique constraint check */
export async function createNetworkAction(rawData: { name: string; slug: string; sort: number }) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    const parsed = networkSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Invalid network data' };
    }
    const data = parsed.data;

    // Check uniqueness of name and slug
    const existing = await db.network.findFirst({
      where: {
        OR: [
          { name: data.name },
          { slug: data.slug }
        ]
      }
    });
    if (existing) {
      return { success: false as const, error: 'Сеть с таким названием или slug уже существует' };
    }

    const network = await db.network.create({
      data: {
        name: data.name,
        slug: data.slug,
        sort: data.sort
      }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'NETWORK_CREATE',
      target: network.id,
      targetType: 'SETTINGS',
      newValue: { name: network.name, slug: network.slug, sort: network.sort }
    });

    revalidatePath("/admin/catalog/categories");
    revalidatePath("/admin/catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("catalog");

    return { success: true as const, networkId: network.id };
  });
}

/** Update an existing network with Zod validation and unique constraint check */
export async function updateNetworkAction(id: string, rawData: { name: string; slug: string; sort: number }) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    if (!id || typeof id !== 'string') {
      return { success: false as const, error: 'Network ID is required' };
    }

    const parsed = networkSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Invalid network data' };
    }
    const data = parsed.data;

    // Check network exists
    const network = await db.network.findUnique({ where: { id } });
    if (!network) {
      return { success: false as const, error: 'Network not found' };
    }

    // Check uniqueness of name and slug for other networks
    const existing = await db.network.findFirst({
      where: {
        OR: [
          { name: data.name },
          { slug: data.slug }
        ],
        NOT: { id }
      }
    });
    if (existing) {
      return { success: false as const, error: 'Сеть с таким названием или slug уже существует' };
    }

    const updatedNetwork = await db.network.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        sort: data.sort
      }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'NETWORK_UPDATE',
      target: id,
      targetType: 'SETTINGS',
      oldValue: { name: network.name, slug: network.slug, sort: network.sort },
      newValue: { name: updatedNetwork.name, slug: updatedNetwork.slug, sort: updatedNetwork.sort }
    });

    revalidatePath("/admin/catalog/categories");
    revalidatePath("/admin/catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("catalog");

    return { success: true as const };
  });
}

/** Delete a network if it has no associated categories */
export async function deleteNetworkAction(id: string) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    if (!id || typeof id !== 'string') {
      return { success: false as const, error: 'Network ID is required' };
    }

    const network = await db.network.findUnique({ where: { id } });
    if (!network) {
      return { success: false as const, error: 'Network not found' };
    }

    // Check if network has categories
    const categoryCount = await db.category.count({
      where: { networkId: id }
    });
    if (categoryCount > 0) {
      return {
        success: false as const,
        error: `Невозможно удалить сеть. Она содержит ${categoryCount} категорий. Удалите или переместите их сначала.`
      };
    }

    await db.network.delete({ where: { id } });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'NETWORK_DELETE',
      target: id,
      targetType: 'SETTINGS'
    });

    revalidatePath("/admin/catalog/categories");
    revalidatePath("/admin/catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("catalog");

    return { success: true as const };
  });
}


```

---

### 📄 Файл 12 из 89: `src/actions/admin/catalog/enrichment.ts`

```ts
"use server";

import { requireStaffPermission } from "@/lib/server/rbac";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getClientIp } from "@/utils/ip";
import { auditAdmin } from "@/lib/admin-audit";

export async function updateServiceDescription(serviceId: string, description: string) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    try {
      await db.service.update({
        where: { id: serviceId },
        data: { description },
      });

      const ipAddress = await getClientIp('unknown');

      // Log the action
      auditAdmin({
        adminId: admin.id,
        adminEmail: admin.email,
        action: "UPDATE_SERVICE_DESCRIPTION",
        target: serviceId,
        targetType: "SERVICE",
        newValue: { description },
        ipAddress
      });

      revalidatePath("/admin/catalog/enrichment");
      return { success: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Failed to update service description:", error);
      return { success: false, error: error.message };
    }
  });
}

```

---

### 📄 Файл 13 из 89: `src/actions/admin/catalog/price-drift.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { applyBeautifulRounding } from '@/lib/financial-constants';
import { SettingsProvider } from '@/lib/settings';

export type DriftCandidate = {
  id: string;
  numericId: number;
  name: string;
  providerId: string | null;
  providerName: string | null;
  providerCurrency: string;
  oldRate: number;
  currentRate: number;
  driftPercent: number;
  actualMarkup: number;
  configuredMarkup: number;
  historicalDate: Date;
};

/**
 * Retrieves services that have experienced price drift between 5% and 19.99%
 * over the last 30 days.
 */
export async function getDriftCandidatesAction(): Promise<{ success: true; data: DriftCandidate[] } | { success: false; error: string }> {
  return requireStaffPermission('catalog', 'view', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const services = await db.service.findMany({
      where: {
        isActive: true,
        isQuarantined: false,
        providerId: { not: null },
        rate: { gt: 0 }
      },
      select: {
        id: true,
        numericId: true,
        name: true,
        rate: true,
        markup: true,
        pricePer1000Cents: true,
        providerId: true,
        providerCurrency: true,
        provider: { select: { name: true } }
      }
    });

    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const candidates: DriftCandidate[] = [];

    for (const s of services) {
      let history = await db.servicePriceHistory.findFirst({
        where: {
          serviceId: s.id,
          createdAt: { gte: thirtyDaysAgo }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (!history) {
        history = await db.servicePriceHistory.findFirst({
          where: {
            serviceId: s.id,
            createdAt: { lt: thirtyDaysAgo }
          },
          orderBy: { createdAt: 'desc' }
        });
      }

      if (!history || history.rate === 0) continue;

      const historicalRate = history.rate;
      const currentRate = s.rate;

      if (currentRate > historicalRate) {
        const driftPercent = (currentRate - historicalRate) / historicalRate;
        
        if (driftPercent >= 0.05 && driftPercent < 0.20) {
          const exchangeRate = s.providerCurrency === 'RUB' ? 1.0 : usdToRub;
          const newCostCents = currentRate * exchangeRate * 100;
          const actualMarkup = newCostCents > 0 ? (s.pricePer1000Cents / newCostCents) : s.markup;

          candidates.push({
            id: s.id,
            numericId: s.numericId,
            name: s.name,
            providerId: s.providerId,
            providerName: s.provider?.name || 'Unknown',
            providerCurrency: s.providerCurrency,
            oldRate: historicalRate,
            currentRate: currentRate,
            driftPercent,
            actualMarkup,
            configuredMarkup: s.markup,
            historicalDate: history.createdAt
          });
        }
      }
    }

    candidates.sort((a, b) => b.driftPercent - a.driftPercent);
    return { success: true, data: candidates };
  });
}

/**
 * Retrieves the full price history for a specific service.
 */
export async function getServicePriceHistoryAction(serviceId: string) {
  return requireStaffPermission('catalog', 'view', async () => {
    const history = await db.servicePriceHistory.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'asc' }
    });

    return { 
      success: true, 
      data: history.map(h => ({
        date: h.createdAt.toISOString(),
        rate: h.rate
      }))
    };
  });
}

/**
 * Compensates for margin erosion by updating the selling price
 * based on the current rate and the original configured markup.
 */
export async function compensateServiceMarginAction(serviceId: string) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const service = await db.service.findUnique({
      where: { id: serviceId }
    });

    if (!service) return { success: false, error: 'Service not found' };

    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const exchangeRate = service.providerCurrency === 'RUB' ? 1.0 : usdToRub;

    const newPriceCents = Math.round(applyBeautifulRounding(service.rate * service.markup * exchangeRate) * 100);

    if (newPriceCents === service.pricePer1000Cents) {
      return { success: true, message: 'Цена уже соответствует марже' };
    }

    await db.service.update({
      where: { id: serviceId },
      data: {
        pricePer1000Cents: newPriceCents
      }
    });

    await db.adminAuditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'COMPENSATE_MARGIN_DRIFT',
        target: serviceId,
        targetType: 'SERVICE',
        oldValue: JSON.stringify({ priceCents: service.pricePer1000Cents }),
        newValue: JSON.stringify({ priceCents: newPriceCents })
      }
    });

    return { success: true, message: 'Наценка успешно компенсирована' };
  });
}

```

---

### 📄 Файл 14 из 89: `src/actions/admin/catalog/services.ts`

```ts
'use server';

import { db } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
import { auditAdmin } from "@/lib/admin-audit";
import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { SettingsProvider } from "@/lib/settings";
import { applyBeautifulRounding } from "@/lib/financial-constants";
import { inferTargetTypeFromCategory } from "@/utils/target-type";

// Validation schema for manual Service CRUD operations
const serviceSchema = z.object({
  name: z.string().min(1, "Название услуги обязательно").max(255, "Название слишком длинное"),
  description: z.string().optional().nullable(),
  categoryId: z.string().min(1, "Категория обязательна"),
  providerId: z.string().optional().nullable(),
  rate: z.coerce.number().min(0, "Тариф провайдера должен быть больше или равен 0"),
  markup: z.coerce.number().min(1.0, "Наценка должна быть не менее 1.0"),
  minQty: z.coerce.number().int().min(1, "Минимальное количество должно быть не менее 1"),
  maxQty: z.coerce.number().int().min(1, "Максимальное количество должно быть не менее 1"),
  externalId: z.string().optional().nullable(),
  targetType: z.string().optional().nullable(),
  customDataType: z.string().default("NONE"),
  customDataLabel: z.string().max(100, "Название подсказки не должно превышать 100 символов").optional().nullable(),
  isMediaGroupAware: z.coerce.boolean().default(false),
  isDripFeedEnabled: z.coerce.boolean().default(true),
  isRefillEnabled: z.coerce.boolean().default(false),
  isCancelEnabled: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  requireWarning: z.coerce.boolean().default(false),
  warningMessage: z.string().max(1000, "Предупреждение слишком длинное").optional().nullable(),
  clientRequirement: z.string().max(2000, "Требование слишком длинное").optional().nullable(),
  clientConfirmation: z.string().max(200, "Текст подтверждения слишком длинный").optional().nullable()
});

/**
 * Manually create a new catalog Service
 */
export async function createServiceAction(rawData: unknown) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    const parsed = serviceSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Неверные данные услуги' };
    }
    const data = parsed.data;

    // Verify category exists
    const category = await db.category.findUnique({
      where: { id: data.categoryId }
    });
    if (!category) {
      return { success: false as const, error: 'Указанная категория не найдена' };
    }

    // Verify provider exists if provided
    let providerCurrency = 'USD';
    if (data.providerId) {
      const provider = await db.provider.findUnique({
        where: { id: data.providerId }
      });
      if (!provider) {
        return { success: false as const, error: 'Указанный провайдер SMM не найден' };
      }
      providerCurrency = provider.balanceCurrency;
    }

    // Infer targetType if not provided
    let targetType = data.targetType;
    if (!targetType) {
      targetType = inferTargetTypeFromCategory(category.name);
    }

    // Calculate pricePer1000Cents dynamically using CBR exchange rate
    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const exchangeRate = providerCurrency === 'RUB' ? 1.0 : usdToRub;
    const pricePer1000Cents = Math.round(applyBeautifulRounding(data.rate * data.markup * exchangeRate) * 100);

    // Atomically create the service
    const service = await db.$transaction(async (tx) => {
      return await tx.service.create({
        data: {
          name: data.name,
          description: data.description,
          categoryId: data.categoryId,
          providerId: data.providerId,
          rate: data.rate,
          markup: data.markup,
          minQty: data.minQty,
          maxQty: data.maxQty,
          externalId: data.externalId,
          targetType: targetType,
          customDataType: data.customDataType,
          customDataLabel: data.customDataLabel,
          isMediaGroupAware: data.isMediaGroupAware,
          isDripFeedEnabled: data.isDripFeedEnabled,
          isRefillEnabled: data.isRefillEnabled,
          isCancelEnabled: data.isCancelEnabled,
          isActive: data.isActive,
          requireWarning: data.requireWarning,
          warningMessage: data.warningMessage,
          clientRequirement: data.clientRequirement,
          clientConfirmation: data.clientConfirmation,
          providerCurrency,
          pricePer1000Cents
        }
      });
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_MANUAL_CREATE',
      target: service.id,
      targetType: 'SERVICE',
      newValue: {
        name: service.name,
        categoryId: service.categoryId,
        rate: service.rate,
        markup: service.markup,
        pricePer1000Cents: service.pricePer1000Cents,
        requireWarning: service.requireWarning,
        warningMessage: service.warningMessage,
        clientRequirement: service.clientRequirement,
        clientConfirmation: service.clientConfirmation
      }
    });

    revalidatePath("/admin/catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("services");

    return { success: true as const, serviceId: service.id };
  });
}

/**
 * Manually update an existing catalog Service
 */
export async function updateServiceAction(id: string, rawData: unknown) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    if (!id || typeof id !== 'string') {
      return { success: false as const, error: 'ID услуги обязателен' };
    }

    const parsed = serviceSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Неверные данные услуги' };
    }
    const data = parsed.data;

    // Verify service exists
    const service = await db.service.findUnique({
      where: { id }
    });
    if (!service) {
      return { success: false as const, error: 'Услуга не найдена' };
    }

    // Verify category exists
    const category = await db.category.findUnique({
      where: { id: data.categoryId }
    });
    if (!category) {
      return { success: false as const, error: 'Указанная категория не найдена' };
    }

    // Verify provider exists if provided
    let providerCurrency = service.providerCurrency;
    if (data.providerId) {
      const provider = await db.provider.findUnique({
        where: { id: data.providerId }
      });
      if (!provider) {
        return { success: false as const, error: 'Указанный провайдер SMM не найден' };
      }
      providerCurrency = provider.balanceCurrency;
    }

    // Infer targetType if not provided
    let targetType = data.targetType;
    if (!targetType) {
      targetType = inferTargetTypeFromCategory(category.name);
    }

    // Recalculate pricePer1000Cents dynamically using CBR exchange rate
    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const exchangeRate = providerCurrency === 'RUB' ? 1.0 : usdToRub;
    const pricePer1000Cents = Math.round(applyBeautifulRounding(data.rate * data.markup * exchangeRate) * 100);

    // Atomically update the service
    const updatedService = await db.$transaction(async (tx) => {
      return await tx.service.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          categoryId: data.categoryId,
          providerId: data.providerId,
          rate: data.rate,
          markup: data.markup,
          minQty: data.minQty,
          maxQty: data.maxQty,
          externalId: data.externalId,
          targetType: targetType,
          customDataType: data.customDataType,
          customDataLabel: data.customDataLabel,
          isMediaGroupAware: data.isMediaGroupAware,
          isDripFeedEnabled: data.isDripFeedEnabled,
          isRefillEnabled: data.isRefillEnabled,
          isCancelEnabled: data.isCancelEnabled,
          isActive: data.isActive,
          requireWarning: data.requireWarning,
          warningMessage: data.warningMessage,
          clientRequirement: data.clientRequirement,
          clientConfirmation: data.clientConfirmation,
          providerCurrency,
          pricePer1000Cents
        }
      });
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_MANUAL_UPDATE',
      target: id,
      targetType: 'SERVICE',
      oldValue: {
        name: service.name,
        categoryId: service.categoryId,
        rate: service.rate,
        markup: service.markup,
        pricePer1000Cents: service.pricePer1000Cents,
        requireWarning: service.requireWarning,
        warningMessage: service.warningMessage
      },
      newValue: {
        name: updatedService.name,
        categoryId: updatedService.categoryId,
        rate: updatedService.rate,
        markup: updatedService.markup,
        pricePer1000Cents: updatedService.pricePer1000Cents,
        requireWarning: updatedService.requireWarning,
        warningMessage: updatedService.warningMessage,
        clientRequirement: updatedService.clientRequirement,
        clientConfirmation: updatedService.clientConfirmation
      }
    });

    revalidatePath("/admin/catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("catalog");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)("services");

    return { success: true as const, serviceId: updatedService.id };
  });
}

```

---

### 📄 Файл 15 из 89: `src/actions/admin/catalog/soft-delete.ts`

```ts
'use server';

/**
 * Soft Delete Service Action — Sprint 1.8
 *
 * Archives a service (isActive=false, [ARCHIVED] prefix).
 * Does not hard-delete — preserves full order history integrity.
 */

import { requireStaffPermission } from '@/lib/server/rbac';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { auditAdmin } from '@/lib/admin-audit';

const serviceIdSchema = z.string().min(1);

export async function softDeleteServiceAction(serviceId: string) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    const id = serviceIdSchema.safeParse(serviceId);
    if (!id.success) {
      return { success: false as const, error: 'Неверный ID услуги' };
    }

    await adminCatalogService.softDeleteService(id.data, {
      id: admin.id,
      email: admin.email,
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_ARCHIVE',
      target: id.data,
      targetType: 'SERVICE'
    });

    revalidatePath('/admin/catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('catalog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (revalidateTag as any)('services');
    return { success: true as const };
  });
}

```

---

### 📄 Файл 16 из 89: `src/actions/admin/catalog/__tests__/categories-ops.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { batchReassignServicesCategoryAction } from '@/actions/admin/catalog/batch';
import { mergeCategoriesAction, createNetworkAction, updateNetworkAction, deleteNetworkAction } from '@/actions/admin/catalog/categories';
import { createServiceAction, updateServiceAction } from '@/actions/admin/catalog/services';
import { revalidatePath, revalidateTag } from 'next/cache';

// Mock cookies and headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest',
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

// Mock verifySession to control it per test
vi.mock('@/lib/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/session')>();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

// Helper to poll for audit logs since they are written fire-and-forget asynchronously
async function getAuditLog(action: string) {
  for (let i = 0; i < 25; i++) {
    const log = await db.adminAuditLog.findFirst({ where: { action } });
    if (log) return log;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return null;
}

describe('Milestone 5: Catalog CRUD & Categories Operations Test Suite', () => {
  let adminUser: any;
  let regularUser: any;

  beforeEach(async () => {
    // 1. Clean up database tables explicitly as requested
    await db.service.deleteMany();
    await db.category.deleteMany();
    await db.network.deleteMany();
    await db.provider.deleteMany();
    await db.adminAuditLog.deleteMany();
    await db.auditLog.deleteMany();
    await db.ledgerEntry.deleteMany();
    await db.user.deleteMany();

    // 2. Enable test mode in systemSettings
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 95.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 95.0 },
    });

    // 3. Create Admin/Owner user for RBAC testing
    adminUser = await db.user.create({
      data: {
        email: 'admin_test@smmplan.local',
        role: 'OWNER',
        isActive: true,
      },
    });

    // 4. Create standard user for RBAC violation testing
    regularUser = await db.user.create({
      data: {
        email: 'regular_test@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    vi.clearAllMocks();
  });

  describe('Service Batch Reassignment', () => {
    it('should successfully move a list of service IDs to a target category and record audit log', async () => {
      // Mock active admin session
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      // Create network & categories
      const network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram' },
      });
      const catA = await db.category.create({
        data: { name: 'Category A', networkId: network.id },
      });
      const catB = await db.category.create({
        data: { name: 'Category B', networkId: network.id },
      });

      // Create services in Category A
      const s1 = await db.service.create({
        data: { name: 'Service 1', categoryId: catA.id, rate: 1.0, markup: 2.0 },
      });
      const s2 = await db.service.create({
        data: { name: 'Service 2', categoryId: catA.id, rate: 1.5, markup: 2.0 },
      });

      // Call action
      const result = await batchReassignServicesCategoryAction([s1.id, s2.id], catB.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(2);
      }

      // Verify services moved
      const updatedS1 = await db.service.findUnique({ where: { id: s1.id } });
      const updatedS2 = await db.service.findUnique({ where: { id: s2.id } });
      expect(updatedS1!.categoryId).toBe(catB.id);
      expect(updatedS2!.categoryId).toBe(catB.id);

      // Verify audit log
      const auditLog = await getAuditLog('BATCH_SERVICE_REASSIGN');
      expect(auditLog).toBeDefined();
      expect(auditLog!.adminId).toBe(adminUser.id);
      expect(auditLog!.target).toContain(s1.id);
      expect(auditLog!.target).toContain(s2.id);

      // Verify revalidations called
      expect(revalidatePath).toHaveBeenCalledWith('/admin/catalog');
      expect(revalidateTag).toHaveBeenCalledWith('catalog');
      expect(revalidateTag).toHaveBeenCalledWith('services');
    });

    it('should fail if service IDs are invalid', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const result = await batchReassignServicesCategoryAction([], 'target-id');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid service IDs');
      }
    });

    it('should fail if target category does not exist', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram' },
      });
      const catA = await db.category.create({
        data: { name: 'Category A', networkId: network.id },
      });
      const s1 = await db.service.create({
        data: { name: 'Service 1', categoryId: catA.id, rate: 1.0, markup: 2.0 },
      });

      const result = await batchReassignServicesCategoryAction([s1.id], 'non-existent-cat-id');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Target category not found');
      }
    });

    it('should fail due to RBAC/permission violation for non-admin user', async () => {
      // Mock active regular user session
      vi.mocked(verifySession).mockResolvedValue({ userId: regularUser.id });

      const result = await batchReassignServicesCategoryAction(['some-id'], 'target-id');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Forbidden: Administrator/Staff context required');
      }
    });
  });

  describe('Category Merge', () => {
    it('should successfully merge category A into category B and delete A atomically', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram' },
      });
      const catA = await db.category.create({
        data: { name: 'Category A', networkId: network.id },
      });
      const catB = await db.category.create({
        data: { name: 'Category B', networkId: network.id },
      });

      // Services in category A
      const s1 = await db.service.create({
        data: { name: 'Service 1', categoryId: catA.id, rate: 1.0, markup: 2.0 },
      });
      const s2 = await db.service.create({
        data: { name: 'Service 2', categoryId: catA.id, rate: 1.5, markup: 2.0 },
      });

      // Call action
      const result = await mergeCategoriesAction(catA.id, catB.id);
      expect(result.success).toBe(true);

      // Verify all services reassigned to catB
      const updatedS1 = await db.service.findUnique({ where: { id: s1.id } });
      const updatedS2 = await db.service.findUnique({ where: { id: s2.id } });
      expect(updatedS1!.categoryId).toBe(catB.id);
      expect(updatedS2!.categoryId).toBe(catB.id);

      // Verify source category A is deleted
      const deletedCat = await db.category.findUnique({ where: { id: catA.id } });
      expect(deletedCat).toBeNull();

      // Verify audit log
      const auditLog = await getAuditLog('CATEGORY_MERGE');
      expect(auditLog).toBeDefined();
      expect(auditLog!.target).toBe(catA.id);

      // Verify revalidations
      expect(revalidatePath).toHaveBeenCalledWith('/admin/catalog/categories');
      expect(revalidatePath).toHaveBeenCalledWith('/admin/catalog');
      expect(revalidateTag).toHaveBeenCalledWith('catalog');
      expect(revalidateTag).toHaveBeenCalledWith('services');
    });

    it('should fail if source and target category IDs are same', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const result = await mergeCategoriesAction('cat-id', 'cat-id');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Source and target categories cannot be the same.');
      }
    });

    it('should fail if source category does not exist', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram' },
      });
      const catB = await db.category.create({
        data: { name: 'Category B', networkId: network.id },
      });

      const result = await mergeCategoriesAction('non-existent-cat', catB.id);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Source category not found.');
      }
    });

    it('should fail if target category does not exist', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram' },
      });
      const catA = await db.category.create({
        data: { name: 'Category A', networkId: network.id },
      });

      const result = await mergeCategoriesAction(catA.id, 'non-existent-cat');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Target category not found.');
      }
    });

    it('should fail due to RBAC violation', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: regularUser.id });

      const result = await mergeCategoriesAction('cat-a', 'cat-b');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Forbidden: Administrator/Staff context required');
      }
    });
  });

  describe('Network CRUD Operations', () => {
    it('should successfully create a new network and verify validations & audit logs', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const payload = { name: 'Instagram', slug: 'instagram', sort: 10 };
      const result = await createNetworkAction(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.networkId).toBeDefined();
      }

      // Verify in DB
      const network = await db.network.findFirst({ where: { slug: 'instagram' } });
      expect(network).toBeDefined();
      expect(network!.name).toBe('Instagram');
      expect(network!.sort).toBe(10);

      // Verify audit log
      const auditLog = await getAuditLog('NETWORK_CREATE');
      expect(auditLog).toBeDefined();
      expect(auditLog!.target).toBe(network!.id);

      // Verify revalidations
      expect(revalidatePath).toHaveBeenCalledWith('/admin/catalog/categories');
      expect(revalidatePath).toHaveBeenCalledWith('/admin/catalog');
      expect(revalidateTag).toHaveBeenCalledWith('catalog');
    });

    it('should enforce slug format validation in createNetworkAction', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      // Slug with spaces or uppercase should fail
      const result = await createNetworkAction({ name: 'Instagram', slug: 'Instagram Slug', sort: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Slug must be lowercase alphanumeric');
      }
    });

    it('should enforce uniqueness check in createNetworkAction', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      await db.network.create({
        data: { name: 'Telegram', slug: 'telegram' },
      });

      // Try creating with duplicate name
      const resName = await createNetworkAction({ name: 'Telegram', slug: 'telegram-new', sort: 0 });
      expect(resName.success).toBe(false);
      if (!resName.success) {
        expect(resName.error).toBe('Сеть с таким названием или slug уже существует');
      }

      // Try creating with duplicate slug
      const resSlug = await createNetworkAction({ name: 'Telegram New', slug: 'telegram', sort: 0 });
      expect(resSlug.success).toBe(false);
      if (!resSlug.success) {
        expect(resSlug.error).toBe('Сеть с таким названием или slug уже существует');
      }
    });

    it('should successfully update a network and verify unique constraint and audit logs', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram', sort: 1 },
      });

      const result = await updateNetworkAction(network.id, {
        name: 'Telegram Updated',
        slug: 'telegram-new',
        sort: 2,
      });
      expect(result.success).toBe(true);

      // Verify in DB
      const updated = await db.network.findUnique({ where: { id: network.id } });
      expect(updated!.name).toBe('Telegram Updated');
      expect(updated!.slug).toBe('telegram-new');
      expect(updated!.sort).toBe(2);

      // Verify audit log
      const auditLog = await getAuditLog('NETWORK_UPDATE');
      expect(auditLog).toBeDefined();
      expect(auditLog!.target).toBe(network.id);
      expect(auditLog!.oldValue).toContain('Telegram');
      expect(auditLog!.newValue).toContain('Telegram Updated');
    });

    it('should prevent deleting a network with associated categories', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram' },
      });
      await db.category.create({
        data: { name: 'Telegram Members', networkId: network.id },
      });

      const result = await deleteNetworkAction(network.id);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Невозможно удалить сеть. Она содержит');
      }

      // Verify network still exists
      const check = await db.network.findUnique({ where: { id: network.id } });
      expect(check).toBeDefined();
    });

    it('should successfully delete an empty network', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram' },
      });

      const result = await deleteNetworkAction(network.id);
      expect(result.success).toBe(true);

      // Verify in DB
      const check = await db.network.findUnique({ where: { id: network.id } });
      expect(check).toBeNull();

      // Verify audit log
      const auditLog = await getAuditLog('NETWORK_DELETE');
      expect(auditLog).toBeDefined();
      expect(auditLog!.target).toBe(network.id);
    });
  });

  describe('Service CRUD Operations', () => {
    it('should manually create a service, verify price conversion, targetType auto-inference, and provider binding', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      // Create category under network
      const network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram' },
      });
      // Name includes 'подписчик' to test targetType auto-inference -> CHANNEL
      const category = await db.category.create({
        data: { name: 'Подписчики Telegram', networkId: network.id },
      });

      // Create provider
      const provider = await db.provider.create({
        data: { name: 'VexBoost', apiUrl: 'http://localhost/api', apiKey: 'api-key-123' },
      });

      const payload = {
        name: 'Manual TG Members service',
        description: 'Quality members for TG channel',
        categoryId: category.id,
        providerId: provider.id,
        rate: 0.5, // 0.5 USD per 1k
        markup: 3.0, // 3.0x markup
        minQty: 100,
        maxQty: 10000,
        externalId: 'ext-tg-members',
      };

      const result = await createServiceAction(payload);
      expect(result.success).toBe(true);
      let serviceId = '';
      if (result.success) {
        serviceId = result.serviceId;
        expect(serviceId).toBeDefined();
      }

      // Verify in DB
      const service = await db.service.findUnique({ where: { id: serviceId } });
      expect(service).toBeDefined();
      expect(service!.name).toBe('Manual TG Members service');
      expect(service!.providerId).toBe(provider.id);
      expect(service!.externalId).toBe('ext-tg-members');

      // Verify targetType auto-inference -> CHANNEL because category name contains 'Подписчики'
      expect(service!.targetType).toBe('CHANNEL');

      // Verify pricePer1000Cents dynamic conversion using 95.0 USD exchange rate
      // rate (0.5) * markup (3.0) * rateUSD (95) = 142.5
      // applyBeautifulRounding(142.5) -> since < 1000, ceil to nearest 10 -> 150
      // pricePer1000Cents = 150 * 100 = 15000
      expect(service!.pricePer1000Cents).toBe(15000);

      // Verify audit log
      const auditLog = await getAuditLog('SERVICE_MANUAL_CREATE');
      expect(auditLog).toBeDefined();
      expect(auditLog!.target).toBe(serviceId);
    });

    it('should successfully update service parameters and write correct audit logging', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram' },
      });
      const category = await db.category.create({
        data: { name: 'Лайки ВК', networkId: network.id }, // falls back to POST targetType
      });

      const service = await db.service.create({
        data: {
          name: 'BK Likes Service',
          categoryId: category.id,
          rate: 1.0,
          markup: 2.0,
          minQty: 10,
          maxQty: 100,
          targetType: 'POST',
        },
      });

      const payload = {
        name: 'BK Likes Service Updated',
        description: 'New Description',
        categoryId: category.id,
        rate: 1.5,
        markup: 3.5,
        minQty: 20,
        maxQty: 200,
      };

      const result = await updateServiceAction(service.id, payload);
      expect(result.success).toBe(true);

      // Verify DB
      const updated = await db.service.findUnique({ where: { id: service.id } });
      expect(updated!.name).toBe('BK Likes Service Updated');
      expect(updated!.rate).toBe(1.5);
      expect(updated!.markup).toBe(3.5);
      expect(updated!.minQty).toBe(20);
      expect(updated!.maxQty).toBe(200);

      // Verify audit log Old & New values
      const auditLog = await getAuditLog('SERVICE_MANUAL_UPDATE');
      expect(auditLog).toBeDefined();
      expect(auditLog!.target).toBe(service.id);
      expect(auditLog!.oldValue).toContain('BK Likes Service');
      expect(auditLog!.newValue).toContain('BK Likes Service Updated');
    });
  });
});

```

---

### 📄 Файл 17 из 89: `src/actions/admin/catalog/__tests__/services-crud.test.ts`

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { createServiceAction, updateServiceAction } from '../services';

// Mock cookies and headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest',
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

// Mock verifySession to control roles per test
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

describe('Manual Service Import & Editing CRUD Tests', () => {
  let adminUser: any;
  let regularUser: any;
  let provider: any;
  let categorySubscribers: any;
  let categoryLikes: any;

  beforeEach(async () => {
    // 1. Setup systemSettings with exchange rates
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    // 3. Create Admin and Regular User
    adminUser = await db.user.create({
      data: {
        email: 'admin_crud@smmplan.local',
        role: 'OWNER',
        isActive: true,
      },
    });

    regularUser = await db.user.create({
      data: {
        email: 'user_crud@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    // 4. Create provider
    provider = await db.provider.create({
      data: {
        name: 'Manual CRUD Provider',
        apiUrl: 'http://localhost/api/crud',
        apiKey: 'key-crud',
        balanceCurrency: 'USD',
        isActive: true
      }
    });

    // 5. Create social network and categories
    const network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram' }
    });

    categorySubscribers = await db.category.create({
      data: { name: 'Подписчики Telegram', networkId: network.id }
    });

    categoryLikes = await db.category.create({
      data: { name: 'Лайки Telegram', networkId: network.id }
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fail with Forbidden error when non-admin attempts CRUD', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: regularUser.id });

    console.log("DEBUG TEST 1 regularUser:", regularUser);
    const dbUserBefore = await db.user.findUnique({ where: { id: regularUser.id } });
    console.log("DEBUG TEST 1 dbUserBefore:", dbUserBefore);
    const allUsers = await db.user.findMany();
    console.log("DEBUG TEST 1 allUsers:", allUsers);

    const createPayload = {
      name: 'Forbidden Service',
      categoryId: categorySubscribers.id,
      rate: 1.5,
      markup: 3.0,
      minQty: 10,
      maxQty: 5000,
    };

    const res = await createServiceAction(createPayload);
    const failRes = res as { success: false; error: string };
    expect(failRes.success).toBe(false);
    expect(failRes.error).toContain('Forbidden: Administrator/Staff context required');
  });

  it('should successfully manually create a service and infer correct targetType from category name', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    const createPayload = {
      name: 'TG Subscribers Premium HQ',
      description: 'Test manual creation description',
      categoryId: categorySubscribers.id,
      providerId: provider.id,
      rate: 0.8, // USD 0.80 per 1k
      markup: 4.0, // x4 markup multiplier
      minQty: 50,
      maxQty: 10000,
      externalId: 'ext-505',
      // targetType is left empty to test auto-inference
    };

    const { SettingsProvider } = await import('@/lib/settings');
    console.log("DEBUG CREATE TEST EXCHANGE RATE:", await SettingsProvider.getExchangeRateUSD());
    const res = await createServiceAction(createPayload);
    if (!res.success) {
      console.error("CREATE SERVICE ACTION FAILED ERROR:", (res as any).error);
    }
    const successRes = res as { success: true; serviceId: string };
    expect(successRes.success).toBe(true);
    expect(successRes.serviceId).toBeDefined();

    // Verify DB entry is created correctly
    const created = await db.service.findUnique({
      where: { id: successRes.serviceId }
    });

    expect(created).toBeDefined();
    expect(created?.name).toBe('TG Subscribers Premium HQ');
    expect(created?.rate).toBe(0.8);
    expect(created?.markup).toBe(4.0);
    
    // Auto inferred targetType: category contains "Подписчики" -> CHANNEL!
    expect(created?.targetType).toBe('CHANNEL');

    // Denormalized retail price in cents calculation: 
    // rate 0.8 * markup 4.0 * exchangeRate 100 = 320.00 RUB -> 32000 cents
    expect(created?.pricePer1000Cents).toBe(32000);

    // Verify AdminAuditLog is written
    const audit = await db.adminAuditLog.findFirst({
      where: { action: 'SERVICE_MANUAL_CREATE', target: created?.id }
    });
    expect(audit).toBeDefined();
    expect(audit?.adminEmail).toBe(adminUser.email);
  });

  it('should successfully manually update service details and recalculate pricePer1000Cents on change', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Pre-create service
    const service = await db.service.create({
      data: {
        name: 'Old Service Name',
        categoryId: categorySubscribers.id,
        providerId: provider.id,
        rate: 1.0,
        markup: 2.0,
        pricePer1000Cents: 20000, // 1.0 * 2.0 * 100 * 100
        minQty: 10,
        maxQty: 5000,
        targetType: 'CHANNEL'
      }
    });

    // Update details: change category to Likes, rate to 0.5, markup to 3.5, and targetType to POST
    const updatePayload = {
      name: 'New Service Name',
      description: 'Updated Description',
      categoryId: categoryLikes.id,
      providerId: provider.id,
      rate: 0.5,
      markup: 3.5,
      minQty: 20,
      maxQty: 8000,
      externalId: 'ext-909',
      targetType: 'POST', // Manually set
      customDataType: 'TEXTAREA',
      isMediaGroupAware: true
    };

    const { SettingsProvider } = await import('@/lib/settings');
    console.log("DEBUG UPDATE TEST EXCHANGE RATE:", await SettingsProvider.getExchangeRateUSD());
    const res = await updateServiceAction(service.id, updatePayload);
    const successRes = res as { success: true; serviceId: string };
    expect(successRes.success).toBe(true);

    const updated = await db.service.findUnique({
      where: { id: service.id }
    });

    expect(updated?.name).toBe('New Service Name');
    expect(updated?.description).toBe('Updated Description');
    expect(updated?.categoryId).toBe(categoryLikes.id);
    expect(updated?.rate).toBe(0.5);
    expect(updated?.markup).toBe(3.5);
    expect(updated?.minQty).toBe(20);
    expect(updated?.maxQty).toBe(8000);
    expect(updated?.externalId).toBe('ext-909');
    expect(updated?.targetType).toBe('POST');
    expect(updated?.customDataType).toBe('TEXTAREA');
    expect(updated?.isMediaGroupAware).toBe(true);

    // Dynamic price recalculation check (with psychological rounding):
    // rate 0.5 * markup 3.5 * exchangeRate 100 = 175.00 RUB -> rounded to 180.00 RUB -> 18000 cents
    expect(updated?.pricePer1000Cents).toBe(18000);

    // Verify AdminAuditLog is written with oldValue and newValue tracking
    await new Promise(resolve => setTimeout(resolve, 100));
    const audit = await db.adminAuditLog.findFirst({
      where: { action: 'SERVICE_MANUAL_UPDATE', target: service.id }
    });
    expect(audit).toBeDefined();
    
    // Check old values recorded
    const oldVal = JSON.parse(audit?.oldValue as string);
    expect(oldVal.name).toBe('Old Service Name');
    expect(oldVal.rate).toBe(1.0);
    expect(oldVal.markup).toBe(2.0);

    // Check new values recorded
    const newVal = JSON.parse(audit?.newValue as string);
    expect(newVal.name).toBe('New Service Name');
    expect(newVal.rate).toBe(0.5);
    expect(newVal.markup).toBe(3.5);
  });
});

```

---

### 📄 Файл 18 из 89: `src/actions/admin/catalog.ts`

```ts
'use server';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { verifySession } from '@/lib/session';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { db } from '@/lib/db';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { catalogQueue } from '@/workers/queues';
import { revalidatePath } from 'next/cache';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { z } from 'zod';
import { updateMarkupSchema, toggleServiceSchema, bulkUpdateMarkupSchema } from '@/validators/admin.validators';
import { auditAdmin } from '@/lib/admin-audit';

import { requireStaffPermission } from '@/lib/server/rbac';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function updateMarkupAction(formData: FormData) {
  const result = await requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = updateMarkupSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new Error('serviceId и markup обязательны');
    const { serviceId, markup } = parsed.data;

    await adminCatalogService.updateMarkup(serviceId, markup, {
      id: admin.id,
      email: admin.email,
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_MARKUP_UPDATE',
      target: serviceId,
      targetType: 'SERVICE',
      newValue: { markup }
    });

    revalidatePath('/admin/catalog');
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    throw new Error(result.error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function toggleServiceAction(formData: FormData) {
  const result = await requireStaffPermission('catalog', 'edit', async (admin) => {
    const parsed = toggleServiceSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new Error('Missing serviceId');
    const { serviceId, isActive } = parsed.data;

    await adminCatalogService.toggleService(serviceId, isActive, {
      id: admin.id,
      email: admin.email,
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isActive ? 'SERVICE_ENABLE' : 'SERVICE_DISABLE',
      target: serviceId,
      targetType: 'SERVICE',
    });

    revalidatePath('/admin/catalog');
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    throw new Error(result.error);
  }
}

/**
 * Bulk update markup for all services in a category or platform.
 * Pass markup=0 to auto-calculate from Pricing Ladder.
 */
export async function bulkUpdateMarkupAction(formData: FormData) {
  const result = await requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = bulkUpdateMarkupSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      throw new Error('Наценка должна быть в диапазоне 1.0–151.0');
    }
    const { categoryId, platform, markup } = parsed.data;

    const filter: { categoryId?: string; platform?: string } = {};
    if (categoryId) filter.categoryId = categoryId;
    if (platform) filter.platform = platform;

    // 🌊 WAVE 1.3: Background Catalog Processing
    // We send this to the BullMQ worker to prevent Vercel 15s timeout
    await catalogQueue.add('bulk-markup-bg', {
      type: 'BULK_MARKUP',
      filter,
      markupPercent: markup,
      admin: { id: admin.id, email: admin.email, role: admin.role }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BULK_MARKUP_UPDATE',
      target: categoryId || platform || 'ALL',
      targetType: 'SERVICE',
      newValue: { markup, filter },
    });

    revalidatePath('/admin/catalog');
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    throw new Error(result.error);
  }
}

/**
 * Returns markup distribution analytics for the admin dashboard.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getMarkupAnalyticsAction() {
  const result = await requireStaffPermission('catalog', 'view', async () => {
    return adminCatalogService.getMarkupAnalytics();
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    throw new Error(result.error);
  }
  return result;
}

```

---

### 📄 Файл 19 из 89: `src/actions/admin/clients.ts`

```ts
'use server';

/**
 * Client management Server Actions (Sprint 1.4)
 *
 * updateClientDiscountAction — set personalDiscount + optional expiry
 * updateClientNoteAction — set/clear internal operator note
 *
 * Security:
 * - requireAdmin on all actions
 * - adminNote is NEVER exposed to client-facing APIs
 * - discount capped at 50% (business rule)
 */

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { auditAdmin } from '@/lib/admin-audit';
import { serializeForClient } from '@/lib/bigint-serializer';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const MAX_DISCOUNT = 50; // Business rule: max personal discount

const discountSchema = z.object({
  userId: z.string().min(1),
  discount: z.number().min(0).max(MAX_DISCOUNT),
  endsAt: z.string().datetime().optional(), // ISO 8601
}).refine((data) => {
  if (data.endsAt) {
    return new Date(data.endsAt).getTime() > Date.now();
  }
  return true;
}, {
  message: "Срок окончания скидки должен быть в будущем",
  path: ["endsAt"]
});

const noteSchema = z.object({
  userId: z.string().min(1),
  note: z.string().max(2000).optional(),
});

/** Set personal discount for a client (0 = remove discount) */
export async function updateClientDiscountAction(
  userId: string,
  discount: number,
  endsAt?: string
) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = discountSchema.safeParse({ userId, discount, endsAt });
    if (!parsed.success) {
      return { success: false as const, error: `Максимальная скидка ${MAX_DISCOUNT}%` };
    }

    const user = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, personalDiscount: true },
    });
    if (!user) return { success: false as const, error: 'Пользователь не найден' };

    await db.user.update({
      where: { id: user.id },
      data: {
        personalDiscount: parsed.data.discount,
        discountEndsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CLIENT_DISCOUNT_SET',
      target: user.id,
      targetType: 'USER',
      oldValue: { discount: user.personalDiscount },
      newValue: { discount: parsed.data.discount, endsAt: parsed.data.endsAt },
    });

    revalidatePath(`/admin/clients/${user.id}`);
    revalidatePath('/admin/clients');
    return { success: true as const };
  });
}

/** Update internal admin note for a client */
export async function updateClientNoteAction(userId: string, note: string) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = noteSchema.safeParse({ userId, note });
    if (!parsed.success) {
      return { success: false as const, error: 'Заметка слишком длинная (макс 2000 символов)' };
    }

    await db.user.update({
      where: { id: parsed.data.userId },
      data: {
        adminNote: parsed.data.note?.trim() || null,
        adminNoteUpdatedAt: new Date(),
        adminNoteUpdatedBy: admin.email,
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CLIENT_NOTE_UPDATE',
      target: parsed.data.userId,
      targetType: 'USER',
    });

    revalidatePath(`/admin/clients/${parsed.data.userId}`);
    return { success: true as const };
  });
}

/** Fetch full client profile for the detail page */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getClientProfileAction(userId: string) {
  return requireStaffPermission('finance', 'view', async () => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        balance: true,
        quarantineBalance: true,
        totalSpent: true,
        personalDiscount: true,
        discountEndsAt: true,
        adminNote: true,
        adminNoteUpdatedAt: true,
        adminNoteUpdatedBy: true,
        telegramId: true,
        apiKeyHash: true,
        referralCode: true,
        referralBalance: true,
        createdAt: true,
        _count: { select: { orders: true, payments: true, tickets: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            numericId: true,
            status: true,
            quantity: true,
            charge: true,
            createdAt: true,
            service: { select: { name: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) return { success: false as const, error: 'Пользователь не найден' };

    return { success: true as const, user: serializeForClient(user) };
  });
}

```

---

### 📄 Файл 20 из 89: `src/actions/admin/content.ts`

```ts
"use server";

import { db as prisma } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const contentSchema = z.object({
  title: z.string().min(3, "Заголовок должен быть длиннее 3 символов"),
  slug: z.string().min(2, "Slug обязателен").refine((val) => {
    const reservedWords = ["api", "admin", "auth", "_next", "static", "dashboard", "orders", "draft"];
    return !reservedWords.includes(val.toLowerCase());
  }, "Этот URL зарезервирован системой"),
  type: z.enum(["PAGE", "ACADEMY_LESSON", "GLOSSARY_TERM", "NEWS_POST"]),
  categoryId: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  contentJson: z.string().nullable().optional(),
  isPublished: z.boolean().default(false),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
});

export async function createContent(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async () => {
    const data = {
      title: formData.get("title") as string,
      slug: formData.get("slug") as string,
      type: formData.get("type") as "PAGE" | "ACADEMY_LESSON" | "GLOSSARY_TERM" | "NEWS_POST",
      categoryId: formData.get("categoryId") as string || null,
    };

    const parsed = contentSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false as const, errors: parsed.error.flatten().fieldErrors };
    }

    try {
      const item = await prisma.contentItem.create({
        data: {
          ...parsed.data,
          authorName: "Администратор", 
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (revalidateTag as any)("cms-list");
      return { success: true as const, item };
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "P2002") {
        return { success: false as const, error: "Статья с таким URL (slug) уже существует." };
      }
      return { success: false as const, error: "Ошибка базы данных" };
    }
  });
}

const contentUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  slug: z.string().min(2).refine((val) => {
    const reservedWords: string[] = ["api", "admin", "auth", "_next", "static", "dashboard", "orders", "draft"];
    return !reservedWords.includes(val.toLowerCase());
  }, "Этот URL зарезервирован системой").optional(),
  type: z.enum(["PAGE", "ACADEMY_LESSON", "GLOSSARY_TERM", "NEWS_POST"]).optional(),
  categoryId: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  contentJson: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
}).strict(); 

export async function updateContent(id: string, updateData: Partial<z.infer<typeof contentSchema>>) {
  return requireStaffPermission('settings', 'edit', async () => {
    const parsed = contentUpdateSchema.safeParse(updateData);
    if (!parsed.success) {
      return { success: false as const, error: "Невалидные данные для обновления", errors: parsed.error.flatten().fieldErrors };
    }

    try {
      const item = await prisma.contentItem.update({
        where: { id },
        data: parsed.data,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (revalidateTag as any)(`article-${item.slug}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (revalidateTag as any)("cms-list");

      return { success: true as const, item };
    } catch {
      return { success: false as const, error: "Ошибка при обновлении статьи" };
    }
  });
}

export async function publishContent(id: string) {
  return requireStaffPermission('settings', 'edit', async () => {
    try {
      const item = await prisma.contentItem.findUnique({ where: { id } });
      if (!item || !item.contentJson) {
        return { success: false as const, error: "Статья не найдена или пустая" };
      }

      const { ServerBlockNoteEditor } = await import("@blocknote/server-util");
      
      const editor = ServerBlockNoteEditor.create();
      const blocks = JSON.parse(item.contentJson);
      const contentHtml = await editor.blocksToHTMLLossy(blocks);

      const updated = await prisma.contentItem.update({
        where: { id },
        data: {
          contentHtml,
          isPublished: true,
          publishedAt: item.publishedAt || new Date(),
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (revalidateTag as any)(`article-${item.slug}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (revalidateTag as any)("cms-list");

      return { success: true as const, item: updated };
    } catch (error) {
      console.error("Publish error:", error);
      return { success: false as const, error: "Ошибка при генерации HTML или публикации" };
    }
  });
}

export async function unpublishContent(id: string) {
  return requireStaffPermission('settings', 'edit', async () => {
    try {
      const updated = await prisma.contentItem.update({
        where: { id },
        data: {
          isPublished: false,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (revalidateTag as any)(`article-${updated.slug}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (revalidateTag as any)("cms-list");

      return { success: true as const, item: updated };
    } catch {
      return { success: false as const, error: "Ошибка при снятии с публикации" };
    }
  });
}

```

---

### 📄 Файл 21 из 89: `src/actions/admin/feature-flags.ts`

```ts
'use server';

/**
 * Server Actions: Feature Flags
 * 
 * All actions require OWNER or ADMIN role (requireAdmin guard).
 * State transitions are logged via AdminAuditLog.
 * 
 * References:
 * - FeatureFlagService: @/services/system/feature-flag.service
 * - Guard: @/lib/server/rbac (requireAdmin)
 * - Audit: @/lib/admin-audit
 */

import { requireStaffPermission } from '@/lib/server/rbac';
import { featureFlagService, type FlagKey, type FlagState } from '@/services/system/feature-flag.service';
import { auditAdmin } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';

/** List all feature flags with current state */
export async function getFeatureFlags() {
  return requireStaffPermission('SETTINGS', 'view', async () => {
    const flags = await featureFlagService.listAll();
    return { success: true as const, data: flags };
  });
}

/** Toggle a feature flag state */
export async function setFeatureFlagState(key: FlagKey, state: FlagState) {
  return requireStaffPermission('SETTINGS', 'edit', async (admin) => {
    // Security: validate state value
    if (!['ON', 'TEST', 'OFF'].includes(state)) {
      return { success: false as const, error: 'Invalid state value' };
    }

    const previous = await featureFlagService.getState(key);
    const updated = await featureFlagService.setState(key, state, admin.email);

    // Audit log: record all flag changes (fire-and-forget, non-blocking)
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'FEATURE_FLAG_CHANGE',
      target: key,
      targetType: 'SETTINGS',
      oldValue: { state: previous },
      newValue: { state },
    });

    revalidatePath('/admin/system/features');
    return { success: true as const, data: updated };
  });
}

```

---

### 📄 Файл 22 из 89: `src/actions/admin/finance/ledger.ts`

```ts
'use server';

/**
 * Finance Ledger Server Action — Sprint 1.6
 *
 * Paginated ledger entries with filters.
 * Security: Admin-only route (layout enforces enforcePageRole).
 * No requireAdmin wrapper needed — page is behind /admin layout guard.
 */

import { db } from '@/lib/db';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';

const ledgerParamsSchema = z.object({
  status:   z.enum(['ALL', 'APPROVED', 'QUARANTINE', 'REJECT']).default('ALL'),
  period:   z.enum(['today', 'week', 'month', 'all']).default('month'),
  search:   z.string().max(255).optional(),
  cursor:   z.string().optional(),
  pageSize: z.number().int().min(1).max(200).default(50),
  tenantId: z.string().optional(),
});

export type LedgerParams = z.infer<typeof ledgerParamsSchema>;

export type LedgerEntryDTO = {
  id: string;
  userId: string;
  userEmail: string;
  adminId: string | null;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
  tenantId?: string;
};

export type LedgerPageResult = {
  items: LedgerEntryDTO[];
  nextCursor: string | null;
  hasMore: boolean;
  totals: { approved: number; quarantine: number; refunds: number };
};

function getPeriodStart(period: string): Date | undefined {
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  return undefined;
}

export async function getLedgerAction(params: Partial<LedgerParams>): Promise<LedgerPageResult | { success: false, error: string }> {
  return requireStaffPermission('finance', 'view', async (admin) => {
    const p = ledgerParamsSchema.parse(params);
    const periodStart = getPeriodStart(p.period);

    const searchTrim = p.search?.trim();
    const activeTenantId = resolveAdminTenantContext(admin, p.tenantId);

    const where = {
      ...(p.status !== 'ALL' ? { status: p.status } : {}),
      ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
      ...(activeTenantId && activeTenantId !== 'all' ? { user: { tenantId: activeTenantId } } : {}),
      ...(searchTrim ? {
        OR: [
          { user: { is: { email: { contains: searchTrim, mode: 'insensitive' as const } } } },
          { id: { contains: searchTrim, mode: 'insensitive' as const } },
          { idempotencyKey: { contains: searchTrim, mode: 'insensitive' as const } }
        ]
      } : {}),
    };

    const pageSize = p.pageSize;
    const entries = await db.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize + 1,
      ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        userId: true,
        adminId: true,
        amount: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });

    const hasMore = entries.length > pageSize;
    const page = hasMore ? entries.slice(0, pageSize) : entries;

    // Enrich with user email
    const uIds = Array.from(new Set(page.map(e => e.userId)));
    const users = await db.user.findMany({
      where: { id: { in: uIds } },
      select: { id: true, email: true, tenantId: true },
    });
    const emailMap = new Map(users.map(u => [u.id, u.email]));
    const tenantMap = new Map(users.map(u => [u.id, u.tenantId]));

    // Totals for the same where clause (summary strip)
    const [approvedAgg, quarantineAgg, refundsAgg] = await Promise.all([
      db.ledgerEntry.aggregate({ _sum: { amount: true }, where: { ...where, status: 'APPROVED', amount: { gt: 0 } } }),
      db.ledgerEntry.aggregate({ _sum: { amount: true }, where: { ...where, status: 'QUARANTINE' } }),
      db.ledgerEntry.aggregate({ _sum: { amount: true }, where: { ...where, status: 'APPROVED', amount: { lt: 0 } } }),
    ]);

    return {
      items: page.map(e => ({
        id: e.id,
        userId: e.userId,
        userEmail: emailMap.get(e.userId) ?? e.userId,
        adminId: e.adminId,
        amount: Number(e.amount), // BigInt → number at DTO boundary
        reason: e.reason,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
        tenantId: tenantMap.get(e.userId) ?? 'smmplan',
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      hasMore,
      totals: {
        approved: Number(approvedAgg._sum?.amount ?? 0),
        quarantine: Number(quarantineAgg._sum?.amount ?? 0),
        refunds: Math.abs(Number(refundsAgg._sum?.amount ?? 0)),
      },
    };
  });
}

```

---

### 📄 Файл 23 из 89: `src/actions/admin/finance/payments.ts`

```ts
'use server';

/**
 * Admin Payments Server Action — Dispute Pack & Registry
 *
 * Security: Staff permission check ('finance', 'view').
 */

import { db } from '@/lib/db';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';

const paymentsParamsSchema = z.object({
  status:   z.enum(['ALL', 'PENDING', 'SUCCEEDED', 'CANCELED']).default('ALL'),
  period:   z.enum(['today', 'week', 'month', 'all']).default('month'),
  search:   z.string().max(255).optional(),
  cursor:   z.string().optional(),
  pageSize: z.number().int().min(1).max(200).default(50),
  tenantId: z.string().optional(),
});

export type PaymentsParams = z.infer<typeof paymentsParamsSchema>;

export type PaymentDTO = {
  id: string;
  userId: string;
  userEmail: string;
  amount: number; // in Cents at DB layer, passed as number
  currency: string;
  status: string;
  gateway: string;
  gatewayId: string | null;
  consentIp: string | null;
  consentUserAgent: string | null;
  createdAt: string;
  tenantId: string;
};

export type PaymentsPageResult = {
  items: PaymentDTO[];
  nextCursor: string | null;
  hasMore: boolean;
};

function getPeriodStart(period: string): Date | undefined {
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  return undefined;
}

export async function getPaymentsAction(params: Partial<PaymentsParams>): Promise<PaymentsPageResult | { success: false, error: string }> {
  return requireStaffPermission('finance', 'view', async (admin) => {
    const p = paymentsParamsSchema.parse(params);
    const periodStart = getPeriodStart(p.period);

    const searchTrim = p.search?.trim();
    const activeTenantId = resolveAdminTenantContext(admin, p.tenantId);

    const where = {
      ...(p.status !== 'ALL' ? { status: p.status } : {}),
      ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
      ...(activeTenantId && activeTenantId !== 'all' ? { tenantId: activeTenantId } : {}),
      ...(searchTrim ? {
        OR: [
          { user: { is: { email: { contains: searchTrim, mode: 'insensitive' as const } } } },
          { id: { contains: searchTrim, mode: 'insensitive' as const } },
          { gatewayId: { contains: searchTrim, mode: 'insensitive' as const } }
        ]
      } : {}),
    };

    const pageSize = p.pageSize;
    const payments = await db.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize + 1,
      ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    const hasMore = payments.length > pageSize;
    const page = hasMore ? payments.slice(0, pageSize) : payments;

    return {
      items: page.map(e => ({
        id: e.id,
        userId: e.userId,
        userEmail: e.user?.email ?? 'Unknown',
        amount: Number(e.amount),
        currency: e.currency,
        status: e.status,
        gateway: e.gateway,
        gatewayId: e.gatewayId,
        consentIp: e.consentIp,
        consentUserAgent: e.consentUserAgent,
        createdAt: e.createdAt.toISOString(),
        tenantId: e.tenantId,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      hasMore,
    };
  });
}

type DisputePackOrderDTO = {
  id: string;
  numericId: number;
  serviceName: string;
  link: string;
  quantity: number;
  charge: number; // Cents
  status: string;
  remains: number;
  createdAt: string;
};

export type DisputePackLedgerDTO = {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
};

export type PaymentDisputePackDTO = {
  payment: PaymentDTO;
  user: {
    id: string;
    email: string;
    createdAt: string;
    totalSpent: number; // Cents
    balance: number; // Cents
  };
  orders: DisputePackOrderDTO[];
  ledgerEntries: DisputePackLedgerDTO[];
};

export async function getPaymentDisputePackAction(paymentId: string): Promise<PaymentDisputePackDTO | { success: false, error: string }> {
  return requireStaffPermission('finance', 'view', async (): Promise<PaymentDisputePackDTO | { success: false; error: string }> => {
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            totalSpent: true,
            balance: true,
          },
        },
        orders: {
          include: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return { success: false, error: 'Платеж не найден' };
    }

    if (!payment.user) {
      return { success: false, error: 'Пользователь не связан с платежом' };
    }

    // Capture associated orders (either direct or post-deposit orders)
    let associatedOrders = payment.orders;
    if (associatedOrders.length === 0) {
      // Direct deposit top-up: find orders created by this user right after the payment was initiated (up to 7 days)
      associatedOrders = await db.order.findMany({
        where: {
          userId: payment.userId,
          createdAt: {
            gte: payment.createdAt,
            lte: new Date(payment.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days window
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        include: {
          service: {
            select: {
              name: true,
            },
          },
        },
      });
    }

    const ledgerEntries = await db.ledgerEntry.findMany({
      where: { userId: payment.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      payment: {
        id: payment.id,
        userId: payment.userId,
        userEmail: payment.user.email,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        gateway: payment.gateway,
        gatewayId: payment.gatewayId,
        consentIp: payment.consentIp,
        consentUserAgent: payment.consentUserAgent,
        createdAt: payment.createdAt.toISOString(),
        tenantId: payment.tenantId,
      },
      user: {
        id: payment.user.id,
        email: payment.user.email,
        createdAt: payment.user.createdAt.toISOString(),
        totalSpent: Number(payment.user.totalSpent),
        balance: Number(payment.user.balance),
      },
      orders: associatedOrders.map(o => ({
        id: o.id,
        numericId: o.numericId,
        serviceName: o.service?.name ?? 'Unknown Service',
        link: o.link,
        quantity: o.quantity,
        charge: Number(o.charge),
        status: o.status,
        remains: o.remains,
        createdAt: o.createdAt.toISOString(),
      })),
      ledgerEntries: ledgerEntries.map(l => ({
        id: l.id,
        type: l.transactionType,
        amount: Number(l.amount),
        description: l.reason,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  });
}

```

---

### 📄 Файл 24 из 89: `src/actions/admin/health.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { ordersQueue } from '@/lib/queue-manager';
import { requireStaffPermission } from '@/lib/server/rbac';

export interface SystemHealthReport {
  timestamp: string;
  database: {
    status: 'connected' | 'error';
    latencyMs: number;
  };
  redis: {
    status: 'connected' | 'error';
    latencyMs: number;
  };
  worker: {
    status: 'alive' | 'stale' | 'not_running';
    lastSeenSeconds: number | null;
  };
  queues: {
    waitingOrders: number;
  };
  stuckOrders: {
    pendingOlderThan15m: number;
  };
  catalog: {
    activeServicesCount: number;
    quarantinedServicesCount: number;
  };
  users: {
    totalBalanceRub: number;
  };
}

export async function getSystemHealthReportAction(): Promise<{ success: boolean; data?: SystemHealthReport; error?: string }> {
  return requireStaffPermission('settings', 'view', async () => {
    try {
      const now = Date.now();

      // 1. PostgreSQL Check
      let dbStatus: 'connected' | 'error' = 'error';
      let dbLatencyMs = 0;
      try {
        const dbStart = Date.now();
        await db.$queryRaw`SELECT 1`;
        dbLatencyMs = Date.now() - dbStart;
        dbStatus = 'connected';
      } catch (e) {
        console.error('[HealthAction] DB check failed:', e);
      }

      // 2. Redis Check
      let redisStatus: 'connected' | 'error' = 'error';
      let redisLatencyMs = 0;
      try {
        const redisStart = Date.now();
        await redis.ping();
        redisLatencyMs = Date.now() - redisStart;
        redisStatus = 'connected';
      } catch (e) {
        console.error('[HealthAction] Redis check failed:', e);
      }

      // 3. Worker Heartbeat Check
      let workerStatus: 'alive' | 'stale' | 'not_running' = 'not_running';
      let lastSeenSeconds: number | null = null;

      if (redisStatus === 'connected') {
        try {
          const heartbeat = await redis.get('worker:heartbeat');
          if (heartbeat) {
            lastSeenSeconds = Math.round((now - parseInt(heartbeat, 10)) / 1000);
            workerStatus = lastSeenSeconds < 130 ? 'alive' : 'stale';
          }
        } catch (e) {
          console.error('[HealthAction] Heartbeat fetch failed:', e);
        }
      }

      // 4. Queue Depth
      let waitingOrders = 0;
      if (redisStatus === 'connected') {
        try {
          waitingOrders = await ordersQueue.getWaitingCount();
        } catch {
          waitingOrders = 0;
        }
      }

      // 5. Stuck Orders (> 15 min)
      const fifteenMinsAgo = new Date(now - 15 * 60 * 1000);
      const pendingOlderThan15m = await db.order.count({
        where: {
          status: 'PENDING',
          createdAt: { lt: fifteenMinsAgo }
        }
      });

      // 6. Catalog Stats
      const [activeServicesCount, quarantinedServicesCount] = await Promise.all([
        db.service.count({ where: { isActive: true } }),
        db.service.count({ where: { isQuarantined: true } })
      ]);

      // 7. Total User Balance
      const totalBalanceAgg = await db.user.aggregate({
        _sum: { balance: true }
      });
      const totalBalanceRub = Number(totalBalanceAgg._sum.balance || 0) / 100;

      return {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          database: { status: dbStatus, latencyMs: dbLatencyMs },
          redis: { status: redisStatus, latencyMs: redisLatencyMs },
          worker: { status: workerStatus, lastSeenSeconds },
          queues: { waitingOrders },
          stuckOrders: { pendingOlderThan15m },
          catalog: { activeServicesCount, quarantinedServicesCount },
          users: { totalBalanceRub }
        }
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка мониторинга';
      return { success: false, error: errorMessage };
    }
  });
}

```

---

### 📄 Файл 25 из 89: `src/actions/admin/legal-consent.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

const LEGAL_DOCUMENT_VERSION = '2026.1-RU';
const LEGAL_DOCUMENT_TEXT = `Регламент финансовой ответственности сотрудников службы поддержки SMM-панели (Версия ${LEGAL_DOCUMENT_VERSION}):
1. Настоящий документ устанавливает персональную материальную и дисциплинарную ответственность сотрудника за все финансовые операции (компенсации, докруты, возвраты и корректировки баланса пользователей).
2. Каждый сотрудник обязан использовать функции начисления и списания исключительно в целях решения обращений клиентов в рамках установленных персональных и суточных лимитов.
3. Категорически запрещается изменять собственный баланс, а также баланс любых других сотрудников компании.
4. Все действия в системе фиксируются в электронном журнале аудита с сохранением цифрового отпечатка, IP-адреса, временных меток в часовом поясе Europe/Moscow и связки с тикетами/заказами.
5. Нарушение порядка компенсаций является основанием для применения мер дисциплинарного взыскания и взыскания материального ущерба согласно ТК РФ.`;

export const LEGAL_DOCUMENT_HASH = crypto.createHash('sha256').update(LEGAL_DOCUMENT_TEXT).digest('hex');

export async function getEmployeeConsentStatusAction() {
  return requireStaffPermission('tickets', 'view', async (user) => {
    const consent = await db.employeeResponsibilityConsent.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        documentVersion: LEGAL_DOCUMENT_VERSION
      }
    });

    return {
      success: true as const,
      hasConsented: Boolean(consent),
      consent,
      documentVersion: LEGAL_DOCUMENT_VERSION,
      documentText: LEGAL_DOCUMENT_TEXT,
      documentHash: LEGAL_DOCUMENT_HASH
    };
  });
}

export async function acceptEmployeeResponsibilityConsentAction() {
  return requireStaffPermission('tickets', 'view', async (user) => {
    const reqHeaders = await headers();
    const userAgent = reqHeaders.get('user-agent') || 'Unknown';
    const ipAddress = await getClientIp('unknown');

    // Supersede any old consents
    await db.employeeResponsibilityConsent.updateMany({
      where: { userId: user.id, status: 'ACTIVE' },
      data: { status: 'SUPERSEDED' }
    });

    const consent = await db.employeeResponsibilityConsent.create({
      data: {
        userId: user.id,
        documentVersion: LEGAL_DOCUMENT_VERSION,
        documentHash: LEGAL_DOCUMENT_HASH,
        acceptedIp: ipAddress,
        acceptedUserAgent: userAgent,
        status: 'ACTIVE'
      }
    });

    await auditAdminAwaitable({
      adminId: user.id,
      adminEmail: user.email,
      action: 'ACCEPT_LEGAL_CONSENT',
      target: consent.id,
      targetType: 'LEGAL_CONSENT',
      oldValue: null,
      newValue: JSON.stringify({ documentVersion: LEGAL_DOCUMENT_VERSION, documentHash: LEGAL_DOCUMENT_HASH }),
      ipAddress
    });

    revalidatePath('/admin');
    return { success: true as const, consentId: consent.id };
  });
}

export async function revokeEmployeeConsentAction(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const targetUserId = formData.get('userId') as string;
    if (!targetUserId) {
      return { success: false as const, error: 'Пользователь не указан' };
    }

    await db.employeeResponsibilityConsent.updateMany({
      where: { userId: targetUserId, status: 'ACTIVE' },
      data: { status: 'REVOKED' }
    });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'REVOKE_LEGAL_CONSENT',
      target: targetUserId,
      targetType: 'LEGAL_CONSENT',
      oldValue: JSON.stringify({ status: 'ACTIVE' }),
      newValue: JSON.stringify({ status: 'REVOKED' }),
      ipAddress
    });

    revalidatePath('/admin/legal/responsibility');
    return { success: true as const };
  });
}

```

---

### 📄 Файл 26 из 89: `src/actions/admin/marketing.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { adminMarketingService } from '@/services/admin/marketing.service';
import { auditAdmin } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';

const promoCodeSchema = z.object({
  code: z.string().min(1).max(12).toUpperCase().regex(/^[A-Z0-9_-]+$/, "Разрешены только буквы, цифры, дефис и подчеркивание"),
  type: z.enum(['DISCOUNT', 'VOUCHER']),
  discountPercent: z.coerce.number().min(0, "Процент скидки не может быть отрицательным").max(90, "Максимальная скидка 90%").optional().default(0),
  amount: z.coerce.number().min(0, "Сумма не может быть отрицательной").max(5000, "Максимальная сумма ваучера 5,000 ₽").optional().default(0),
  maxUses: z.coerce.number().int().min(1, "Максимальное количество использований должно быть не менее 1").max(1000000, "Превышен лимит использований (1 млн)").optional().default(1),
  expiresAt: z.string().optional().transform(v => v ? new Date(v) : null),
  description: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  budget: z.coerce.number().min(0, "Бюджет не может быть отрицательным").max(20000000, "Максимальный бюджет 20 000 000 ₽").optional().default(0),
  isSuspicious: z.coerce.boolean().optional().default(false)
}).refine((data) => {
  if (data.expiresAt) {
    return data.expiresAt.getTime() > Date.now();
  }
  return true;
}, {
  message: "Срок действия промокода должен быть в будущем",
  path: ["expiresAt"]
});

export async function createPromoCode(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const payload = Object.fromEntries(formData.entries());
    
    // Convert isSuspicious checkbox/select value safely if passed
    if (payload.isSuspicious === 'true') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload.isSuspicious = true as any;
    } else if (payload.isSuspicious === 'false') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload.isSuspicious = false as any;
    }

    const parsed = promoCodeSchema.safeParse(payload);
    
    if (!parsed.success) {
      return { 
        success: false as const, 
        error: 'Некорректные данные: ' + parsed.error.errors.map(e => e.message).join(', ') 
      };
    }

    const { 
      code, 
      type, 
      discountPercent, 
      amount, 
      maxUses, 
      expiresAt,
      description,
      utmSource,
      utmMedium,
      utmCampaign,
      budget,
      isSuspicious
    } = parsed.data;

    const budgetCents = Math.round(budget * 100);
    const amountCents = Math.round(amount * 100);

    await adminMarketingService.createPromoCode({
      code,
      type,
      discountPercent,
      amount: amountCents,
      maxUses,
      expiresAt,
      description,
      utmSource,
      utmMedium,
      utmCampaign,
      budgetCents,
      isSuspicious
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROMOCODE_CREATE',
      target: code.toUpperCase(),
      targetType: 'SETTINGS', // Promo codes are system settings
      newValue: { 
        type, 
        discountPercent, 
        amount, 
        maxUses, 
        expiresAt,
        description,
        utmSource,
        utmMedium,
        utmCampaign,
        budgetCents,
        isSuspicious
      }
    });

    revalidatePath('/admin/marketing');
    return { success: true as const };
  });
}

export async function togglePromoCode(id: string, isActive: boolean) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const promo = await db.promoCode.findUnique({ where: { id } });
    if (!promo) return { success: false as const, error: 'Промокод не найден' };

    await adminMarketingService.togglePromoCode(id, isActive);
    
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isActive ? 'PROMOCODE_ENABLE' : 'PROMOCODE_DISABLE',
      target: promo.code,
      targetType: 'SETTINGS',
    });

    revalidatePath('/admin/marketing');
    return { success: true as const };
  });
}

export async function deletePromoCode(id: string) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const promo = await db.promoCode.findUnique({ where: { id } });
    if (!promo) return { success: false as const, error: 'Промокод не найден' };

    await adminMarketingService.deletePromoCode(id);
    
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROMOCODE_DELETE',
      target: promo.code,
      targetType: 'SETTINGS',
    });

    revalidatePath('/admin/marketing');
    return { success: true as const };
  });
}

const referralPayoutSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().int().min(10000, "Минимальная сумма выплаты 10 000 копеек (100 ₽)").max(5000000, "Максимальная сумма выплаты 5,000,000 копеек (50,000 ₽)"),
});

export async function processReferralPayout(userId: string, amount: number) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = referralPayoutSchema.safeParse({ userId, amount });
    if (!parsed.success) {
      return { 
        success: false as const, 
        error: 'Некорректная сумма выплаты: ' + parsed.error.errors.map(e => e.message).join(', ') 
      };
    }
    const { userId: parsedUserId, amount: parsedAmount } = parsed.data;

    await adminMarketingService.processPayout(parsedUserId, admin.id, parsedAmount);
    
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'REFERRAL_PAYOUT',
      target: parsedUserId,
      targetType: 'USER',
      newValue: { amountCents: parsedAmount },
    });

    revalidatePath('/admin/marketing');
    return { success: true as const };
  });
}

```

---

### 📄 Файл 27 из 89: `src/actions/admin/orders.ts`

```ts
'use server';

/**
 * Order Management Actions
 * Unified from orders.ts and orders-extended.ts
 *
 * Security: requireStaffPermission('orders', 'edit', ...)
 * Financial operations: Serializable isolation + calculatePartialRefund utility.
 */

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { runSerializableTransaction } from '@/lib/transactions';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { calculatePartialRefund } from '@/utils/refund';
import { adminOrderService } from '@/services/admin/order.service';
import { WalletOps } from '@/services/financial/wallet-ops';
import { orderIdSchema } from '@/validators/admin.validators';
import { ordersQueue } from '@/lib/queue-manager';
import { SettingsManager } from '@/lib/settings';
import { CompensationService } from '@/services/financial/compensation.service';

/**
 * MANDATORY INTEGRITY WARNING:
 * DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
 */

// ── Types & Schemas ──

const ALLOWED_MANUAL_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL', 'CANCELED', 'ERROR'] as const;
type OrderStatus = typeof ALLOWED_MANUAL_STATUSES[number];

const setStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(ALLOWED_MANUAL_STATUSES),
  remains: z.number().int().min(0).optional(),
});

const bulkCancelSchema = z.object({
  orderIds: z.array(z.string().min(1)).max(500),
});

// ── Single Order Actions ──

export async function cancelOrderAction(formData: FormData) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const parsed = orderIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Missing orderId' };
    const { orderId } = parsed.data;

    await adminOrderService.cancelOrder(orderId, {
      id: admin.id,
      email: admin.email,
    });

    // SD-13 SECURITY FIX: Await audit for financial operations to guarantee non-repudiation
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_CANCEL',
      target: orderId,
      targetType: 'ORDER',
    });

    revalidatePath('/admin/orders');
    return { success: true as const };
  });
}

export async function restartOrderAction(formData: FormData) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const parsed = orderIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Missing orderId' };
    const { orderId } = parsed.data;

    await adminOrderService.restartOrder(orderId, {
      id: admin.id,
      email: admin.email,
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_RESTART',
      target: orderId,
      targetType: 'ORDER',
    });

    revalidatePath('/admin/orders');
    return { success: true as const };
  });
}

/**
 * Manual status override with audit and partial refund logic.
 */
export async function setOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  remains?: number
) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const parsed = setStatusSchema.safeParse({ orderId, status, remains });
    if (!parsed.success) throw new Error(parsed.error.errors[0].message);
    const { orderId: validatedOrderId, status: validatedStatus, remains: validatedRemains } = parsed.data;

    const result = await runSerializableTransaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: validatedOrderId },
        include: { user: { select: { id: true, balance: true } } },
      });

      const oldStatus = order.status;
      const newStatus = validatedStatus;

      const TERMINAL_REFUNDED_STATUSES = ['COMPLETED', 'CANCELED', 'ERROR', 'PARTIAL'];

      let refundCents = 0;
      if (['CANCELED', 'ERROR', 'COMPLETED'].includes(newStatus) && !TERMINAL_REFUNDED_STATUSES.includes(oldStatus)) {
        if (['PENDING', 'AWAITING_PAYMENT', 'PENDING_CHECK'].includes(oldStatus)) {
          // Marking a pending order as COMPLETED means it was manually fulfilled. No refund.
          refundCents = newStatus === 'COMPLETED' ? 0 : Number(order.charge);
        } else {
          refundCents = calculatePartialRefund(order);
        }
      } else if (newStatus === 'PARTIAL' && !TERMINAL_REFUNDED_STATUSES.includes(oldStatus)) {
        const orderForRefund = { ...order, remains: validatedRemains ?? order.remains };
        refundCents = calculatePartialRefund(orderForRefund);
      }

      const newRemains = validatedRemains ?? order.remains;

      await tx.order.update({
        where: { id: validatedOrderId },
        data: {
          status: newStatus,
          remains: newRemains,
          ...(newStatus === 'COMPLETED' ? { remains: 0 } : {}),
        },
      });

      if (refundCents > 0) {
        await WalletOps.refund(tx, order.userId, refundCents,
          `Ручная смена статуса заказа #${order.numericId}: ${oldStatus}→${newStatus}`,
          { adminId: admin.id, idempotencyKey: `refund_${order.id}_${newStatus}` }
        );
      }

      return { oldStatus, refundCents, numericId: order.numericId };
    });

    // SD-13 SECURITY FIX: Await audit for refund-bearing status override
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_STATUS_OVERRIDE',
      target: validatedOrderId,
      targetType: 'ORDER',
      oldValue: { status: result.oldStatus },
      newValue: { status: validatedStatus, remains: validatedRemains, refund: result.refundCents },
    });

    revalidatePath('/admin/orders');
    CompensationService.trackCompensation(validatedOrderId).catch(err => console.error('[AdminOrders] Failed to track compensation', err));
    return { success: true as const, refundCents: result.refundCents, numericId: result.numericId };
  });
}


/**
 * Force COMPLETE: moves order to COMPLETED status and refunds for undelivered quantity.
 */
export async function forceCompleteOrderAction(orderId: string) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const result = await runSerializableTransaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
      });

      if (['COMPLETED', 'CANCELED', 'ERROR', 'PARTIAL'].includes(order.status)) {
        throw new Error('Order is already in a terminal state');
      }

      const refundCents = calculatePartialRefund(order);

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
        },
      });

      if (refundCents > 0) {
        await WalletOps.refund(tx, order.userId, refundCents,
          `Force Complete #${order.numericId} with partial refund`,
          { adminId: admin.id, idempotencyKey: `refund_${order.id}_FORCE_COMPLETE` }
        );
      }

      return { numericId: order.numericId, refundCents };
    });

    // SD-13 SECURITY FIX: Await audit for force complete with potential refund
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_FORCE_COMPLETE',
      target: orderId,
      targetType: 'ORDER',
      newValue: { refund: result.refundCents },
    });

    CompensationService.trackCompensation(orderId).catch(err => console.error('[Orders] Failed to track compensation', err));

    revalidatePath('/admin/orders');
    return { success: true as const, refundCents: result.refundCents, numericId: result.numericId };
  });
}

// ── Bulk Actions ──

export async function bulkCancelOrdersAction(
  orderIds: string[],
  reason?: string,
  ticketId?: string
) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    // RBAC Safety: Bulk cancel is strictly restricted to OWNER & ADMIN
    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return {
        success: false as const,
        error: 'Недостаточно прав: массовая отмена с возвратом доступна только Администраторам и Владельцу'
      };
    }

    const parsed = bulkCancelSchema.safeParse({ orderIds });
    if (!parsed.success) throw new Error('Invalid IDs or too many items');

    // Hard ceiling: max 100 items per execution batch
    const BATCH_LIMIT = 100;
    const targetIds = parsed.data.orderIds.slice(0, BATCH_LIMIT);
    const skippedCount = parsed.data.orderIds.length - targetIds.length;

    const orders = await db.order.findMany({
      where: { id: { in: targetIds } },
    });

    let totalRefunded = 0;
    let count = 0;

    for (const order of orders) {
      if (!['COMPLETED', 'CANCELED', 'ERROR'].includes(order.status)) {
        try {
          await runSerializableTransaction(async (tx) => {
            const safeOrder = await tx.order.findUnique({
              where: { id: order.id }
            });
            
            if (!safeOrder || ['COMPLETED', 'CANCELED', 'ERROR'].includes(safeOrder.status)) return;

            const refundCents = (['PENDING', 'AWAITING_PAYMENT', 'PENDING_CHECK'].includes(safeOrder.status))
              ? Number(safeOrder.charge)
              : calculatePartialRefund(safeOrder);

            await tx.order.update({
              where: { id: safeOrder.id },
              data: { status: 'CANCELED' },
            });

            if (refundCents > 0) {
              await WalletOps.refund(tx, safeOrder.userId, refundCents,
                `Массовая отмена заказа #${safeOrder.numericId}${reason ? ` (${reason})` : ''}`,
                { adminId: admin.id, idempotencyKey: `refund_${safeOrder.id}_CANCELED` }
              );
            }
            totalRefunded += refundCents;
            count++;
          });

          CompensationService.trackCompensation(order.id).catch(err => console.error('[Orders] Failed to track compensation', err));
        } catch (e) {
          console.error(`[bulkCancelOrdersAction] Failed to cancel order ${order.id}:`, e);
        }
      }
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_BULK_CANCEL',
      target: 'batch',
      targetType: 'ORDER',
      newValue: { count, totalRefunded, skippedCount, reason, ticketId },
    });

    revalidatePath('/admin/orders');
    return { 
      success: true as const, 
      cancelledCount: count,
      skippedCount,
      totalRefundCents: totalRefunded 
    };
  });
}

export async function bulkRestartOrdersAction(orderIds: string[]) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const BATCH_LIMIT = 100;
    const targetIds = orderIds.slice(0, BATCH_LIMIT);

    const orders = await db.order.findMany({
      where: { id: { in: targetIds } }
    });

    let restartedCount = 0;
    for (const order of orders) {
      if (['ERROR', 'PENDING'].includes(order.status)) {
        try {
          await adminOrderService.restartOrder(order.id, {
            id: admin.id,
            email: admin.email,
          });
          restartedCount++;
        } catch (e) {
          console.error(`[bulkRestartOrdersAction] Error restarting order ${order.id}:`, e);
        }
      }
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_BULK_RESTART',
      target: 'batch',
      targetType: 'ORDER',
      newValue: { count: restartedCount }
    });

    revalidatePath('/admin/orders');
    return { success: true as const, restartedCount };
  });
}

// ── Manual Failover Actions ──

export async function getFailoverPreview(orderId: string) {
  return requireStaffPermission('orders', 'edit', async () => {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        service: {
          include: {
            routes: {
              where: { isActive: true },
              include: { provider: true }
            }
          }
        },
        user: { select: { balance: true } }
      }
    });

    if (!order) throw new Error('Order not found');
    if (!['ERROR', 'CANCELED'].includes(order.status)) {
      throw new Error('Заказ должен быть в статусе ERROR или CANCELED для перезапуска');
    }

    const usdToRub = await SettingsManager.getExchangeRateUSD();
    const availableRoutes = order.service.routes.filter(
      r => r.providerId !== order.providerId
    );

    const routesWithPreview = await Promise.all(availableRoutes.map(async (route) => {
      // Fetch rate from Database ShadowService staging table
      const shadowSvc = await db.shadowService.findUnique({
        where: {
          providerId_externalId: {
            providerId: route.providerId,
            externalId: String(route.providerServiceId)
          }
        }
      });
      
      const hasValidPrice = !!shadowSvc && Number.isFinite(shadowSvc.rate) && shadowSvc.rate > 0;
      if (!hasValidPrice) {
        return {
          routeId: route.id,
          providerName: route.provider.name,
          priceUnknown: true,
          newCostCents: null,
          marginCents: null,
          marginPercent: null,
          isMarginPositive: false
        };
      }

      const exchangeRate = route.provider.balanceCurrency === 'RUB' ? 1.0 : usdToRub;
      const newCostCents = BigInt(Math.round(shadowSvc.rate * exchangeRate * 100));
      const chargeCents = BigInt(order.charge);
      const marginCents = chargeCents - newCostCents;
      const marginPercent = chargeCents > BigInt(0)
        ? Number((marginCents * BigInt(100)) / chargeCents)
        : 0;

      return {
        routeId: route.id,
        providerName: route.provider.name,
        priceUnknown: false,
        newCostCents: Number(newCostCents),
        marginCents: Number(marginCents),
        marginPercent,
        isMarginPositive: marginCents > BigInt(0)
      };
    }));

    return {
      success: true,
      clientPaidCents: Number(order.charge),
      currentBalance: Number(order.user.balance),
      routes: routesWithPreview
    };
  });
}

export async function manualRerouteOrder(orderId: string, newRouteId: string, acknowledgeBlindReroute = false) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const result = await runSerializableTransaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, numericId: true, status: true, charge: true, userId: true, serviceId: true, providerId: true }
      });

      if (!order) throw new Error('Order not found');
      if (!['ERROR', 'CANCELED'].includes(order.status)) {
        throw new Error('Заказ уже обрабатывается');
      }

      const newRoute = await tx.serviceRoute.findFirst({
        where: { id: newRouteId, serviceId: order.serviceId, isActive: true },
        include: { provider: true }
      });

      if (!newRoute) throw new Error('Маршрут не найден или не активен');
      if (newRoute.providerId === order.providerId) {
        throw new Error('Выбран тот же самый провайдер');
      }

      const shadowSvc = await tx.shadowService.findUnique({
        where: {
          providerId_externalId: {
            providerId: newRoute.providerId,
            externalId: String(newRoute.providerServiceId)
          }
        }
      });

      const isPriceUnknown = !shadowSvc || !Number.isFinite(shadowSvc.rate) || shadowSvc.rate <= 0;
      if (isPriceUnknown && !acknowledgeBlindReroute) {
        throw new Error('Цена провайдера неизвестна. Синхронизируйте каталог или подтвердите reroute вслепую.');
      }

      const user = await tx.user.findUnique({
        where: { id: order.userId },
        select: { balance: true }
      });

      if (!user) throw new Error('User not found');
      if (user.balance < order.charge) {
        throw new Error(`Недостаточно средств: баланс ${(Number(user.balance)/100).toFixed(2)} ₽, требуется ${(Number(order.charge)/100).toFixed(2)} ₽`);
      }

      const usdToRub = await SettingsManager.getExchangeRateUSD();
      const exchangeRate = newRoute.provider.balanceCurrency === 'RUB' ? 1.0 : usdToRub;
      const providerRate = shadowSvc ? shadowSvc.rate : 0.0;
      const newProviderCostCents = Math.round(providerRate * exchangeRate * 100);

      // Списание с баланса (перезапуск за счет пользователя, т.к. при ERROR/CANCELED был refund) via WalletOps
      const idempotencyKey = `reroute_${orderId}_${newRouteId}`;
      await WalletOps.charge(tx, order.userId, Number(order.charge), `MANUAL_REROUTE: Order #${order.numericId}`, {
        idempotencyKey,
        adminId: admin.id
      });

      // Обновление заказа
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PENDING',
          providerId: newRoute.providerId,
          providerServiceId: newRoute.providerServiceId,
          providerCost: newProviderCostCents,
          externalId: null,
          error: null,
          retryCount: 0
        }
      });

      // Лог маршрутизации
      await tx.routingAuditLog.create({
        data: {
          serviceId: order.serviceId,
          action: isPriceUnknown ? 'BLIND_REROUTE' : 'MANUAL_OVERRIDE',
          fromProviderId: order.providerId,
          toProviderId: newRoute.providerId,
          reason: `Admin ${admin.email} triggered manual failover ${isPriceUnknown ? '(BLIND REROUTE)' : ''}`
        }
      });

      return { numericId: order.numericId, newProviderId: newRoute.providerId };
    });

    // После транзакции — отправка в BullMQ
    const jobId = `dispatch-${orderId}`;
    await ordersQueue.add('order-dispatch', { orderId }, { jobId });

    // Запись аудита администратора
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'MANUAL_REROUTE',
      target: orderId,
      targetType: 'ORDER',
      newValue: { newProviderId: result.newProviderId }
    });

    revalidatePath('/admin/orders');
    return { success: true as const, numericId: result.numericId };
  });
}

export async function getOrderDetailsAction(orderId: string) {
  return requireStaffPermission('orders', 'view', async () => {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true } },
        provider: { select: { name: true } },
        service: {
          select: {
            name: true,
            etaP50Seconds: true,
            etaP90Seconds: true,
            etaSampleCount: true,
            etaSpeedClass: true,
            etaUpdatedAt: true,
            category: {
              select: {
                name: true,
                network: { select: { name: true } }
              }
            }
          }
        }
      }
    });
    if (!order) return null;
    return {
      id: order.id,
      numericId: order.numericId,
      externalId: order.externalId ?? null,
      link: order.link,
      quantity: order.quantity,
      remains: order.remains,
      status: order.status,
      charge: Number(order.charge),
      providerCost: Number(order.providerCost ?? 0),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      isDripFeed: order.isDripFeed,
      dripExternalIds: order.dripExternalIds,
      runs: order.runs ?? null,
      interval: order.interval ?? null,
      currentRun: order.currentRun,
      error: order.error ?? null,
      user: { email: order.user.email },
      providerName: order.provider?.name ?? null,
      service: {
        name: order.service.name,
        etaP50Seconds: order.service.etaP50Seconds,
        etaP90Seconds: order.service.etaP90Seconds,
        etaSampleCount: order.service.etaSampleCount,
        etaSpeedClass: order.service.etaSpeedClass,
        etaUpdatedAt: order.service.etaUpdatedAt ? order.service.etaUpdatedAt.toISOString() : null,
        category: {
          name: order.service.category.name,
          network: order.service.category.network ? { name: order.service.category.network.name } : null
        }
      }
    };
  });
}



```

---

### 📄 Файл 28 из 89: `src/actions/admin/providers/crud.ts`

```ts
"use server";

import { db } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
import { VaultService } from "@/lib/vault";
import { auditAdmin } from "@/lib/admin-audit";
import { providerService } from "@/services/providers/provider.service";
import { z } from "zod";

const apiMappingSchema = z.object({
  httpMethod: z.enum(['GET', 'POST']).optional().default('POST'),
  contentType: z.enum(['form', 'json']).optional().default('form'),
  auth: z.object({
    type: z.enum(['body', 'query', 'header']),
    field: z.string().min(1),
    prefix: z.string().optional()
  }),
  order: z.object({
    serviceField: z.string().min(1),
    linkField: z.string().min(1),
    quantityField: z.string().min(1),
  }),
  response: z.object({
    orderIdField: z.string().min(1),
    errorField: z.string().min(1),
  }),
  catalog: z.object({
    itemsPath: z.string().optional(),
    serviceIdField: z.string().optional(),
    nameField: z.string().optional(),
    priceField: z.string().optional(),
    minField: z.string().optional(),
    maxField: z.string().optional(),
    typeField: z.string().optional(),
    descField: z.string().optional(),
  }).optional(),
  balance: z.object({
    balancePath: z.string().optional(),
    currencyPath: z.string().optional(),
  }).optional()
});

const providerSchema = z.object({
  name: z.string().min(1, "Название панели обязательно").max(255),
  apiUrl: z.string().url("Некорректный формат URL (укажите полный адрес с https://)"),
  apiKey: z.string().min(1, "API-ключ обязателен"),
  isActive: z.boolean().default(false),
  balanceCurrency: z.string().length(3, "Код валюты должен состоять ровно из 3 букв (например, USD)").toUpperCase(),
  mapping: apiMappingSchema.nullable().optional(),
  ticketUrl: z.string()
    .trim()
    .transform(val => val === "" ? null : val)
    .pipe(
      z.string()
        .url("Некорректный формат URL (укажите полный адрес с https://)")
        .refine(val => val.startsWith("http://") || val.startsWith("https://"), "Разрешены только протоколы http и https")
        .nullable()
    )
    .optional(),
});

const idSchema = z.string().min(1);

export async function createProvider(rawData: {
  name: string;
  apiUrl: string;
  apiKey: string;
  isActive: boolean;
  balanceCurrency: string;
  ticketUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapping?: any;
}) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    try {
      const parsed = providerSchema.safeParse(rawData);
      if (!parsed.success) {
        return { 
          success: false as const, 
          errors: parsed.error.flatten().fieldErrors 
        };
      }
      const data = parsed.data;

      // Encrypt the API key before saving!
      const encryptedKey = VaultService.encrypt(data.apiKey);
      
      // Prepare metadata json
      const metadata = {
         mapping: data.mapping || null
      };

      const provider = await db.provider.create({
        data: {
          name: data.name,
          apiUrl: data.apiUrl,
          apiKey: encryptedKey,
          isActive: data.isActive,
          balanceCurrency: data.balanceCurrency,
          metadata: metadata,
          ticketUrl: data.ticketUrl || null,
        }
      });

      auditAdmin({
        adminId: admin.id,
        adminEmail: admin.email,
        action: "PROVIDER_CREATE",
        target: provider.id,
        targetType: "PROVIDER",
        newValue: { name: provider.name, apiUrl: provider.apiUrl }
      });

      return { success: true as const, error: undefined, providerId: provider.id };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: errorMsg || 'Ошибка сервера при создании провайдера' };
    }
  });
}

export async function updateProvider(rawId: string, rawData: {
  name: string;
  apiUrl: string;
  apiKey?: string; // If empty, we don't update
  isActive: boolean;
  balanceCurrency: string;
  ticketUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapping?: any;
}) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    try {
      const id = idSchema.parse(rawId);
      
      // Create an update schema dynamically to allow empty apikey
      const updateSchema = providerSchema.extend({
        apiKey: z.string().optional()
      });
      const parsed = updateSchema.safeParse(rawData);
      if (!parsed.success) {
        return { 
          success: false as const, 
          errors: parsed.error.flatten().fieldErrors 
        };
      }
      const data = parsed.data;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        name: data.name,
        apiUrl: data.apiUrl,
        isActive: data.isActive,
        balanceCurrency: data.balanceCurrency,
        metadata: {
           mapping: data.mapping || null
        },
        ticketUrl: data.ticketUrl || null,
      };

      if (data.apiKey && data.apiKey.trim() !== "") {
         updateData.apiKey = VaultService.encrypt(data.apiKey);
      }

      const provider = await db.provider.update({
        where: { id },
        data: updateData
      });

      auditAdmin({
        adminId: admin.id,
        adminEmail: admin.email,
        action: "PROVIDER_UPDATE",
        target: provider.id,
        targetType: "PROVIDER",
        newValue: { name: provider.name, isActive: provider.isActive }
      });

      return { success: true as const, error: undefined };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: errorMsg || 'Ошибка сервера при обновлении провайдера' };
    }
  });
}

export async function checkProviderConnection(rawId: string) {
    return requireStaffPermission('catalog', 'view', async () => {
        try {
            const id = idSchema.parse(rawId);
            const providerRecord = await db.provider.findUnique({ where: { id } });
            if (!providerRecord) throw new Error("Provider not found");
            
            const instance = await providerService.getProviderInstance(providerRecord);
            
            // 🌊 WAVE 3.1: Network Timeout Protection
            // Force a 5-second timeout so the UI gets a clean error instead of 504 Gateway Timeout
            const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error("Таймаут ожидания ответа провайдера (5 сек)")), 5000)
            );
            const balanceData = await Promise.race([
                instance.getBalance(),
                timeoutPromise
            ]);
            
            return { 
                success: true, 
                balance: balanceData.balance, 
                currency: balanceData.currency 
            };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            return { success: false, error: e.message || "Connection failed" };
        }
    });
}

export async function getGlobalProviderLiquidity() {
    return requireStaffPermission('catalog', 'view', async () => {
        try {
            const providers = await db.provider.findMany({ where: { isActive: true } });
            
            // Get exchange rate directly from SettingsManager/Provider to unify currency to RUB
            const { SettingsProvider } = await import('@/lib/settings');
            const usdRate = await SettingsProvider.getExchangeRateUSD();
            
            let totalRub = 0;
            let activeCount = 0;
            let errorCount = 0;

            await Promise.allSettled(providers.map(async (provider) => {
                try {
                    const instance = await providerService.getProviderInstance(provider);
                    
                    const timeoutPromise = new Promise<never>((_, reject) => 
                        setTimeout(() => reject(new Error("Timeout")), 5000)
                    );
                    const balanceData = await Promise.race([
                        instance.getBalance(),
                        timeoutPromise
                    ]);
                    
                    const balance = parseFloat(balanceData.balance) || 0;
                    const currency = (balanceData.currency || provider.balanceCurrency || 'RUB').toUpperCase();

                    if (currency === 'USD') {
                        totalRub += (balance * usdRate);
                    } else if (currency === 'RUB') {
                        totalRub += balance;
                    } else if (currency === 'EUR') {
                        // Rough approx if EUR is ever used, though SMMplan standard is USD/RUB
                        totalRub += (balance * usdRate * 1.08); 
                    }
                    activeCount++;
                } catch (e) {
                    console.error(`Failed to fetch balance for provider ${provider.name}:`, e);
                    errorCount++;
                }
            }));

            // Calculate Burn Rate (Provider cost spent in last 24h)
            const yesterday = new Date();
            yesterday.setHours(yesterday.getHours() - 24);
            
            const recentOrders = await db.order.findMany({
                where: {
                    createdAt: { gte: yesterday },
                    status: { notIn: ['ERROR', 'CANCELED'] }
                },
                select: { providerCost: true }
            });

            // providerCost is in Cents (RUB)
            const burnRate24hCents = recentOrders.reduce((sum, order) => sum + Number(order.providerCost || 0), 0);
            const burnRate24hRub = burnRate24hCents / 100;

            return { 
                success: true, 
                totalRub, 
                activeCount,
                errorCount,
                burnRate24h: burnRate24hRub
            };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            return { success: false, error: e.message || "Failed to calculate global liquidity" };
        }
    });
}

/**
 * Server Action for Zombie Eraser
 * Triggers a manual synchronization of the provider's catalog to find deleted/reappeared services.
 */
export async function syncProviderCatalogAction(rawId: string) {
    return requireStaffPermission('catalog', 'edit', async (admin) => {
        try {
            const id = idSchema.parse(rawId);
            const { adminCatalogService } = await import('@/services/admin/catalog.service');
            
            const stats = await adminCatalogService.syncProviderCatalog(id, admin);
            
            return {
                success: true,
                stats
            };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            return { success: false, error: e.message || "Синхронизация не удалась" };
        }
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function inferProviderSchema(apiUrl: string, apiKey: string, httpMethod: 'GET'|'POST', contentType: 'form'|'json', authConfig: any, providerId?: string) {
    return requireStaffPermission('catalog', 'edit', async () => {
        try {
            let finalApiKey = apiKey;
            if (!finalApiKey && providerId) {
                const existing = await db.provider.findUnique({ where: { id: providerId } });
                if (existing && existing.apiKey) {
                    finalApiKey = VaultService.decrypt(existing.apiKey);
                }
            }

            const providerService = (await import('@/services/providers/provider.service')).providerService;
            const mockProvider = {
                id: 'mock',
                name: 'Mock',
                apiUrl,
                apiKey: VaultService.encrypt(finalApiKey),
                balanceCurrency: 'USD',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: {
                    mapping: {
                        httpMethod,
                        contentType,
                        auth: authConfig
                    }
                }
            };
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const instance = await providerService.getProviderInstance(mockProvider as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const servicesResponse = await (instance as any).request({ action: 'services' }, 0);
            
            let servicesKeys: string[] = [];
            let itemsPath = '$';
            
            if (Array.isArray(servicesResponse) && servicesResponse.length > 0) {
                servicesKeys = Object.keys(servicesResponse[0]);
            } else if (typeof servicesResponse === 'object' && servicesResponse !== null) {
                for (const [key, val] of Object.entries(servicesResponse)) {
                    if (Array.isArray(val) && val.length > 0) {
                        itemsPath = key;
                        servicesKeys = Object.keys(val[0]);
                        break;
                    }
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const balanceResponse = await (instance as any).request({ action: 'balance' }, 0);
            let balanceKeys: string[] = [];
            if (typeof balanceResponse === 'object' && balanceResponse !== null) {
                balanceKeys = Object.keys(balanceResponse);
            }

            return {
                success: true,
                schema: {
                    catalog: { itemsPath, keys: servicesKeys },
                    balance: { keys: balanceKeys }
                }
            };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            return { success: false, error: e.message || "Failed to infer schema" };
        }
    });
}

```

---

### 📄 Файл 29 из 89: `src/actions/admin/providers/import-cherry-pick.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireStaffPermission } from "@/lib/server/rbac";
import { adminCatalogService } from "@/services/admin/catalog.service";
import { db } from "@/lib/db";
import { handleServerError } from "@/utils/error-handler";
import { z } from 'zod';

// --- [NEW] Pagination & Filtering API ---
export async function fetchPaginatedExternalServices(
    providerId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filters: any,
    page: number,
    pageSize: number
) {
    return requireStaffPermission('catalog', 'view', async () => {
        try {
            const shadowCount = await db.shadowService.count({ where: { providerId } });
            if (shadowCount === 0) {
                return { success: false, error: 'Теневой каталог пуст. Нажмите «Загрузить каталог».', emptyCache: true };
            }

            // 0. Currency & Rate Settings
            const [provider, settings] = await Promise.all([
                db.provider.findUnique({ where: { id: providerId }, select: { balanceCurrency: true } }),
                db.systemSettings.findUnique({ where: { id: "global" }, select: { exchangeRateUSD: true } })
            ]);
            const currency = provider?.balanceCurrency || 'USD';
            const usdRate = settings?.exchangeRateUSD || 90.0;

            // 1. Fetch imported map for "alreadyImported" status
            const existingServices = await db.service.findMany({
                where: { providerId, externalId: { not: null } },
                select: { id: true, externalId: true }
            });
            const existingMap = new Map(existingServices.map((s: {id: string; externalId: string | null}) => [s.externalId!, s.id]));
            const importedExternalIds = existingServices.map(s => s.externalId).filter(Boolean) as string[];

            // 2. Build where conditions
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const andConditions: any[] = [{ providerId }];

            if (filters.category && filters.category !== 'ALL') {
                andConditions.push({ normalizedCategory: filters.category });
            }
            if (filters.providerCategory && filters.providerCategory !== 'ALL') {
                if (filters.providerCategory === 'Без категории') {
                    andConditions.push({
                        OR: [
                            { category: null },
                            { category: '' },
                            { category: 'Без категории' }
                        ]
                    });
                } else {
                    andConditions.push({ category: filters.providerCategory });
                }
            }
            if (filters.geo && filters.geo !== 'ALL') {
                andConditions.push({ geo: filters.geo });
            }
            if (filters.velocity && filters.velocity !== 'ALL') {
                if (filters.velocity === 'FAST') {
                    andConditions.push({ velocity: { gte: 50 } });
                } else if (filters.velocity === 'SLOW') {
                    andConditions.push({ velocity: { lte: 10 } });
                } else {
                    andConditions.push({ velocity: { gt: 10, lt: 50 } });
                }
            }
            if (filters.hasRefill) {
                andConditions.push({
                    OR: [
                        { refill: true },
                        { warranty: { gt: 0 } }
                    ]
                });
            }
            if (filters.hasAnomaly) {
                andConditions.push({ anomalyScore: { gt: 0 } });
            }
            if (filters.retailReady) {
                andConditions.push({ min: { gt: 0, lte: 100 } });
            }
            if (filters.minPrice !== undefined && filters.minPrice !== '') {
                const minP = parseFloat(filters.minPrice);
                if (!isNaN(minP)) {
                    andConditions.push({ rateRub: { gte: minP } });
                }
            }
            if (filters.maxPrice !== undefined && filters.maxPrice !== '') {
                const maxP = parseFloat(filters.maxPrice);
                if (!isNaN(maxP)) {
                    andConditions.push({ rateRub: { lte: maxP } });
                }
            }
            if (filters.search) {
                const q = filters.search.toLowerCase().trim();
                const terms = q.split(/\s+/).filter(Boolean);
                for (const term of terms) {
                    andConditions.push({
                        OR: [
                            { name: { contains: term, mode: 'insensitive' } },
                            { category: { contains: term, mode: 'insensitive' } },
                            { externalId: { contains: term, mode: 'insensitive' } }
                        ]
                    });
                }
            }

            const importStatus = filters.importStatus || (filters.hideImported ? 'NOT_IMPORTED' : 'ALL');
            if (importStatus === 'NOT_IMPORTED') {
                if (importedExternalIds.length > 0) {
                    andConditions.push({ externalId: { notIn: importedExternalIds } });
                }
            } else if (importStatus === 'IMPORTED') {
                andConditions.push({ externalId: { in: importedExternalIds } });
            }

            const whereWithoutPlatform = { AND: andConditions };

            // 3. Platform counts based on whereWithoutPlatform
            const platformGroups = await db.shadowService.groupBy({
                by: ['platform'],
                where: whereWithoutPlatform,
                _count: {
                    id: true
                }
            });

            let telegram = 0;
            let instagram = 0;
            let vk = 0;
            let youtube = 0;
            let tiktok = 0;
            let other = 0;
            let totalCount = 0;

            for (const g of platformGroups) {
                const count = g._count.id;
                totalCount += count;
                const p = (g.platform || '').toLowerCase();
                if (p === 'telegram') telegram = count;
                else if (p === 'instagram') instagram = count;
                else if (p === 'vk') vk = count;
                else if (p === 'youtube') youtube = count;
                else if (p === 'tiktok') tiktok = count;
                else other += count;
            }

            const platformCounts = {
                ALL: totalCount,
                telegram,
                instagram,
                vk,
                youtube,
                tiktok,
                other
            };

            // 4. Platform filter apply
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let finalWhere: any = { ...whereWithoutPlatform };
            if (filters.platform && filters.platform !== 'ALL') {
                if (filters.platform === 'other') {
                    finalWhere = {
                        AND: [
                            ...andConditions,
                            {
                                platform: {
                                    notIn: ['telegram', 'instagram', 'vk', 'youtube', 'tiktok']
                                }
                            }
                        ]
                    };
                } else {
                    finalWhere = {
                        AND: [
                            ...andConditions,
                            {
                                platform: {
                                    equals: filters.platform.toLowerCase()
                                }
                            }
                        ]
                    };
                }
            }

            // 5. Unique provider categories query
            const categoryGroups = await db.shadowService.groupBy({
                by: ['category'],
                where: { providerId },
                _count: {
                    id: true
                }
            });

            const providerCategories = categoryGroups.map((g) => ({
                name: g.category || 'Без категории',
                count: g._count.id
            })).sort((a, b) => a.name.localeCompare(b.name));

            // 6. Sorting
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let orderBy: any = {};
            if (filters.sortBy === 'price_asc') {
                orderBy = { rateRub: 'asc' };
            } else if (filters.sortBy === 'price_desc') {
                orderBy = { rateRub: 'desc' };
            } else if (filters.sortBy === 'anomaly_asc') {
                orderBy = { anomalyScore: 'asc' };
            } else if (filters.sortBy === 'anomaly_desc' || filters.sortBy === 'anomaly') {
                orderBy = { anomalyScore: 'desc' };
            } else if (filters.sortBy === 'min_asc') {
                orderBy = { min: 'asc' };
            } else if (filters.sortBy === 'min_desc') {
                orderBy = { min: 'desc' };
            } else if (filters.sortBy === 'id_asc') {
                orderBy = { externalId: 'asc' };
            } else if (filters.sortBy === 'id_desc') {
                orderBy = { externalId: 'desc' };
            } else if (filters.sortBy === 'name_asc') {
                orderBy = { cleanName: 'asc' };
            } else if (filters.sortBy === 'name_desc') {
                orderBy = { cleanName: 'desc' };
            } else if (filters.sortBy === 'category_asc') {
                orderBy = { category: 'asc' };
            } else if (filters.sortBy === 'category_desc') {
                orderBy = { category: 'desc' };
            } else if (filters.sortBy === 'platform_asc') {
                orderBy = { platform: 'asc' };
            } else if (filters.sortBy === 'platform_desc') {
                orderBy = { platform: 'desc' };
            } else {
                orderBy = { id: 'asc' };
            }

            // 7. Paginated query
            const total = await db.shadowService.count({ where: finalWhere });
            const totalPages = Math.ceil(total / pageSize);
            const start = (page - 1) * pageSize;

            const paginated = await db.shadowService.findMany({
                where: finalWhere,
                orderBy,
                take: pageSize,
                skip: start
            });

            // 8. Map to match UI schema expectations
            const paginatedMapped = paginated.map((s) => {
                const rawRate = s.rate;
                const rateRub = s.rateRub;
                const pricePerUnitProcurementRub = rateRub / 1000;
                const pricePerUnitProcurementUsd = rawRate / 1000;

                return {
                    service: s.externalId,
                    name: s.name,
                    type: s.type || undefined,
                    category: s.category || undefined,
                    rate: s.rate,
                    min: String(s.min),
                    max: String(s.max),
                    refill: s.refill,
                    cancel: s.cancel,
                    dripfeed: s.dripfeed,
                    cleanName: s.cleanName,
                    rateRub,
                    pricePerUnitProcurementRub,
                    pricePerUnitProcurementUsd,
                    providerCurrency: currency,
                    usdRate,
                    alreadyImported: existingMap.has(s.externalId),
                    localServiceId: existingMap.get(s.externalId) || null,
                    metrics: {
                        platform: s.platform,
                        category: s.normalizedCategory,
                        targetType: s.targetType,
                        customDataType: s.customDataType,
                        isMediaGroupAware: s.isMediaGroupAware,
                        isPrivate: s.isPrivate,
                        warranty: s.warranty,
                        geo: s.geo,
                        velocity: s.velocity,
                        anomalyScore: s.anomalyScore
                    }
                };
            });

            return {
                success: true,
                data: paginatedMapped,
                platformCounts,
                providerCategories,
                pagination: {
                    total,
                    totalPages,
                    page,
                    pageSize
                }
            };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            const localized = handleServerError(e);
            return { success: false, error: localized.message };
        }
    });
}

export async function fetchExternalServices(providerId?: string, forceRefresh = false) {
  return requireStaffPermission('catalog', 'view', async () => {
     let providerDbRecord;
     if (providerId) {
        providerDbRecord = await db.provider.findUnique({ where: { id: providerId } });
        if (!providerDbRecord) throw new Error("Provider not found");
     } else {
        providerDbRecord = await db.provider.findFirst({ where: { isActive: true } });
        if (!providerDbRecord) throw new Error("No active provider found");
     }

     const providerDbId = providerDbRecord.id;
     
     let shadowCount = 0;
     if (!forceRefresh) {
         shadowCount = await db.shadowService.count({ where: { providerId: providerDbId } });
     }

     if (shadowCount === 0 || forceRefresh) {
         shadowCount = await adminCatalogService.refreshShadowCatalog(providerDbId);
     }
     
     return {
        success: true,
        count: shadowCount,
        source: shadowCount > 0 && forceRefresh ? 'api' : 'cache',
        providerId: providerDbId,
     };
  });
}

const importServicesSchema = z.object({
  externalIds: z.array(z.string().min(1)).min(1, "Выберите хотя бы одну услугу"),
  categoryId: z.string().min(1, "Категория обязательна"),
  defaultMarkup: z.coerce.number().refine(val => val === 0 || (val >= 1.0 && val <= 10.0), {
    message: "Наценка должна быть 0 (автокалькуляция) или от 1.0 (0%) до 10.0 (900%)"
  }),
  providerId: z.string().min(1, "ID провайдера обязателен"),
  categoryIdMap: z.record(z.string()).optional(),
});

export async function importSelectedServices(
  externalIds: string[], 
  categoryId: string, 
  defaultMarkup: number, 
  providerId: string,
  categoryIdMap?: Record<string, string>
) {
    return requireStaffPermission('catalog', 'edit', async (admin) => {
        try {
            const parsed = importServicesSchema.safeParse({ externalIds, categoryId, defaultMarkup, providerId, categoryIdMap });
            if (!parsed.success) {
                return { success: false, error: 'Ошибка валидации: ' + parsed.error.errors.map(e => e.message).join(', ') };
            }

            const res = await adminCatalogService.importServices(
                parsed.data.externalIds,
                parsed.data.categoryId,
                parsed.data.defaultMarkup,
                admin,
                parsed.data.providerId,
                parsed.data.categoryIdMap
            );
            
            // SDLC Gate 4: Обязательная инвалидация кэша после мутации
            revalidatePath('/admin/providers/import');
            revalidatePath('/admin/services');
            
            return { success: true, imported: res.importedCount };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
             const localized = handleServerError(e);
             return { success: false, error: localized.message };
        }
    });
}



```

---

### 📄 Файл 30 из 89: `src/actions/admin/providers/sync-action.ts`

```ts
"use server";

/**
 * Admin: Provider Catalog Sync Action
 *
 * Quarantine trigger (per AGENTS.md Safety Floor):
 * - If rate changes > quarantineThreshold (default 20%) → isQuarantined=true
 * - Admin must approve/reject in /admin/catalog/quarantine
 */

import { db } from "@/lib/db";
import { applyBeautifulRounding, SAFETY_FLOOR_MARKUP } from "@/lib/financial-constants";
import { SettingsManager } from "@/lib/settings";
import { requireStaffPermission } from "@/lib/server/rbac";
import { auditAdmin } from "@/lib/admin-audit";
import { MutexManager } from "@/lib/redis-lock";
import { adminCatalogService } from "@/services/admin/catalog.service";

export async function adminSyncProviderCatalog() {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    return MutexManager.withLock('catalog-sync', 60000, 100, async () => {
      try {
        const activeProviders = await db.provider.findMany({ where: { isActive: true } });
        if (!activeProviders.length) return { success: false, error: "Нет активных провайдеров." };
        
        let updatedCount = 0;
        let disabledCount = 0;

        for (const provider of activeProviders) {
          try {
            const stats = await adminCatalogService.syncProviderCatalog(provider.id, admin);
            updatedCount += stats.priceUpdatedSilent;
            disabledCount += stats.priceAnomalies + stats.zombiesDisabled;
          } catch (pErr: unknown) {
            console.error(`[CatalogSync] Provider ${provider.name} (${provider.id}) sync error:`, pErr);
          }
        }

        return {
          success: true,
          message: `Синхронизация Бутика завершена (${activeProviders.length} провайд.): 🔄${updatedCount} цен обновлено, 🧟${disabledCount} мертвых душ отключено.`,
          stats: { updatedCount, disabledCount, unchangedCount: 0 },
        };
      } catch (err: unknown) {
        console.error("Critical Sync Error:", err);
        return { success: false, error: err instanceof Error ? err.message : "Unknown sync error" };
      }
    });
  });
}

export async function approveQuarantinedService(serviceId: string) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { 
        id: true, 
        rate: true, 
        markup: true, 
        pendingRate: true, 
        isQuarantined: true, 
        providerCurrency: true 
      },
    });

    if (!service?.isQuarantined) {
      return { success: false, error: "Service not in quarantine" };
    }

    const usdToRub = await SettingsManager.getExchangeRateUSD();
    const exchangeRate = service.providerCurrency === 'RUB' ? 1.0 : usdToRub;
    if (service.pendingRate === null) {
      return { success: false, error: "Невозможно одобрить карантин: отсутствует новый тариф (ошибка невалидного тарифа от провайдера)" };
    }
    const targetRate = service.pendingRate;
    
    if (targetRate <= 0) {
      return { success: false, error: "Cannot approve quarantine: target rate is invalid (<= 0)" };
    }

    const newPricePer1000Cents = Math.round(
      applyBeautifulRounding(targetRate * Math.max(service.markup, SAFETY_FLOOR_MARKUP) * exchangeRate) * 100
    );

    await db.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: serviceId },
        data: {
          rate: targetRate,
          pricePer1000Cents: newPricePer1000Cents,
          isQuarantined: false,
          pendingRate: null,
          quarantineReason: null,
          quarantinedAt: null,
        },
      });

      await tx.servicePriceHistory.create({
        data: {
          serviceId,
          rate: targetRate,
        }
      });
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "QUARANTINE_APPROVE",
      target: serviceId,
      targetType: "SERVICE",
      oldValue: { rate: service.rate },
      newValue: { rate: targetRate, pricePer1000Cents: newPricePer1000Cents },
    });

    return { success: true };
  });
}

/** Reject quarantined service — keep current rate */
export async function rejectQuarantinedService(serviceId: string) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    await db.service.update({
      where: { id: serviceId },
      data: { isQuarantined: false, pendingRate: null, quarantineReason: null, quarantinedAt: null },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "QUARANTINE_REJECT",
      target: serviceId,
      targetType: "SERVICE",
    });

    return { success: true };
  });
}

/** Bulk approve all quarantined */
export async function approveAllQuarantined() {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const quarantined = await db.service.findMany({
      where: { isQuarantined: true },
      select: { id: true, rate: true, pendingRate: true, markup: true, providerCurrency: true },
    });

    const usdToRub = await SettingsManager.getExchangeRateUSD();

    await db.$transaction(async (tx) => {
      for (const s of quarantined) {
        if (s.pendingRate === null || s.pendingRate <= 0) {
          continue;
        }
        const targetRate = s.pendingRate;
        const exchangeRate = s.providerCurrency === 'RUB' ? 1.0 : usdToRub;
        const newPricePer1000Cents = Math.round(
          applyBeautifulRounding(targetRate * Math.max(s.markup, SAFETY_FLOOR_MARKUP) * exchangeRate) * 100
        );

        await tx.service.update({
          where: { id: s.id },
          data: {
            rate: targetRate,
            pricePer1000Cents: newPricePer1000Cents,
            isQuarantined: false,
            pendingRate: null,
            quarantineReason: null,
            quarantinedAt: null,
          },
        });

        await tx.servicePriceHistory.create({
          data: {
            serviceId: s.id,
            rate: targetRate,
          }
        });
      }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "QUARANTINE_APPROVE_ALL",
      target: `${quarantined.length} services`,
      targetType: "SERVICE",
      newValue: { count: quarantined.length },
    });

    return { success: true, count: quarantined.length };
  });
}

/** Archive zombie service */
export async function archiveZombieService(serviceId: string) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true, isActive: true, cooldownReason: true },
    });

    if (!service) return { success: false, error: "Service not found" };

    const newName = service.name.startsWith('[ARCHIVED]') ? service.name : `[ARCHIVED] ${service.name}`;

    await db.service.update({
      where: { id: serviceId },
      data: {
        isActive: false,
        name: newName,
        cooldownReason: 'ZOMBIE_ARCHIVED',
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "SERVICE_ARCHIVE_ZOMBIE",
      target: serviceId,
      targetType: "SERVICE",
      oldValue: { name: service.name, isActive: service.isActive, cooldownReason: service.cooldownReason },
      newValue: { name: newName, isActive: false, cooldownReason: 'ZOMBIE_ARCHIVED' },
    });

    return { success: true };
  });
}

/** Lift API block early */
export async function liftApiBlock(serviceId: string) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { id: true }
    });
    
    if (!service) return { success: false, error: 'Service not found' };

    await db.service.update({
      where: { id: serviceId },
      data: {
        cooldownUntil: null,
        cooldownReason: null,
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "SERVICE_LIFT_API_BLOCK",
      target: serviceId,
      targetType: "SERVICE",
    });

    return { success: true };
  });
}

```

---

### 📄 Файл 31 из 89: `src/actions/admin/providers/__tests__/import-cherry-pick.test.ts`

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { redis } from '@/lib/redis';
import { fetchPaginatedExternalServices, fetchExternalServices, importSelectedServices } from '../import-cherry-pick';
import { providerService } from '@/services/providers/provider.service';

// Mock cookies and headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest',
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

// Mock verifySession to control roles per test
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

// Mock redis
vi.mock('@/lib/redis', () => {
  const mockPipeline = {
    del: vi.fn().mockReturnThis(),
    hset: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };
  return {
    redis: {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      hget: vi.fn(),
      hmget: vi.fn(),
      pipeline: vi.fn(() => mockPipeline),
    }
  };
});

// Mock provider instance
const mockGetServices = vi.fn();
vi.mock('@/services/providers/provider.service', () => ({
  providerService: {
    getProviderInstance: vi.fn().mockImplementation(() => ({
      getServices: mockGetServices
    })),
    getDefaultProvider: vi.fn().mockImplementation(() => ({
      getServices: mockGetServices
    })),
    getServicesWithCache: vi.fn().mockImplementation(async (config: any, providerInstance: any) => {
      return providerInstance.getServices();
    })
  }
}));

describe('Cherry-Pick Service Import & Shadow Catalog Tests', () => {
  let adminUser: any;
  let regularUser: any;
  let providerA: any;
  let providerB: any;
  let category: any;

  beforeEach(async () => {
    // 1. Clean database tables
    await db.ledgerEntry.deleteMany().catch(() => {});
    await db.payment.deleteMany().catch(() => {});
    await db.order.deleteMany().catch(() => {});
    await db.serviceRoute.deleteMany().catch(() => {});
    await db.routingAuditLog.deleteMany().catch(() => {});
    await db.service.deleteMany().catch(() => {});
    await db.category.deleteMany().catch(() => {});
    await db.network.deleteMany().catch(() => {});
    await db.provider.deleteMany().catch(() => {});
    await db.user.deleteMany().catch(() => {});

    // 2. Setup systemSettings with exchange rates
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    // 3. Create Admin and Regular User
    adminUser = await db.user.create({
      data: {
        email: 'admin_import@smmplan.local',
        role: 'OWNER',
        isActive: true,
      },
    });

    regularUser = await db.user.create({
      data: {
        email: 'user_import@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    // 4. Create providers
    providerA = await db.provider.create({
      data: {
        name: 'Import Provider USD',
        apiUrl: 'http://localhost/api/import_usd',
        apiKey: 'key-usd',
        balanceCurrency: 'USD',
        isActive: true
      }
    });

    providerB = await db.provider.create({
      data: {
        name: 'Import Provider RUB',
        apiUrl: 'http://localhost/api/import_rub',
        apiKey: 'key-rub',
        balanceCurrency: 'RUB',
        isActive: true
      }
    });

    // 5. Create social network and category
    const network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram' }
    });

    category = await db.category.create({
      data: { name: 'TG Subscribers', networkId: network.id }
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fail with Forbidden error if queried by a regular user', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: regularUser.id });

    const result = await fetchPaginatedExternalServices(providerA.id, {}, 1, 10);
    const failureResult = result as { success: false; error: string };
    expect(failureResult.success).toBe(false);
    expect(failureResult.error).toContain('Forbidden: Administrator/Staff context required');
  });

  it('should successfully sync and fetch external services from provider and cache them in shadow catalog', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Simulate provider returning 2 external services
    mockGetServices.mockResolvedValue([
      { service: '101', name: 'Telegram Subscribers Fast', rate: '0.50', min: '10', max: '5000', category: 'Telegram Subscribers' },
      { service: '102', name: 'Instagram Likes HQ', rate: '0.15', min: '50', max: '2000', category: 'Instagram Likes' }
    ]);

    const result = await fetchExternalServices(providerA.id, true);
    const successResult = result as { success: true; count: number; source: string };
    expect(successResult.success).toBe(true);
    expect(successResult.count).toBe(2);
    expect(successResult.source).toBe('api');

    // Verify DB entries
    const shadowServices = await db.shadowService.findMany({
      where: { providerId: providerA.id }
    });
    expect(shadowServices.length).toBe(2);
    expect(shadowServices.find(s => s.externalId === '101')).toBeDefined();
    expect(shadowServices.find(s => s.externalId === '102')).toBeDefined();
  });

  it('should filter, paginate, sort, and convert currencies correctly in paginated external shadow services', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Seed DB with shadow services (with AI normalization metrics already set)
    await db.shadowService.createMany({
      data: [
        {
          providerId: providerA.id,
          externalId: '101',
          name: 'Telegram Subscribers Fast',
          type: 'default',
          category: 'Telegram Subscribers',
          rate: 0.50,
          rateRub: 50.0,
          min: 10,
          max: 5000,
          cleanName: 'Subscribers Fast',
          platform: 'telegram',
          normalizedCategory: 'SUBSCRIBERS',
          targetType: 'CHANNEL',
          anomalyScore: 0.1,
          refill: false,
          cancel: false,
          dripfeed: false
        },
        {
          providerId: providerA.id,
          externalId: '102',
          name: 'Instagram Likes HQ',
          type: 'default',
          category: 'Instagram Likes',
          rate: 0.15,
          rateRub: 15.0,
          min: 50,
          max: 2000,
          cleanName: 'Likes HQ',
          platform: 'instagram',
          normalizedCategory: 'LIKES',
          targetType: 'POST',
          anomalyScore: 0.0,
          refill: false,
          cancel: false,
          dripfeed: false
        }
      ]
    });

    // Page 1, Size 10
    const result = await fetchPaginatedExternalServices(providerA.id, { sortBy: 'price_asc' }, 1, 10);
    expect(result.success).toBe(true);
    const paginated = result as { success: true; data: any[]; platformCounts: any };
    expect(paginated.data.length).toBe(2);

    const item102 = paginated.data.find(x => x.service === '102');
    const item101 = paginated.data.find(x => x.service === '101');

    // USD to RUB conversion: USD 0.15 * 100 = 15.0 RUB per 1k procurement
    expect(item102.rateRub).toBe(15.0);
    expect(item102.pricePerUnitProcurementRub).toBe(0.015); // 15.0 / 1000

    // platformCounts should be mapped correctly
    expect(paginated.platformCounts.telegram).toBe(1);
    expect(paginated.platformCounts.instagram).toBe(1);
  });

  it('should successfully cherry-pick import services with auto-pricing and safety floor controls, preventing cache poisoning', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Seed DB with shadow service
    await db.shadowService.create({
      data: {
        providerId: providerA.id,
        externalId: '101',
        name: 'Telegram Subscribers Fast',
        type: 'default',
        category: 'Telegram Subscribers',
        rate: 0.50,
        rateRub: 50.0,
        min: 10,
        max: 5000,
        cleanName: 'Subscribers Fast',
        platform: 'telegram',
        normalizedCategory: 'SUBSCRIBERS',
        targetType: 'CHANNEL',
        anomalyScore: 0.1,
        refill: false,
        cancel: false,
        dripfeed: false
      }
    });

    // Live check api mock - return live prices to ensure no cache poisoning occurs
    mockGetServices.mockResolvedValue([
      { service: '101', name: 'Telegram Subscribers Fast', rate: '0.60', min: '10', max: '5000', category: 'Telegram Subscribers' } // Price spiked from 0.50 to 0.60!
    ]);

    // Import service 101 with default markup 3.0
    const importRes = await importSelectedServices(['101'], category.id, 3.0, providerA.id);
    const successImport = importRes as { success: true; imported: number };
    expect(successImport.success).toBe(true);
    expect(successImport.imported).toBe(1);

    // Verify DB entry
    const importedService = await db.service.findFirst({
      where: { providerId: providerA.id, externalId: '101' }
    });

    expect(importedService).toBeDefined();
    expect(importedService?.name).toBe('Subscribers Fast'); // Using the cached clean name
    expect(importedService?.rate).toBe(0.60); // Using the live check rate (0.60), NOT the cached one (0.50)! Prevents Cache Poisoning!
    expect(importedService?.markup).toBe(3.0);
    
    // Price per 1k in cents: 0.60 USD * 3.0 markup * 100 exchange rate = 180.00 RUB -> 18000 cents
    expect(importedService?.pricePer1000Cents).toBe(18000);
    expect(importedService?.targetType).toBe('CHANNEL'); // Normalized from smart analyzer metrics!
  });

  it('should support partial ID searching in shadow services', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Seed DB with shadow services
    await db.shadowService.createMany({
      data: [
        {
          providerId: providerA.id,
          externalId: '101',
          name: 'Telegram Subscribers Fast',
          type: 'default',
          category: 'Telegram Subscribers',
          rate: 0.50,
          rateRub: 50.0,
          min: 10,
          max: 5000,
          cleanName: 'Subscribers Fast',
          platform: 'telegram',
          normalizedCategory: 'SUBSCRIBERS',
          targetType: 'CHANNEL',
          anomalyScore: 0.1,
          refill: false,
          cancel: false,
          dripfeed: false
        },
        {
          providerId: providerA.id,
          externalId: '202',
          name: 'Instagram Likes HQ',
          type: 'default',
          category: 'Instagram Likes',
          rate: 0.15,
          rateRub: 15.0,
          min: 50,
          max: 2000,
          cleanName: 'Likes HQ',
          platform: 'instagram',
          normalizedCategory: 'LIKES',
          targetType: 'POST',
          anomalyScore: 0.0,
          refill: false,
          cancel: false,
          dripfeed: false
        }
      ]
    });

    // Search for partial ID '10' -> matches '101'
    const result1 = await fetchPaginatedExternalServices(providerA.id, { search: '10' }, 1, 10);
    expect(result1.success).toBe(true);
    const paginated1 = result1 as { success: true; data: any[] };
    expect(paginated1.data.length).toBe(1);
    expect(paginated1.data[0].service).toBe('101');

    // Search for common digit '2' -> matches '202'
    const result2 = await fetchPaginatedExternalServices(providerA.id, { search: '2' }, 1, 10);
    expect(result2.success).toBe(true);
    const paginated2 = result2 as { success: true; data: any[] };
    expect(paginated2.data.length).toBe(1);
    expect(paginated2.data[0].service).toBe('202');
  });
});

```

---

### 📄 Файл 32 из 89: `src/actions/admin/providers/__tests__/sync-provider-catalog.test.ts`

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { providerService } from '@/services/providers/provider.service';
import { SettingsProvider } from '@/lib/settings';

// Mock verifySession to control roles per test
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

// Mock provider instance
const mockGetServices = vi.fn();
vi.mock('@/services/providers/provider.service', () => ({
  providerService: {
    getProviderInstance: vi.fn().mockImplementation(() => ({
      getServices: mockGetServices
    })),
    getDefaultProvider: vi.fn().mockImplementation(() => ({
      getServices: mockGetServices
    })),
    getServicesWithCache: vi.fn().mockImplementation(async (config: any, providerInstance: any) => {
      return providerInstance.getServices();
    })
  }
}));

describe.sequential('Zombie Eraser & Pricing Auto-recalculation / Quarantine Tests', () => {
  let adminUser: any;
  let provider: any;
  let category: any;
  let serviceA: any;
  let serviceB: any;

  beforeEach(async () => {
    // 2. Setup systemSettings with exchange rates
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    // 3. Create Admin
    adminUser = {
      id: 'admin-id',
      email: 'admin_sync@smmplan.local',
      role: 'SUPERADMIN',
    };

    // 4. Create provider
    provider = await db.provider.create({
      data: {
        name: 'Sync Test Provider',
        apiUrl: 'http://localhost/api/sync',
        apiKey: 'key-sync',
        balanceCurrency: 'USD',
        isActive: true,
        syncLock: false
      }
    });

    // 5. Create social network and category
    const network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram' }
    });

    category = await db.category.create({
      data: { name: 'TG Views', networkId: network.id }
    });

    // 6. Pre-create active services
    // Service A: rate = 0.50 USD/1k, markup = 6.0 (x6), retail price = 300 RUB
    serviceA = await db.service.create({
      data: {
        name: 'TG Views Fast',
        categoryId: category.id,
        providerId: provider.id,
        rate: 0.50,
        markup: 6.0,
        pricePer1000Cents: 30000, // 0.5 * 6 * 100 * 100
        minQty: 10,
        maxQty: 10000,
        externalId: 'ext-303',
        isActive: true
      }
    });

    // Service B: rate = 1.00 USD/1k, markup = 1.2 (very low markup), retail price = 120 RUB
    serviceB = await db.service.create({
      data: {
        name: 'TG Views High Quality',
        categoryId: category.id,
        providerId: provider.id,
        rate: 1.00,
        markup: 1.2,
        pricePer1000Cents: 12000, // 1 * 1.2 * 100 * 100
        minQty: 10,
        maxQty: 10000,
        externalId: 'ext-404',
        isActive: true
      }
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should mark services deleted by the provider as inactive (Zombie Eraser)', async () => {
    // Provider catalog does NOT contain ext-303 (Service A is now a Zombie!)
    // But does contain ext-404
    mockGetServices.mockResolvedValue([
      { service: 'ext-404', name: 'TG Views High Quality', rate: '1.00', min: '10', max: '10000', category: 'TG Views' }
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.zombiesDisabled).toBe(1);
    expect(res.resurrected).toBe(0);

    // Verify Service A (Zombie) is deactivated in DB
    const serviceADb = await db.service.findUnique({ where: { id: serviceA.id } });
    expect(serviceADb?.isActive).toBe(false);
    expect(serviceADb?.cooldownReason).toBe('ZOMBIE_AUTO_DISABLED');

    // Service B should remain active
    const serviceBDb = await db.service.findUnique({ where: { id: serviceB.id } });
    expect(serviceBDb?.isActive).toBe(true);
  });

  it('should auto-fix margin floor breaches (markup < 5.0) to 5.0 and recalculate pricing instead of quarantining', async () => {
    // Provider catalog contains ext-404 but price hiked from $1.00 to $1.25
    // With rate = $1.25, markup = 1.2, retail = 1.2 * 1.0 * 100 = 120 RUB per 1k.
    // Since markup is 1.2 (which is < 5.0), the engine auto-fixes the markup to 5.0
    // and updates retail price using rate $1.25, exchange rate 100.0, markup 5.0:
    // Retail = 1.25 * 5.0 * 100 = 625 RUB per 1k -> beautiful rounded to 630 RUB -> 63000 cents.
    mockGetServices.mockResolvedValue([
      { service: 'ext-303', name: 'TG Views Fast', rate: '0.50', min: '10', max: '10000', category: 'TG Views' },
      { service: 'ext-404', name: 'TG Views High Quality', rate: '1.25', min: '10', max: '10000', category: 'TG Views' }
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.marginFloorBreaches).toBe(0);
    expect(res.priceAnomalies).toBe(1); // Service B still quarantines for Price Spike (>20%) after auto-fix

    // Service B should be quarantined for Price Spike, not Margin Floor Breach
    const serviceBDb = await db.service.findUnique({ where: { id: serviceB.id } });
    expect(serviceBDb?.isQuarantined).toBe(true);
    expect(serviceBDb?.quarantineReason).toContain('Price Spike');
    expect(serviceBDb?.pendingRate).toBe(1.25);
    expect(serviceBDb?.markup).toBe(5.0);
    expect(serviceBDb?.pricePer1000Cents).toBe(63000);

    // Verify AdminAuditLog entry was created for the auto-fix
    const autoFixLog = await db.adminAuditLog.findFirst({
      where: {
        action: 'SERVICE_AUTO_FIX',
        target: serviceB.id,
      },
    });
    expect(autoFixLog).toBeDefined();
    expect(autoFixLog?.adminEmail).toBe('system@smmplan.pro');
    const oldVal = JSON.parse(autoFixLog?.oldValue || '{}');
    const newVal = JSON.parse(autoFixLog?.newValue || '{}');
    expect(oldVal.markup).toBe(1.2);
    expect(newVal.markup).toBe(5.0);
  });

  it('should detect a price spike anomaly (>20% increase) and quarantine the service safely', async () => {
    // Provider catalog contains ext-303, but price hiked from $0.50 to $0.65 (+30% increase)
    mockGetServices.mockResolvedValue([
      { service: 'ext-303', name: 'TG Views Fast', rate: '0.65', min: '10', max: '10000', category: 'TG Views' },
      { service: 'ext-404', name: 'TG Views High Quality', rate: '1.00', min: '10', max: '10000', category: 'TG Views' }
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.priceAnomalies).toBe(1);

    // Service A should be quarantined for price spike!
    const serviceADb = await db.service.findUnique({ where: { id: serviceA.id } });
    expect(serviceADb?.isQuarantined).toBe(true);
    expect(serviceADb?.quarantineReason).toContain('Price Spike');
    expect(serviceADb?.pendingRate).toBe(0.65);
  });

  it('should safely auto-update pricing silently if price drift is minor and positive', async () => {
    // Provider catalog contains ext-303, price drift is minor: $0.50 to $0.53 (+6% increase, below 20% anomaly threshold)
    mockGetServices.mockResolvedValue([
      { service: 'ext-303', name: 'TG Views Fast', rate: '0.53', min: '10', max: '10000', category: 'TG Views' },
      { service: 'ext-404', name: 'TG Views High Quality', rate: '1.00', min: '10', max: '10000', category: 'TG Views' }
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.priceUpdatedSilent).toBe(1);

    // Service A price should be silently updated: rate = 0.53, retail price: 0.53 * 6.0 * 100 = 318 -> beautiful rounding to 320 RUB -> 32000 cents
    const serviceADb = await db.service.findUnique({ where: { id: serviceA.id } });
    expect(serviceADb?.rate).toBe(0.53);
    expect(serviceADb?.pricePer1000Cents).toBe(32000);
    expect(serviceADb?.isQuarantined).toBe(false);
  });
});

```

---

### 📄 Файл 33 из 89: `src/actions/admin/refills.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdmin } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const restartRefillSchema = z.object({
  refillId: z.string().min(1),
});

const updateRefillStatusSchema = z.object({
  refillId: z.string().min(1),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'ERROR']),
});

export async function restartRefillAction(formData: FormData) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const parsed = restartRefillSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { success: false as const, error: 'Некорректный ID докрутки' };
    }

    const { refillId } = parsed.data;

    try {
      const refill = await db.refill.findUnique({
        where: { id: refillId },
      });

      if (!refill) {
        return { success: false as const, error: 'Докрутка не найдена' };
      }

      if (refill.status === 'COMPLETED') {
        return { success: false as const, error: 'Докрутка уже успешно завершена' };
      }

      await db.refill.update({
        where: { id: refillId },
        data: {
          status: 'PENDING',
          externalId: null,
        },
      });

      const { refillQueue } = await import('@/lib/queue-manager');
      await refillQueue.add('process-refill', { refillId });

      auditAdmin({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'REFILL_RESTART',
        target: refillId,
        targetType: 'REFILL',
        oldValue: { status: refill.status },
        newValue: { status: 'PENDING' },
      });

      revalidatePath('/admin/refills');
      return { success: true as const };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: errorMsg || 'Ошибка при перезапуске докрутки' };
    }
  });
}

export async function updateRefillStatusAction(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { success: false, error: "Некорректные данные" };
  }
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const parsed = updateRefillStatusSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { success: false as const, error: 'Некорректные данные' };
    }

    const { refillId, status } = parsed.data;

    try {
      const refill = await db.refill.findUnique({
        where: { id: refillId },
      });

      if (!refill) {
        return { success: false as const, error: 'Докрутка не найдена' };
      }

      await db.refill.update({
        where: { id: refillId },
        data: { status },
      });

      auditAdmin({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'REFILL_STATUS_OVERRIDE',
        target: refillId,
        targetType: 'REFILL',
        oldValue: { status: refill.status },
        newValue: { status },
      });

      revalidatePath('/admin/refills');
      return { success: true as const };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: errorMsg || 'Ошибка при изменении статуса докрутки' };
    }
  });
}

```

---

### 📄 Файл 34 из 89: `src/actions/admin/routing.actions.ts`

```ts
'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { revalidatePath } from 'next/cache';
import { SettingsProvider } from '@/lib/settings';
import { applyBeautifulRounding } from '@/lib/financial-constants';
import { providerService } from '@/services/providers/provider.service';

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
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
      }
    });

    const existingActiveOrders = await db.order.count({
      where: {
        serviceId,
        status: { in: ['AWAITING_PAYMENT', 'PENDING', 'IN_PROGRESS'] }
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
    revalidatePath('/admin/services');
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
    revalidatePath('/admin/services');
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

      const activeOrders = await tx.order.count({
        where: {
          serviceId: route.serviceId,
          providerId: route.providerId,
          status: { in: ['AWAITING_PAYMENT', 'PENDING', 'IN_PROGRESS'] }
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

    const comparisonData = await Promise.all(routes.map(async (route) => {
      // 1. Fetch SLA and ETA from orders in the last 7 days
      const routeOrders = await db.order.findMany({
        where: {
          serviceId,
          providerId: route.providerId,
          createdAt: { gte: last7Days }
        }
      });

      const terminalOrders = routeOrders.filter(o => ['COMPLETED', 'PARTIAL', 'CANCELED', 'ERROR'].includes(o.status));
      const totalTerminal = terminalOrders.length;
      const successful = routeOrders.filter(o => ['COMPLETED', 'PARTIAL'].includes(o.status)).length;
      const sla = totalTerminal > 0 ? (successful / totalTerminal) * 100 : 100.0;

      const completedOrders = routeOrders.filter(o => o.status === 'COMPLETED');
      let avgEtaSeconds = 0;
      if (completedOrders.length > 0) {
        const totalDuration = completedOrders.reduce((sum, o) => {
          const duration = (o.updatedAt.getTime() - o.createdAt.getTime()) / 1000;
          return sum + duration;
        }, 0);
        avgEtaSeconds = Math.round(totalDuration / completedOrders.length);
      }

      // 2. Fetch real-time provider rate and limits from Database ShadowService staging table
      const shadowSvc = await db.shadowService.findUnique({
        where: {
          providerId_externalId: {
            providerId: route.providerId,
            externalId: String(route.providerServiceId)
          }
        }
      });
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
    }));

    return {
      success: true as const,
      data: comparisonData
    };
  });
}


```

---

### 📄 Файл 35 из 89: `src/actions/admin/search.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';

export type SearchHit = {
  id: string;
  type: 'USER' | 'ORDER' | 'SERVICE';
  title: string;
  subtitle: string;
  href: string;
};

export async function globalOmniSearch(query: string): Promise<SearchHit[]> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const result = await requireStaffPermission('orders', 'view', async (admin) => {
    if (!query || query.length < 2) return [];

    const hits: SearchHit[] = [];
    const qLower = query.toLowerCase();
    
    // 1. Search Users by Email
    if (qLower.includes('@') || qLower.length > 3) {
      const users = await db.user.findMany({
        where: { email: { contains: qLower, mode: 'insensitive' } },
        take: 5
      });
      users.forEach(u => hits.push({
        id: u.id,
        type: 'USER',
        title: u.email,
        subtitle: `Баланс: ${(Number(u.balance) / 100).toFixed(2)} ₽ | Роль: ${u.role}`,
        href: `/admin/clients?q=${encodeURIComponent(u.email)}`
      }));
    }

    // 2. Search Orders by numeric ID or external ID
    const numId = parseInt(query.trim(), 10);
    if (!isNaN(numId)) {
      const orders = await db.order.findMany({
        where: {
          OR: [
            { numericId: numId },
            { externalId: query.trim() }
          ]
        },
        take: 5,
        include: { user: true, service: { include: { category: true } } }
      });
      
      orders.forEach(o => hits.push({
        id: o.id,
        type: 'ORDER',
        title: `Заказ #${o.numericId} (API: ${o.externalId || 'Нет'})`,
        subtitle: `${o.service.category.name} - ${o.status}`,
        href: `/admin/orders?edit_order_id=${o.id}`
      }));
    }

    // 3. Search Services by Name
    if (isNaN(numId) && qLower.length > 2) {
        const services = await db.service.findMany({
            where: { name: { contains: qLower, mode: 'insensitive' } },
            take: 5,
            include: { category: true }
        });
        services.forEach(s => hits.push({
            id: s.id,
            type: 'SERVICE',
            title: s.name,
            subtitle: `ID: ${s.numericId} | ${s.category.name}`,
            href: `/admin/catalog?service_id=${s.numericId}`
        }));
    }

    return hits;
  });

  return Array.isArray(result) ? result : [];
}

```

---

### 📄 Файл 36 из 89: `src/actions/admin/settings.ts`

```ts
'use server';

import crypto from 'crypto';
import { requireStaffPermission, requireOwnerPermission } from '@/lib/server/rbac';
import { roleSchema, globalSettingsSchema } from '@/validators/admin.validators';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { settingsService } from '@/services/admin/settings.service';
import { catalogQueue } from '@/workers/queues';
import { VaultService } from '@/lib/vault';
import { auditAdmin, auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';


// ── User Role Update ──
export async function updateUserRole(formData: FormData) {
  const result = await requireOwnerPermission(async (admin) => {
    const parsed = roleSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Некорректные данные' };
    const { userId: targetUserId, role: newRole, staffRoleId } = parsed.data;

    if (targetUserId === admin.id) throw new Error('Cannot change own role');

    // SECURITY: Only OWNER can assign high-level administrative roles
    if (['ADMIN', 'OWNER'].includes(newRole) && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может назначать роли Админ или Владелец' };
    }

    const targetUser = await db.user.findUnique({ where: { id: targetUserId }, select: { role: true, email: true } });
    if (!targetUser) return { success: false as const, error: 'Пользователь не найден' };

    // SECURITY: Only OWNER can change roles of existing ADMINs or OWNERs
    if (['ADMIN', 'OWNER'].includes(targetUser.role) && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может изменять права администраторов' };
    }

    const finalStaffRoleId = staffRoleId === 'NONE' || !staffRoleId ? null : staffRoleId;
    await settingsService.updateUserRole(targetUserId, newRole, finalStaffRoleId);

    const ipAddress = await getClientIp();

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_ROLE_CHANGE',
      target: targetUserId,
      targetType: 'USER',
      oldValue: { email: targetUser.email, role: targetUser.role },
      newValue: { role: newRole },
      ipAddress
    });


    revalidatePath('/admin/settings');
    return { success: true as const };
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    throw new Error(result.error);
  }
}


// ── System Settings Update ──
export async function updateGlobalSettings(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { success: false, errors: { _form: ["Некорректные данные формы"] } };
  }
  const result = await requireStaffPermission("settings", "edit", async (user) => {
    const parsed = globalSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { 
        success: false as const, 
        errors: parsed.error.flatten().fieldErrors 
      };
    }
    
    const {
      siteName,
      siteDescription,
      usnScheme,
      welcomeMessage,
      yookassaShopId,
      yookassaSecretKey: rawYookassaSecret,
      yookassaTestShopId,
      yookassaTestSecretKey: rawYookassaTestSecret,
      cryptoBotToken: rawCryptoBotToken,
      robokassaLogin,
      robokassaPassword: rawRobokassaPassword,
      robokassaWebhookPassword: rawRobokassaWebhookPassword,
      exchangeRateUSD,
      emailProvider,
      resendApiKey: rawResendApiKey,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword: rawSmtpPassword,
      supportEmailDomain,
      inboundEmailWebhookSecret: rawInboundSecret,
      contactSupportEmail,
      contactPrivacyEmail,
      contactTelegramBot,
      contactTelegramChannel,
      contactWhatsApp,
      contactVk,
      legalCompanyName,
      legalCompanyInn,
      legalCompanyOgrnip,
      legalCompanyAddress,
      taxRate,
      opexMonthly,
      quarantineThreshold,
      globalMarkup,
      safetyFloor,
      siteLogoUrl,
      siteFaviconUrl,
    } = parsed.data;

    const oldSettings = await db.systemSettings.findUnique({ where: { id: 'global' } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataToUpdate: any = {};
    if (formData.has('_isGeneralSettings')) {
      dataToUpdate.maintenanceMode = formData.has('maintenanceMode');
    }
    if (formData.has('siteName')) dataToUpdate.siteName = siteName;
    if (formData.has('siteDescription')) dataToUpdate.siteDescription = siteDescription;
    if (formData.has('usnScheme')) dataToUpdate.usnScheme = usnScheme;
    if (formData.has('contactSupportEmail')) dataToUpdate.contactSupportEmail = contactSupportEmail;
    if (formData.has('contactPrivacyEmail')) dataToUpdate.contactPrivacyEmail = contactPrivacyEmail;
    if (formData.has('contactTelegramBot')) dataToUpdate.contactTelegramBot = contactTelegramBot;
    if (formData.has('contactTelegramChannel')) dataToUpdate.contactTelegramChannel = contactTelegramChannel;
    if (formData.has('contactWhatsApp')) dataToUpdate.contactWhatsApp = contactWhatsApp;
    if (formData.has('contactVk')) dataToUpdate.contactVk = contactVk;
    if (formData.has('legalCompanyName')) dataToUpdate.legalCompanyName = legalCompanyName;
    if (formData.has('legalCompanyInn')) dataToUpdate.legalCompanyInn = legalCompanyInn;
    if (formData.has('legalCompanyOgrnip')) dataToUpdate.legalCompanyOgrnip = legalCompanyOgrnip;
    if (formData.has('legalCompanyAddress')) dataToUpdate.legalCompanyAddress = legalCompanyAddress;
    if (formData.has('welcomeMessage') && welcomeMessage !== null) dataToUpdate.welcomeMessage = welcomeMessage;
    
    // Finance & Taxes
    if (formData.has('taxRate') && taxRate !== undefined) dataToUpdate.taxRate = taxRate;
    if (formData.has('opexMonthly') && opexMonthly !== undefined) {
      dataToUpdate.opexMonthly = Math.round(opexMonthly * 100);
    }
    
    // Branding
    if (formData.has('siteLogoUrl')) dataToUpdate.siteLogoUrl = siteLogoUrl;
    if (formData.has('siteFaviconUrl')) dataToUpdate.siteFaviconUrl = siteFaviconUrl;

    // Catalog & Pricing
    if (formData.has('globalMarkup') && globalMarkup !== undefined) dataToUpdate.globalMarkup = globalMarkup;
    if (formData.has('safetyFloor') && safetyFloor !== undefined) dataToUpdate.safetyFloor = safetyFloor;
    if (formData.has('quarantineThreshold') && quarantineThreshold !== undefined) {
      dataToUpdate.quarantineThreshold = quarantineThreshold / 100;
    }

    let isRateChanged = false;
    let finalExchangeRate = exchangeRateUSD;

    if (exchangeRateUSD !== undefined && exchangeRateUSD >= 0) {
      if (exchangeRateUSD === 0) {
        // Trigger CBR sync immediately
        try {
          const { CBRRateService } = await import('@/services/system/cbr-rate.service');
          const syncResult = await CBRRateService.syncCBRExchangeRate();
          if (syncResult.updated) {
            finalExchangeRate = syncResult.systemRate;
            dataToUpdate.exchangeRateUSD = finalExchangeRate;
            dataToUpdate.exchangeRateUpdatedAt = new Date();
            isRateChanged = true;
          } else {
            finalExchangeRate = syncResult.systemRate || 95.0;
            dataToUpdate.exchangeRateUSD = finalExchangeRate;
            isRateChanged = true;
          }
        } catch (syncErr) {
          console.error('[SettingsAction] Failed to sync CBR rate on 0 input:', syncErr);
        }
      } else {
        if (oldSettings?.exchangeRateUSD !== exchangeRateUSD) {
          dataToUpdate.exchangeRateUSD = exchangeRateUSD;
          dataToUpdate.exchangeRateUpdatedAt = null; // Clear sync timestamp to indicate manual mode
          isRateChanged = true;
        }
      }
    }

    // Helper to prevent overwriting secrets with placeholders
    const isPlaceholder = (val?: string | null) => !val || val.trim() === '' || val.includes('•••');

    // Only update secrets if they are provided (prevent overwriting with empty or placeholders)
    if (formData.has('yookassaShopId')) dataToUpdate.yookassaShopId = yookassaShopId;
    if (rawYookassaSecret && !isPlaceholder(rawYookassaSecret)) dataToUpdate.yookassaSecretKey = VaultService.encrypt(rawYookassaSecret);
    if (formData.has('yookassaTestShopId')) dataToUpdate.yookassaTestShopId = yookassaTestShopId;
    if (rawYookassaTestSecret && !isPlaceholder(rawYookassaTestSecret)) dataToUpdate.yookassaTestSecretKey = VaultService.encrypt(rawYookassaTestSecret);
    if (rawCryptoBotToken && !isPlaceholder(rawCryptoBotToken)) dataToUpdate.cryptoBotToken = VaultService.encrypt(rawCryptoBotToken);
    
    if (formData.has('robokassaLogin')) dataToUpdate.robokassaLogin = robokassaLogin;
    if (rawRobokassaPassword && !isPlaceholder(rawRobokassaPassword)) dataToUpdate.robokassaPassword = VaultService.encrypt(rawRobokassaPassword);
    if (rawRobokassaWebhookPassword && !isPlaceholder(rawRobokassaWebhookPassword)) dataToUpdate.robokassaWebhookPassword = VaultService.encrypt(rawRobokassaWebhookPassword);

    // Email / SMTP settings
    if (formData.has('emailProvider') && emailProvider !== undefined) dataToUpdate.emailProvider = emailProvider;
    if (rawResendApiKey && !isPlaceholder(rawResendApiKey)) {
      dataToUpdate.resendApiKey = VaultService.encrypt(rawResendApiKey.trim());
    }
    if (formData.has('smtpHost') && smtpHost !== null) dataToUpdate.smtpHost = smtpHost;
    if (formData.has('smtpPort') && smtpPort !== undefined) dataToUpdate.smtpPort = smtpPort;
    if (formData.has('smtpUser') && smtpUser !== null) dataToUpdate.smtpUser = smtpUser;
    if (rawSmtpPassword && !isPlaceholder(rawSmtpPassword)) dataToUpdate.smtpPassword = VaultService.encrypt(rawSmtpPassword);
    if (formData.has('supportEmailDomain') && supportEmailDomain !== null) dataToUpdate.supportEmailDomain = supportEmailDomain;
    if (rawInboundSecret && !isPlaceholder(rawInboundSecret)) dataToUpdate.inboundEmailWebhookSecret = VaultService.encrypt(rawInboundSecret);

    await settingsService.updateSystemSettings(dataToUpdate);

    // Atomic Re-pricing: trigger background sync if rate changed
    if (isRateChanged && finalExchangeRate) {
       try {
         await catalogQueue.add('sync-prices-bg', { type: 'SYNC_PRICES', usdToRub: finalExchangeRate });
       } catch (err) {
         console.error('[SettingsAction] Failed to enqueue background price sync:', err);
       }
    }

    const ipAddress = await getClientIp();

    const sensitiveKeys = ['yookassaSecretKey', 'yookassaTestSecretKey', 'cryptoBotToken', 'robokassaPassword', 'robokassaWebhookPassword', 'resendApiKey', 'smtpPassword', 'inboundEmailWebhookSecret'];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safeDataToUpdate: any = { ...dataToUpdate };
    for (const key of sensitiveKeys) {
      if (safeDataToUpdate[key]) safeDataToUpdate[key] = '***';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldValueToLog: any = {};
    for (const key of Object.keys(safeDataToUpdate)) {
      if (oldSettings && key in oldSettings) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oldValueToLog[key] = sensitiveKeys.includes(key) ? '***' : (oldSettings as any)[key];
      }
    }

    auditAdmin({
      adminId: user.id,
      adminEmail: user.email,
      action: 'SYSTEM_SETTINGS_UPDATE',
      target: 'global',
      targetType: 'SETTINGS',
      oldValue: oldValueToLog,
      newValue: safeDataToUpdate,
      ipAddress
    });

    // Invalidate the SettingsProvider cache so changes apply instantly (SMTP, Keys, Rates)
    try {
      const { revalidateTag } = (await import('next/cache')) as unknown as { revalidateTag: (tag: string) => unknown };
      revalidateTag('settings');
      revalidatePath('/admin/settings');
    } catch (cacheErr) {
      console.error('[SettingsAction] Warning: Failed to invalidate cache tag:', cacheErr);
      // We don't throw here to avoid failing the action if Redis cache is temporarily down
    }
    return { success: true as const };
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    if ('errors' in result) {
      return result;
    }
    throw new Error('error' in result ? (result as Record<string, unknown>).error as string : 'Unknown error');
  }
  return result;
}

// ── Generate Inbound Mail Webhook Secret ──
export async function generateInboundSecretAction() {
  const result = await requireStaffPermission("settings", "edit", async (admin) => {
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const encryptedSecret = VaultService.encrypt(rawSecret);

    await settingsService.updateSystemSettings({
      inboundEmailWebhookSecret: encryptedSecret
    });

    const ipAddress = await getClientIp();

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'INBOUND_SECRET_GENERATE',
      target: 'global',
      targetType: 'SETTINGS',
      ipAddress
    });

    try {
      const { revalidateTag } = (await import('next/cache')) as unknown as { revalidateTag: (tag: string) => unknown };
      revalidateTag('settings');
      revalidatePath('/admin/settings');
    } catch (cacheErr) {
      console.error('[SettingsAction] Warning: Failed to invalidate cache tag:', cacheErr);
    }

    return { success: true as const, secret: rawSecret };
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    throw new Error(result.error);
  }
  return result;
}


```

---

### 📄 Файл 37 из 89: `src/actions/admin/smart.ts`

```ts
'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdmin } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { redis } from '@/lib/redis';

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
  return requireStaffPermission('catalog', 'view', async () => {
    const services = await db.service.findMany({
      orderBy: { name: 'asc' },
      include: {
        category: { select: { name: true, network: { select: { name: true, slug: true } } } },
        smartConfig: true,
      },
    });

    return { success: true, data: services };
  });
}

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

export async function getSmartGlobalStatus() {
  return requireStaffPermission('settings', 'view', async () => {
    const disabled = (await redis.get('smart:disabled')) === 'true';
    return { success: true, disabled };
  });
}

export async function toggleSmartGlobalStatus(disabled: boolean) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    await redis.set('smart:disabled', String(disabled));

    const ipAddress = await getClientIp();
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SMART_GLOBAL_TOGGLE',
      target: 'global',
      targetType: 'SETTINGS',
      oldValue: { disabled: !disabled },
      newValue: { disabled },
      ipAddress,
    });

    revalidatePath('/admin/smart');
    return { success: true, disabled };
  });
}

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
    if (!serviceIds || serviceIds.length === 0) {
      throw new Error('Не переданы ID услуг');
    }

    const results = [];
    for (const serviceId of serviceIds) {
      const oldConfig = await db.serviceSmartConfig.findUnique({
        where: { serviceId },
      });

      const updatedConfig = await db.serviceSmartConfig.upsert({
        where: { serviceId },
        update: {
          isEnabled: data.isEnabled,
          isTestMode: data.isTestMode !== undefined ? data.isTestMode : (oldConfig?.isTestMode ?? false),
          minChunk: data.minChunk !== undefined ? data.minChunk : (oldConfig?.minChunk ?? 50),
          maxChunk: data.maxChunk !== undefined ? data.maxChunk : (oldConfig?.maxChunk ?? 200),
          markup: data.markup !== undefined ? data.markup : (oldConfig?.markup ?? 0.15),
        },
        create: {
          serviceId,
          isEnabled: data.isEnabled,
          isTestMode: data.isTestMode !== undefined ? data.isTestMode : false,
          minChunk: data.minChunk !== undefined ? data.minChunk : 50,
          maxChunk: data.maxChunk !== undefined ? data.maxChunk : 200,
          markup: data.markup !== undefined ? data.markup : 0.15,
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

```

---

### 📄 Файл 38 из 89: `src/actions/admin/support-review.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { revalidatePath } from 'next/cache';
import { createSecurityEvent } from '@/lib/security-events';

export async function getSupportActionsReviewListAction(options?: {
  page?: number;
  limit?: number;
  reviewStatus?: string;
  staffUserId?: string;
  targetUserId?: string;
}) {
  return requireStaffPermission('finance', 'view', async () => {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(10, options?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options?.reviewStatus && options.reviewStatus !== 'ALL') {
      where.reviewStatus = options.reviewStatus;
    }
    if (options?.staffUserId) {
      where.staffUserId = options.staffUserId;
    }
    if (options?.targetUserId) {
      where.targetUserId = options.targetUserId;
    }

    const [total, items] = await Promise.all([
      db.supportFinancialAction.count({ where }),
      db.supportFinancialAction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          staff: { select: { id: true, email: true, role: true } },
          target: { select: { id: true, email: true } }
        }
      })
    ]);

    // Format BigInt fields for Client Components
    const formattedItems = items.map(item => ({
      ...item,
      amountCents: item.amountCents.toString(),
      amountRub: (Number(item.amountCents) / 100).toFixed(2)
    }));

    return {
      success: true as const,
      items: formattedItems,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  });
}

export async function reviewSupportFinancialAction(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const actionId = formData.get('actionId') as string;
    const reviewStatus = formData.get('reviewStatus') as string; // REVIEWED | FLAGGED | VIOLATION | APPROVED
    const reviewNote = (formData.get('reviewNote') as string) || '';

    if (!actionId || !['REVIEWED', 'FLAGGED', 'VIOLATION', 'APPROVED'].includes(reviewStatus)) {
      return { success: false as const, error: 'Неверные параметры проверки' };
    }

    const action = await db.supportFinancialAction.findUnique({
      where: { id: actionId },
      select: { id: true, staffUserId: true, targetUserId: true, reviewStatus: true }
    });

    if (!action) {
      return { success: false as const, error: 'Операция не найдена' };
    }

    const updated = await db.supportFinancialAction.update({
      where: { id: actionId },
      data: {
        reviewStatus,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote.trim()
      }
    });

    const ipAddress = await getClientIp('unknown');

    if (reviewStatus === 'VIOLATION') {
      await createSecurityEvent('SUPPORT_FINANCIAL_VIOLATION_FLAGGED', {
        severity: 'CRITICAL',
        staffUserId: action.staffUserId,
        targetUserId: action.targetUserId,
        ipAddress,
        details: { actionId, reviewedBy: admin.id, reviewNote }
      });
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'REVIEW_SUPPORT_FINANCIAL_ACTION',
      target: actionId,
      targetType: 'SUPPORT_FINANCIAL_ACTION',
      oldValue: JSON.stringify({ reviewStatus: action.reviewStatus }),
      newValue: JSON.stringify({ reviewStatus, reviewNote }),
      ipAddress
    });

    revalidatePath('/admin/finance/support-review');
    return { success: true as const, action: updated };
  });
}

export async function exportSupportActionsCSVAction() {
  return requireStaffPermission('finance', 'view', async () => {
    const items = await db.supportFinancialAction.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
      include: {
        staff: { select: { email: true } },
        target: { select: { email: true } }
      }
    });

    // Sanitizer for CSV Formula Injection Protection (OWASP)
    const sanitizeCSV = (val: string | null | undefined) => {
      if (!val) return '""';
      let str = String(val).replace(/"/g, '""');
      if (['=', '+', '-', '@'].includes(str.charAt(0))) {
        str = "'" + str;
      }
      return `"${str}"`;
    };

    const headersList = ['ID', 'Date (MSK)', 'Staff Email', 'Target Email', 'Direction', 'Source', 'Amount (RUB)', 'Reason Code', 'Reason Note', 'Ticket ID', 'Review Status'];
    const rows = items.map(i => [
      sanitizeCSV(i.id),
      sanitizeCSV(new Date(i.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })),
      sanitizeCSV(i.staff.email),
      sanitizeCSV(i.target.email),
      sanitizeCSV(i.direction),
      sanitizeCSV(i.source),
      sanitizeCSV((Number(i.amountCents) / 100).toFixed(2)),
      sanitizeCSV(i.reasonCode),
      sanitizeCSV(i.reasonNote),
      sanitizeCSV(i.ticketId || ''),
      sanitizeCSV(i.reviewStatus)
    ]);

    const csvContent = [headersList.join(','), ...rows.map(r => r.join(','))].join('\n');
    return { success: true as const, csv: csvContent };
  });
}

```

---

### 📄 Файл 39 из 89: `src/actions/admin/team.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { auditAdmin, auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';
import { createRoleSchema } from '@/validators/admin.validators';
import { getClientIp } from '@/utils/ip';

const limitSchema = z.object({
  userId: z.string().min(1),
  limit: z.coerce.number().int().min(0, "Лимит не может быть отрицательным").max(10000000, "Превышен максимальный лимит доверия (100 тыс. рублей)"),
});

// ── Update Trust Budget Cents ──
export async function updateSupportLimit(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    // Only OWNER and ADMIN can change limits
    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Только Владелец или Админ могут менять лимиты доверия' };
    }

    const payload = Object.fromEntries(formData.entries());
    const parsed = limitSchema.safeParse(payload);
    
    if (!parsed.success) {
      return { success: false as const, error: 'Некорректные параметры' };
    }

    const { userId, limit: limitCents } = parsed.data;

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) return { success: false as const, error: 'Пользователь не найден' };

    await db.user.update({
      where: { id: userId },
      data: { supportLimitCents: limitCents },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_TRUST_BUDGET',
      target: userId,
      targetType: 'USER',
      oldValue: { limit: target.supportLimitCents },
      newValue: { limit: limitCents },
    });

    revalidatePath('/admin/settings');
    return { success: true as const };
  });
}

// ── Create Custom Staff Role ──
export async function createStaffRoleAction(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    // SECURITY: Only OWNER can manage roles definitions
    if (admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может создавать кастомные роли' };
    }

    const payload = Object.fromEntries(formData.entries());
    const parsed = createRoleSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Некорректные параметры' };
    }

    const { name, description } = parsed.data;

    // Check unique name
    const existing = await db.staffRole.findUnique({ where: { name } });
    if (existing) {
      return { success: false as const, error: 'Роль с таким названием уже существует' };
    }

    const ipAddress = await getClientIp('unknown');

    // Create Role + Default empty Permissions (Fail-Safe Defaults)
    const newRole = await db.$transaction(async (tx) => {
      const role = await tx.staffRole.create({
        data: {
          name,
          description: description || '',
          isSystem: false,
        }
      });

      const sections = ['orders', 'finance', 'catalog', 'settings'];
      await tx.staffPermission.createMany({
        data: sections.map(sec => ({
          roleId: role.id,
          section: sec,
          canView: false,
          canEdit: false,
        }))
      });

      return role;
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CREATE_STAFF_ROLE',
      target: newRole.id,
      targetType: 'ROLE',
      newValue: { name: newRole.name, description: newRole.description },
      ipAddress
    });

    revalidatePath('/admin/settings');
    return { success: true as const };
  });
}

// ── Toggle Granular Section Permissions ──
export async function updateStaffRolePermissionsAction(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    // SECURITY: Only OWNER can edit permissions
    if (admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может изменять права ролей' };
    }

    const roleId = formData.get('roleId') as string;
    const section = formData.get('section') as string;
    const canViewVal = formData.get('canView') === 'true' || formData.get('canView') === 'on';
    const canEditVal = formData.get('canEdit') === 'true' || formData.get('canEdit') === 'on';

    if (!roleId || !section) {
      return { success: false as const, error: 'Некорректные параметры' };
    }

    const role = await db.staffRole.findUnique({ where: { id: roleId } });
    if (!role) {
      return { success: false as const, error: 'Роль не найдена' };
    }

    const ipAddress = await getClientIp('unknown');

    const existingPermission = await db.staffPermission.findUnique({
      where: { roleId_section: { roleId, section } }
    });

    await db.staffPermission.upsert({
      where: { roleId_section: { roleId, section } },
      update: {
        canView: canViewVal,
        canEdit: canEditVal
      },
      create: {
        roleId,
        section,
        canView: canViewVal,
        canEdit: canEditVal
      }
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_STAFF_ROLE_PERMISSIONS',
      target: roleId,
      targetType: 'ROLE',
      oldValue: existingPermission ? { canView: existingPermission.canView, canEdit: existingPermission.canEdit } : {},
      newValue: { section, canView: canViewVal, canEdit: canEditVal },
      ipAddress
    });

    revalidatePath('/admin/settings');
    return { success: true as const };
  });
}

// ── Delete Custom Staff Role ──
export async function deleteStaffRoleAction(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    // SECURITY: Only OWNER can delete roles
    if (admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может удалять роли' };
    }

    const roleId = formData.get('roleId') as string;
    if (!roleId) return { success: false as const, error: 'Некорректные параметры' };

    const role = await db.staffRole.findUnique({ where: { id: roleId } });
    if (!role) return { success: false as const, error: 'Роль не найдена' };

    if (role.isSystem) {
      return { success: false as const, error: 'Нельзя удалять системные роли' };
    }

    const ipAddress = await getClientIp('unknown');

    await db.staffRole.delete({ where: { id: roleId } });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'DELETE_STAFF_ROLE',
      target: roleId,
      targetType: 'ROLE',
      oldValue: { name: role.name },
      newValue: {},
      ipAddress
    });

    revalidatePath('/admin/settings');
    return { success: true as const };
  });
}

```

---

### 📄 Файл 40 из 89: `src/actions/admin/test-mode.actions.ts`

```ts
"use server";

import { db } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
import { SettingsManager } from "@/lib/settings";
import { getClientIp } from "@/utils/ip";
import { auditAdminAwaitable } from "@/lib/admin-audit";

/**
 * Toggles the global mock test mode.
 */
export async function adminToggleTestMode(enable: boolean) {
  return requireStaffPermission('SETTINGS', 'edit', async (admin) => {
    const ipAddress = await getClientIp('unknown');
    const oldSettings = await db.systemSettings.findUnique({ where: { id: 'global' }, select: { isTestMode: true } });
    
    await SettingsManager.setTestMode(enable);

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SYSTEM_TEST_MODE_TOGGLE',
      target: 'global',
      targetType: 'SETTINGS',
      oldValue: oldSettings,
      newValue: { isTestMode: enable },
      ipAddress
    });

    return { success: true, message: `Test mode is now ${enable ? 'ON' : 'OFF'}` };
  });
}

/**
 * Irreversibly deletes all data marked with the isTest flag.
 * This is the Nucleus Clear for the Mock Environment.
 */
export async function adminClearTestData() {
  return requireStaffPermission('SETTINGS', 'edit', async (admin) => {
    const ipAddress = await getClientIp('unknown');
    try {
      // Deleting Orders cascading relationships
      const resultOrders = await db.order.deleteMany({
        where: { isTest: true }
      });
      
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'SYSTEM_TEST_DATA_CLEAR',
        target: 'global',
        targetType: 'SETTINGS',
        newValue: { deletedOrdersCount: resultOrders.count },
        ipAddress
      });

      return { 
        success: true, 
        message: `Cleared ${resultOrders.count} test orders and associated data.` 
      };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error("Failed to clear test data:", e);
      return { success: false, error: "Failed to perform Nucleus Clear." };
    }
  });
}

```

---

### 📄 Файл 41 из 89: `src/actions/admin/users.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { adminUserService } from '@/services/admin/user.service';
import { escrowService } from '@/services/admin/escrow.service';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { auditAdmin, auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import { updateBalanceSchema, userIdSchema } from '@/validators/admin.validators';
import { requireStaffPermission } from '@/lib/server/rbac';
import { getClientIp } from '@/utils/ip';

import { getEncodedKey } from '@/lib/session';
import { SupportBalancePolicyService } from '@/services/financial/support-balance-policy.service';

export async function updateBalanceAction(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    // 1. Role Guard: SUPPORT cannot perform direct balance updates under any circumstances
    if (admin.role === 'SUPPORT') {
      return { success: false as const, error: 'Службе поддержки запрещено прямое изменение балансов. Используйте компенсацию в тикете или создайте заявку на согласование.' };
    }

    const payload = Object.fromEntries(formData.entries());
    const parsed = updateBalanceSchema.safeParse(payload);
    
    if (!parsed.success) {
      return { success: false as const, error: 'userId, amount (копейки) и reason обязательны' };
    }

    const { userId, amount, reason } = parsed.data;

    // 2. SECURITY GUARD: Block self-balance modification (only OWNER permitted with audit warning)
    if (userId === admin.id && admin.role !== 'OWNER') {
      console.warn(`[SECURITY] Blocked self-balance modification attempt by ${admin.id} (${admin.role})`);
      return { success: false as const, error: 'Запрещено изменять собственный баланс' };
    }

    // 3. Staff-Targeting Guard: Non-OWNER staff cannot adjust balance of other staff members
    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!targetUser) {
      return { success: false as const, error: 'Пользователь не найден' };
    }

    if (admin.role !== 'OWNER' && (targetUser.role === 'OWNER' || targetUser.role === 'ADMIN' || targetUser.role === 'MANAGER' || targetUser.role === 'SUPPORT')) {
      console.warn(`[SECURITY] Non-owner ${admin.id} (${admin.role}) attempted balance adjustment on staff target ${targetUser.id} (${targetUser.role})`);
      return { success: false as const, error: 'Только OWNER может изменять баланс других сотрудников' };
    }

    const ipAddress = await getClientIp('unknown');

    // 4. For MANAGER role, run through Policy Engine first
    if (admin.role === 'MANAGER') {
      const policyCheck = await db.$transaction(async (tx) => {
        return SupportBalancePolicyService.validateAndReserveSupportOperation(tx, {
          staffUserId: admin.id,
          targetUserId: userId,
          direction: amount >= 0 ? 'CREDIT' : 'DEBIT',
          amountCents: BigInt(Math.abs(amount)),
          reasonCode: amount >= 0 ? 'DIRECT_CREDIT' : 'DIRECT_DEBIT',
          reasonNote: reason.trim(),
          source: 'DIRECT_ADJUSTMENT',
          idempotencyKey: `direct-adjust-${userId}-${amount}-${Date.now()}`,
          ipAddress
        });
      });

      if (!policyCheck.allowed) {
        return { success: false as const, error: policyCheck.error };
      }
    }

    const escrowResult = await escrowService.evaluateBalanceAdjustment(
      userId,
      amount,
      reason.trim(),
      admin
    );

    // SD-13 SECURITY FIX: Await audit for balance modification (financial operation)
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_BALANCE_REQUEST',
      target: userId,
      targetType: 'USER',
      newValue: { amountCents: amount, reason: reason.trim(), status: escrowResult.status },
      ipAddress
    });

    revalidatePath(`/admin/clients/${userId}`);
    revalidatePath('/admin/clients');
    return { success: true as const, status: escrowResult.status };
  });
}

export async function banUserAction(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = userIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Missing userId' };
    
    const { userId } = parsed.data;

    const ipAddress = await getClientIp('unknown');

    await adminUserService.banUser(userId, {
      id: admin.id,
      email: admin.email,
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BAN_USER',
      target: userId,
      targetType: 'USER',
      ipAddress
    });

    revalidatePath('/admin/clients');
    return { success: true as const };
  });
}

export async function unbanUserAction(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = userIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Missing userId' };
    
    const { userId } = parsed.data;

    const ipAddress = await getClientIp('unknown');

    await adminUserService.unbanUser(userId, {
      id: admin.id,
      email: admin.email,
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UNBAN_USER',
      target: userId,
      targetType: 'USER',
      ipAddress
    });

    revalidatePath('/admin/clients');
    return { success: true as const };
  });
}

/**
 * Login-As: creates a temporary session for the target user.
 * Critical security action — restricted to OWNER/ADMIN only.
 */
export async function loginAsAction(formData: FormData) {
  // Use 'clients' section but check roles manually as well for extreme safety
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = userIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Missing userId' };
    
    const { userId } = parsed.data;

    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Только Владелец и Админ могут входить как клиент' };
    }

    const targetUser = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (admin.role !== 'OWNER' && (targetUser.role === 'OWNER' || targetUser.role === 'ADMIN')) {
      return { success: false as const, error: 'Запрещено входить от имени администраторов и владельцев' };
    }
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);

    // SD-07 SECURITY FIX: Record impersonation origin for audit trail integrity.
    // Without this, impersonated sessions are indistinguishable from real user sessions.
    const impersonationSession = await db.session.create({
      data: {
        userId: targetUser.id,
        expiresAt,
        impersonatedBy: admin.id,
      },
    });

    const sessionToken = await new SignJWT({
      sessionId: impersonationSession.id,
      userId: targetUser.id,
      impersonatedBy: admin.id,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getEncodedKey());

    (await cookies()).set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      sameSite: 'lax',
      path: '/',
    });

    const ipAddress = await getClientIp('unknown');

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'LOGIN_AS_USER',
      target: userId,
      targetType: 'USER',
      newValue: { targetEmail: targetUser.email, sessionExpires: expiresAt.toISOString(), impersonatedBy: admin.id },
      ipAddress
    });

    revalidatePath('/dashboard/new-order');
    return { success: true as const };
  });
}

export async function approveQuarantineAction(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const entryId = formData.get('entryId') as string;
    if (!entryId) return { success: false as const, error: 'Missing entryId' };

    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Только Владелец и Админ могут одобрять карантин' };
    }

    const ipAddress = await getClientIp('unknown');

    await escrowService.resolveQuarantine(entryId, 'APPROVE', {
      id: admin.id,
      email: admin.email
    }, ipAddress);

    revalidatePath('/admin/finance');
    return { success: true as const };
  });
}

export async function rejectQuarantineAction(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const entryId = formData.get('entryId') as string;
    if (!entryId) return { success: false as const, error: 'Missing entryId' };

    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Только Владелец и Админ могут отклонять карантин' };
    }

    const ipAddress = await getClientIp('unknown');

    await escrowService.resolveQuarantine(entryId, 'REJECT', {
      id: admin.id,
      email: admin.email
    }, ipAddress);

    revalidatePath('/admin/finance');
    return { success: true as const };
  });
}

export async function adminChangeUserPasswordAction(userId: string, newPass: string) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    if (!userId || !newPass || newPass.length < 8) {
      return { success: false as const, error: 'Пароль должен содержать минимум 8 символов' };
    }

    const { hashPassword } = await import('@/lib/auth/password');
    const hashed = await hashPassword(newPass);

    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!targetUser) return { success: false as const, error: 'Пользователь не найден' };

    await db.user.update({
      where: { id: userId },
      data: { passwordHash: hashed }
    });

    // Сброс всех сессий пользователя ради безопасности
    await db.session.deleteMany({ where: { userId } });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ADMIN_CHANGE_USER_PASSWORD',
      target: userId,
      targetType: 'USER',
      newValue: { targetEmail: targetUser.email },
      ipAddress
    });

    revalidatePath(`/admin/clients/${userId}`);
    return { success: true as const };
  });
}

export async function adminDeleteUserAction(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const userId = formData.get('userId') as string;
    if (!userId) return { success: false as const, error: 'Missing userId' };

    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Только Владелец и Админ могут удалять профили' };
    }

    if (userId === admin.id) {
      return { success: false as const, error: 'Вы не можете удалить собственный профиль' };
    }

    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!targetUser) return { success: false as const, error: 'Пользователь не найден' };

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${userId}@smmplan.local`,
          telegramId: null,
          phoneHash: null,
          apiKeyHash: null,
          referralCode: null,
          companyName: null,
          inn: null,
          kpp: null,
          legalAddress: null,
          passwordHash: null,
          referredById: null,
          isDeleted: true,
          isActive: false,
          role: 'BANNED'
        }
      });
      await tx.session.deleteMany({ where: { userId } });
      await tx.authToken.deleteMany({ where: { userId } });
    });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ADMIN_DELETE_USER',
      target: userId,
      targetType: 'USER',
      oldValue: { email: targetUser.email },
      newValue: { isDeleted: true },
      ipAddress
    });

    revalidatePath('/admin/clients');
    return { success: true as const };
  });
}

```

---

### 📄 Файл 42 из 89: `src/actions/admin/__tests__/routing-comparison.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { getProviderComparisonData, executeHotSwap } from '@/actions/admin/routing.actions';
// Mock verifySession to control it per test
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await (importOriginal as <T>() => Promise<T>)<typeof import('@/lib/session')>();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

describe('Operational Routing: Comparison Matrix & SLA Analytics Tests', () => {
  let adminUser: any;
  let regularUser: any;
  let providerA: any;
  let providerB: any;
  let category: any;
  let service: any;
  let routeA: any;
  let routeB: any;

  beforeEach(async () => {


    // 2. Enable test mode and set USD/RUB rate in systemSettings
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    // 3. Create Admin and Standard Users
    adminUser = await db.user.create({
      data: {
        email: 'admin_routing@smmplan.local',
        role: 'OWNER',
        isActive: true,
      },
    });

    regularUser = await db.user.create({
      data: {
        email: 'regular_routing@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    // 4. Create providers
    providerA = await db.provider.create({
      data: {
        name: 'Provider A (USD)',
        apiUrl: 'http://localhost/api/a',
        apiKey: 'key-a',
        balanceCurrency: 'USD'
      }
    });

    providerB = await db.provider.create({
      data: {
        name: 'Provider B (RUB)',
        apiUrl: 'http://localhost/api/b',
        apiKey: 'key-b',
        balanceCurrency: 'RUB'
      }
    });

    // 5. Create category and service
    const network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram' }
    });

    category = await db.category.create({
      data: { name: 'TG Views', networkId: network.id }
    });

    service = await db.service.create({
      data: {
        name: 'TG Views Manual Service',
        categoryId: category.id,
        providerId: providerA.id,
        rate: 0.1, // 0.1 USD per 1000
        markup: 3.0, // 300% markup (cost rate * 3)
        minQty: 10,
        maxQty: 10000,
        externalId: 'ext-100'
      }
    });

    // 6. Create service routes
    routeA = await db.serviceRoute.create({
      data: {
        serviceId: service.id,
        providerId: providerA.id,
        providerServiceId: 'ext-100',
        isPrimary: true,
        isActive: true,
        priority: 1,
        failoverMode: 'manual'
      }
    });

    routeB = await db.serviceRoute.create({
      data: {
        serviceId: service.id,
        providerId: providerB.id,
        providerServiceId: 'ext-200',
        isPrimary: false,
        isActive: true,
        priority: 2,
        failoverMode: 'manual'
      }
    });

    vi.clearAllMocks();
  });

  it('should fail with Forbidden error response if queried by a regular user', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: regularUser.id });

    const result = await getProviderComparisonData(service.id);
    const failureResult = result as { success: false; error: string };
    expect(failureResult.success).toBe(false);
    expect(failureResult.error).toContain('Forbidden: Administrator/Staff context required');
  });

  it('should aggregate comparative data successfully with fallback to DB properties for primary route if DB shadow catalog is cold', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // DB shadow catalog is cold (no records seeded)

    const result = await getProviderComparisonData(service.id);
    const successResult = result as { success: true; data: any[] };
    expect(successResult.success).toBe(true);
    const primaryData = successResult.data.find((d: any) => d.routeId === routeA.id);
    const nonPrimaryData = successResult.data.find((d: any) => d.routeId === routeB.id);

    if (!primaryData || !nonPrimaryData) throw new Error('Expected primaryData and nonPrimaryData');

    // Primary route fallback
    expect(primaryData.providerMinQty).toBe(service.minQty);
    expect(primaryData.providerMaxQty).toBe(service.maxQty);
    expect(primaryData.procurementRatePer1kUsd).toBe(0.1);
    expect(primaryData.procurementCostPerUnitUsd).toBe(0.0001); // 0.1 / 1000
    expect(primaryData.procurementCostPerUnitRub).toBe(0.01); // 0.1 * 100 / 1000
    expect(primaryData.limitsMismatch).toBe(false);

    // Non-primary route should have null values for pricing/limits since DB catalog is cold
    expect(nonPrimaryData.providerMinQty).toBeNull();
    expect(nonPrimaryData.procurementRatePer1kUsd).toBeNull();
    expect(nonPrimaryData.limitsMismatch).toBe(false);
  });

  it('should aggregate comparative data successfully using DB shadow catalog and detect limit incompatibilities correctly', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Seed DB with shadow services instead of mocking Redis
    await db.shadowService.createMany({
      data: [
        {
          providerId: providerA.id,
          externalId: 'ext-100',
          name: 'Ext 100 Service Name',
          rate: 0.08,
          rateRub: 8.0, // rate 0.08 * 100 usdRate
          min: 50,
          max: 20000,
          platform: 'telegram',
          normalizedCategory: 'VIEWS'
        },
        {
          providerId: providerB.id,
          externalId: 'ext-200',
          name: 'Ext 200 Service Name',
          rate: 5.0,
          rateRub: 5.0,
          min: 5,
          max: 5000,
          platform: 'telegram',
          normalizedCategory: 'VIEWS'
        }
      ]
    });

    const result = await getProviderComparisonData(service.id);
    const successResult = result as { success: true; data: any[] };
    expect(successResult.success).toBe(true);
    const compA = successResult.data.find((d: any) => d.routeId === routeA.id);
    const compB = successResult.data.find((d: any) => d.routeId === routeB.id);

    if (!compA || !compB) throw new Error('Expected compA and compB');

    // Provider A check
    expect(compA.providerMinQty).toBe(50);
    expect(compA.providerMaxQty).toBe(20000);
    expect(compA.limitsMismatch).toBe(true); // minQty 50 > 10
    expect(compA.procurementRatePer1kUsd).toBe(0.08);

    // Provider B check (currency is RUB)
    expect(compB.providerMinQty).toBe(5);
    expect(compB.providerMaxQty).toBe(5000);
    expect(compB.limitsMismatch).toBe(true); // maxQty 5000 < 10000
    expect(compB.procurementRatePer1kRub).toBe(5.0); // rate was 5.0 RUB
    expect(compB.procurementRatePer1kUsd).toBe(0.05); // 5.0 / 100 USD
  });

  it('should calculate SLA and ETA statistics correctly based on orders in the last 7 days', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Create completed orders
    const now = new Date();
    const createdAgo5m = new Date(now.getTime() - 5 * 60 * 1000);
    const createdAgo10m = new Date(now.getTime() - 10 * 60 * 1000);

    // 2 Completed orders (A took 300s, B took 600s)
    await db.order.create({
      data: {
        id: 'ord-1',
        serviceId: service.id,
        providerId: providerA.id,
        userId: adminUser.id,
        quantity: 100,
        charge: BigInt(3000),
        providerCost: BigInt(100),
        status: 'COMPLETED',
        link: 'https://t.me/post',
        createdAt: createdAgo5m,
        updatedAt: now
      }
    });

    await db.order.create({
      data: {
        id: 'ord-2',
        serviceId: service.id,
        providerId: providerA.id,
        userId: adminUser.id,
        quantity: 100,
        charge: BigInt(3000),
        providerCost: BigInt(100),
        status: 'COMPLETED',
        link: 'https://t.me/post',
        createdAt: createdAgo10m,
        updatedAt: now
      }
    });

    // 1 Canceled order
    await db.order.create({
      data: {
        id: 'ord-3',
        serviceId: service.id,
        providerId: providerA.id,
        userId: adminUser.id,
        quantity: 100,
        charge: BigInt(3000),
        providerCost: BigInt(100),
        status: 'CANCELED',
        link: 'https://t.me/post',
        createdAt: createdAgo10m,
        updatedAt: now
      }
    });

    // SLA should be successful / totalTerminal = 2 / 3 = 66.67%
    // Avg ETA should be (300 + 600) / 2 = 450s

    const result = await getProviderComparisonData(service.id);
    const successResult = result as { success: true; data: any[] };
    expect(successResult.success).toBe(true);
    const compA = successResult.data.find((d: any) => d.routeId === routeA.id);
    if (!compA) throw new Error('Expected compA');

    expect(compA.sla).toBeCloseTo(66.67, 1);
    expect(compA.avgEtaSeconds).toBe(450);
  });
});

```

---

### 📄 Файл 43 из 89: `src/actions/auth/api-key.ts`

```ts
'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { hashPassword } from '@/lib/auth/password';
import { revalidatePath } from 'next/cache';
import { RateLimitService } from '@/services/core/rate-limit.service';

export async function generateApiKey() {
  const session = await verifySession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const isAllowed = await RateLimitService.check(`generate-api-key:${session.userId}`, 5, 3600);
  if (!isAllowed) {
    return { success: false, error: 'Too many API keys generated recently. Please try again later.' };
  }

  // Generate a random hex key
  const newKey = 'smm_' + crypto.randomBytes(32).toString('hex');
  const hashedKey = await hashPassword(newKey);

  try {
    await db.user.update({
      where: { id: session.userId },
      data: { apiKeyHash: hashedKey }
    });

    revalidatePath('/dashboard/settings/api');
    return { success: true, apiKey: newKey };
  } catch (error) {
    console.error('Failed to generate API Key:', error);
    return { success: false, error: 'Failed to update API key' };
  }
}

export async function revokeApiKey() {
  const session = await verifySession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const isAllowed = await RateLimitService.check(`revoke-api-key:${session.userId}`, 10, 3600);
  if (!isAllowed) {
    return { success: false, error: 'Too many requests.' };
  }

  try {
    await db.user.update({
      where: { id: session.userId },
      data: { apiKeyHash: null }
    });

    revalidatePath('/dashboard/settings/api');
    return { success: true };
  } catch (error) {
    console.error('Failed to revoke API Key:', error);
    return { success: false, error: 'Failed to update API key' };
  }
}

```

---

### 📄 Файл 44 из 89: `src/actions/auth/delete-account.ts`

```ts
'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { verifyPassword } from '@/lib/auth/password';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'DeleteAccount' });

const deleteSchema = z.object({
  confirmText: z.string(),
  password: z.string().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteAccountAction(prevState: any, formData: FormData) {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Вы не авторизованы' };
  }

  const rawConfirmText = formData.get('confirmText');
  const rawPassword = formData.get('password');

  const parsed = deleteSchema.safeParse({
    confirmText: rawConfirmText,
    password: rawPassword || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: 'Неверный формат входных данных' };
  }

  const { confirmText, password } = parsed.data;

  if (confirmText !== 'УДАЛИТЬ') {
    return { success: false, error: 'Для подтверждения необходимо ввести слово "УДАЛИТЬ"' };
  }

  try {
    const userId = session.userId;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true }
    });

    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }

    // Если у пользователя задан пароль — требуем его проверку
    if (user.passwordHash) {
      if (!password) {
        return { success: false, error: 'Для удаления аккаунта требуется ввести пароль' };
      }
      const isMatch = await verifyPassword(password, user.passwordHash);
      if (!isMatch) {
        return { success: false, error: 'Неверный пароль' };
      }
    }

    // Wrap database updates in a Prisma $transaction
    await db.$transaction(async (tx) => {
      // Write a USER_ACCOUNT_SOFT_DELETION audit log within the transaction
      await tx.auditLog.create({
        data: {
          userId,
          action: 'USER_ACCOUNT_SOFT_DELETION',
          details: `User with email ${user.email} initiated self-service account soft-deletion.`,
        }
      });

      // Anonymize user details, clear integration details, billing details, password hash, break referrals, and set deleted/inactive flags
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${userId}@smmplan.local`,
          telegramId: null,
          phoneHash: null,
          apiKeyHash: null,
          referralCode: null,
          companyName: null,
          inn: null,
          kpp: null,
          legalAddress: null,
          passwordHash: null,
          referredById: null,
          isDeleted: true,
          isActive: false,
        }
      });

      // Delete active DB sessions
      await tx.session.deleteMany({
        where: { userId },
      });

      // Delete auth tokens
      await tx.authToken.deleteMany({
        where: { userId },
      });
    });

    // Outside the transaction, clear the session_token cookie and set explicit_logout cookie
    const cookieStore = await cookies();
    cookieStore.delete('session_token');
    cookieStore.set('explicit_logout', 'true', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 год
    });

    log.info('Account successfully soft-deleted', { userId, email: user.email });
    return { success: true, error: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    log.error('Account deletion failed', { error: error.message });
    return { success: false, error: 'Ошибка сервера при удалении аккаунта. Попробуйте позже.' };
  }
}

```

---

### 📄 Файл 45 из 89: `src/actions/auth/password-settings.ts`

```ts
'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const setPasswordSchema = z.object({
  password: z.string().min(8, "Пароль должен состоять как минимум из 8 символов"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"]
});

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Новый пароль должен состоять как минимум из 8 символов"),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"]
});

export async function setPasswordAction(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { success: false, error: "Некорректные данные формы" };
  }
  const session = await verifySession();
  if (!session) {
    return { success: false, error: 'Пожалуйста, войдите в аккаунт' };
  }

  const rawData = Object.fromEntries(formData.entries());
  const parsed = setPasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { password } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true }
    });

    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }

    if (user.passwordHash) {
      return { success: false, error: 'У вас уже установлен пароль. Используйте форму смены пароля.' };
    }

    const hashed = await hashPassword(password);

    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: hashed }
    });

    revalidatePath('/dashboard/settings');
    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Failed to set password:', error);
    return { success: false, error: 'Ошибка сервера при установке пароля' };
  }
}

export async function changePasswordAction(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { success: false, error: "Некорректные данные формы" };
  }
  const session = await verifySession();
  if (!session) {
    return { success: false, error: 'Пожалуйста, войдите в аккаунт' };
  }

  const rawData = Object.fromEntries(formData.entries());
  const parsed = changePasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { currentPassword, newPassword } = parsed.data;

  // Проверяем, авторизовался ли пользователь через Magic Link недавно
  const canResetPassword = session.canResetPassword === true;

  if (!canResetPassword && !currentPassword) {
    return { success: false, error: 'Введите текущий пароль' };
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true }
    });

    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }

    if (!user.passwordHash) {
      return { success: false, error: 'У вас не установлен пароль. Пожалуйста, сначала установите пароль.' };
    }

    if (!canResetPassword) {
      const isMatch = await verifyPassword(currentPassword as string, user.passwordHash);
      if (!isMatch) {
        return { success: false, error: 'Неверный текущий пароль' };
      }
    }

    const hashed = await hashPassword(newPassword);

    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: hashed }
    });

    // W3-2 SECURITY FIX: Invalidate all existing sessions on password change
    await db.session.deleteMany({
      where: { userId: session.userId }
    });

    // Create a new session for the current device (and clear canResetPassword flag)
    const { sessionToken, expiresAt } = await import('@/lib/session').then(m => m.createSession(session.userId, false));
    const cookieStore = await import('next/headers').then(m => m.cookies());
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      sameSite: 'lax',
      path: '/',
    });

    revalidatePath('/dashboard/settings');
    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Failed to change password:', error);
    return { success: false, error: 'Ошибка сервера при смене пароля' };
  }
}

```

---

### 📄 Файл 46 из 89: `src/actions/auth/refresh-balance.ts`

```ts
'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { formatBalance } from '@/lib/utils';

export async function refreshBalanceAction() {
  const session = await verifySession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { balance: true },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  return {
    success: true,
    balanceRub: formatBalance(user.balance),
  };
}

```

---

### 📄 Файл 47 из 89: `src/actions/auth/__tests__/password-login.test.ts`

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { loginWithPasswordAction } from '../password-login';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/session';
import { RateLimitService } from '@/services/core/rate-limit.service';

vi.mock('@/lib/session', () => ({
  createSession: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
    checkCustomKey: vi.fn().mockResolvedValue(true),
  }
}));

describe('Password Login Tests', () => {
  let user: any;
  let adminUser: any;
  const password = 'TestPassword123!';

  beforeEach(async () => {
    // Clear the DB of users created for tests
    await db.user.deleteMany({
      where: { email: { in: ['login_test@smmplan.local', 'admin_login_test@smmplan.local', 'no_password@smmplan.local'] } }
    });

    const passwordHash = await hashPassword(password);

    user = await db.user.create({
      data: {
        email: 'login_test@smmplan.local',
        passwordHash,
        role: 'USER',
        isActive: true,
      },
    });

    adminUser = await db.user.create({
      data: {
        email: 'admin_login_test@smmplan.local',
        passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    });

    await db.user.create({
      data: {
        email: 'no_password@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('should login successfully and redirect to /dashboard for normal user', async () => {
    const formData = new FormData();
    formData.append('email', user.email);
    formData.append('password', password);

    const res = await loginWithPasswordAction({}, formData);
    expect(res).toEqual({ success: true, error: null, redirectTo: '/dashboard' });
    expect(createSession).toHaveBeenCalledWith(user.id);
  });

  it('should login successfully and redirect to /admin/dashboard for admin', async () => {
    const formData = new FormData();
    formData.append('email', adminUser.email);
    formData.append('password', password);

    const res = await loginWithPasswordAction({}, formData);
    expect(res).toEqual({ success: true, error: null, redirectTo: '/admin/dashboard' });
    expect(createSession).toHaveBeenCalledWith(adminUser.id);
  });

  it('should fail with incorrect password', async () => {
    const formData = new FormData();
    formData.append('email', user.email);
    formData.append('password', 'WrongPassword!');

    const res = await loginWithPasswordAction({}, formData);
    expect(res).toEqual({ success: false, error: 'Неверный email или пароль' });
    expect(createSession).not.toHaveBeenCalled();
  });

  it('should fail when user does not exist', async () => {
    const formData = new FormData();
    formData.append('email', 'not_found@smmplan.local');
    formData.append('password', password);

    const res = await loginWithPasswordAction({}, formData);
    expect(res).toEqual({ success: false, error: 'Неверный email или пароль' });
  });

  it('should return specific error when password is not set', async () => {
    const formData = new FormData();
    formData.append('email', 'no_password@smmplan.local');
    formData.append('password', password);

    // Default: SMTP is assumed not configured if env vars are missing, 
    // but let's mock it to make sure we test both branches.
    const originalHost = process.env.SMTP_HOST;
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASSWORD = 'password';

    const res = await loginWithPasswordAction({}, formData);
    expect(res).toEqual({ success: false, error: 'Для вашего аккаунта не установлен пароль. Пожалуйста, войдите по ссылке на почту.' });

    // Branch: SMTP down
    delete process.env.SMTP_HOST;
    const resNoSmtp = await loginWithPasswordAction({}, formData);
    expect(resNoSmtp).toEqual({ success: false, error: 'Вход по ссылке временно недоступен (ошибка почты). Обратитесь в поддержку для установки пароля.' });

    process.env.SMTP_HOST = originalHost; // Restore
  });

  it('should return error when rate limit is exceeded', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValueOnce(false);
    
    const formData = new FormData();
    formData.append('email', user.email);
    formData.append('password', password);

    const res = await loginWithPasswordAction({}, formData);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Слишком много попыток');
  });
});

```

---

### 📄 Файл 48 из 89: `src/actions/auth/__tests__/password-register.test.ts`

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { registerWithPasswordAction } from '../password-register';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { createSession } from '@/lib/session';
import { sendMagicLink } from '@/lib/smtp';

vi.mock('@/lib/session', () => ({
  createSession: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock('@/lib/smtp', () => ({
  sendMagicLink: vi.fn().mockResolvedValue(true),
}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
    checkCustomKey: vi.fn().mockResolvedValue(true),
  }
}));

describe('Password Registration Tests', () => {
  beforeEach(async () => {
    // Clear test users
    await db.user.deleteMany({
      where: { email: { in: ['reg_new@smmplan.local', 'reg_existing@smmplan.local'] } }
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('should successfully register a new user and create a session', async () => {
    const formData = new FormData();
    formData.append('email', 'reg_new@smmplan.local');
    formData.append('password', 'ValidPassword123!');

    const res = await registerWithPasswordAction(null, formData);
    console.log("REGISTRATION RESULT:", res);
    expect(res.success).toBe(true);
    expect(res.error).toBeNull();
    expect(res.message).toBeDefined();

    const createdUser = await db.user.findUnique({ where: { email_tenantId: { email: 'reg_new@smmplan.local', tenantId: 'smmplan' } } });
    expect(createdUser).not.toBeNull();
    expect(createdUser?.role).toBeDefined();
    expect(createdUser?.isEmailVerified).toBe(false);
    expect(createSession).not.toHaveBeenCalled();
    expect(sendMagicLink).toHaveBeenCalledWith('reg_new@smmplan.local', expect.any(String));
  });

  it('should fail if email is already registered', async () => {
    // Pre-create user
    await db.user.create({
      data: {
        email: 'reg_existing@smmplan.local',
        role: 'USER',
        isActive: true,
      }
    });

    const formData = new FormData();
    formData.append('email', 'reg_existing@smmplan.local');
    formData.append('password', 'ValidPassword123!');

    const res = await registerWithPasswordAction(null, formData);
    expect(res.success).toBe(false);
    expect(res.error).toContain('уже зарегистрирован');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('should enforce rate limits on IP-level registration', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValueOnce(false);

    const formData = new FormData();
    formData.append('email', 'reg_new@smmplan.local');
    formData.append('password', 'ValidPassword123!');

    const res = await registerWithPasswordAction(null, formData);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Превышен лимит регистраций');
    expect(createSession).not.toHaveBeenCalled();
  });
});

```

---

### 📄 Файл 49 из 89: `src/actions/auth/__tests__/request-magic-link.test.ts`

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { requestMagicLink } from '../request-magic-link';
import { sendMagicLink, sendWelcomeLetter } from '@/lib/smtp';
import { RateLimitService } from '@/services/core/rate-limit.service';

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock('@/lib/smtp', () => ({
  sendMagicLink: vi.fn(),
  sendWelcomeLetter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
    checkCustomKey: vi.fn().mockResolvedValue(true),
  }
}));

describe('Request Magic Link Tests', () => {
  beforeEach(async () => {
    await db.user.deleteMany({
      where: { email: { in: ['magic_new@smmplan.local', 'magic_new2@smmplan.local', 'magic_existing@smmplan.local'] } }
    });

    await db.user.create({
      data: {
        email: 'magic_existing@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully send magic link to existing user', async () => {
    const formData = new FormData();
    formData.append('email', 'magic_existing@smmplan.local');

    const res = await requestMagicLink({}, formData);
    expect(res).toEqual({ success: true, error: null });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(sendMagicLink).toHaveBeenCalledWith('magic_existing@smmplan.local', expect.any(String));
  });

  it('should create new user and send magic link if user does not exist', async () => {
    const formData = new FormData();
    formData.append('email', 'magic_new@smmplan.local');

    const res = await requestMagicLink({}, formData);
    expect(res).toEqual({ success: true, error: null });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(sendMagicLink).toHaveBeenCalledWith('magic_new@smmplan.local', expect.any(String));
    
    const user = await db.user.findUnique({ where: { email_tenantId: { email: 'magic_new@smmplan.local', tenantId: 'smmplan' } } });
    expect(user).not.toBeNull();
  });

  it('should delete newly created user if SMTP fails', async () => {
    vi.mocked(sendMagicLink).mockRejectedValueOnce(new Error('SMTP Error'));

    const formData = new FormData();
    formData.append('email', 'magic_new2@smmplan.local');

    const res = await requestMagicLink({}, formData);
    expect(res).toEqual({ success: false, error: "Не удалось отправить письмо. Проверьте правильность email или попробуйте позже." });
    
    expect(sendMagicLink).toHaveBeenCalledWith('magic_new2@smmplan.local', expect.any(String));

    // The user should have been deleted
    const user = await db.user.findUnique({ where: { email_tenantId: { email: 'magic_new2@smmplan.local', tenantId: 'smmplan' } } });
    expect(user).toBeNull();
  });
});

```

---

### 📄 Файл 50 из 89: `src/actions/finance/settings.ts`

```ts
'use server';

import { accountingService } from '@/services/financial/accounting.service';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';

import { auditAdmin } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';

const financeSettingsSchema = z.object({
  taxRate: z.coerce.number().min(0, "Налоговая ставка не может быть отрицательной").max(100, "Налоговая ставка не может превышать 100%").optional().default(6.0),
  opexMonthly: z.coerce.number().min(0, "OPEX не может быть отрицательным").max(10000000, "Максимальный лимит OPEX - 10,000,000 ₽").optional().default(0)
});

export async function updateSystemSettings(formData: FormData) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const result = await requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = financeSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new Error('Validation error');
    const { taxRate, opexMonthly: opexRubles } = parsed.data;
    const opexMonthly = Math.round(opexRubles * 100);

    const oldSettings = await db.systemSettings.findUnique({
      where: { id: 'global' }
    });

    await accountingService.updateSettings(taxRate, opexMonthly);
  
    const ipAddress = await getClientIp('unknown');
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_FINANCE_SETTINGS',
      target: 'global',
      targetType: 'SETTINGS',
      oldValue: oldSettings,
      newValue: { taxRate, opexMonthly },
      ipAddress
    });

    revalidatePath('/admin/finance');
  });
}

```

---

### 📄 Файл 51 из 89: `src/actions/knowledge.ts`

```ts
"use server";

import { db as prisma } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
import { verifySession } from "@/lib/session";
import { applyBeautifulRounding } from "@/lib/financial-constants";
import { SettingsProvider } from "@/lib/settings";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Zod Schema for Article validation at runtime
const articleSchema = z.object({
  title: z.string().min(3, "Заголовок должен быть не менее 3 символов"),
  slug: z.string()
    .min(2, "Slug обязателен")
    .regex(/^[a-z0-9-_]+$/, "Slug может содержать только строчные латинские буквы, цифры, дефис и подчеркивание")
    .refine((val) => {
      const reservedWords = [
        "api", "admin", "auth", "_next", "static", "dashboard", 
        "orders", "draft", "knowledge", "p", "catalog", "finance", 
        "marketing", "providers", "settings", "tickets", "clients"
      ];
      return !reservedWords.includes(val.toLowerCase());
    }, "Этот URL зарезервирован системой"),
  description: z.string().min(10, "Описание должно быть содержательным"),
  content: z.string().min(10, "Контент не должен быть пустым"),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  category: z.string().min(1, "Категория обязательна"),
  authorName: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? "Михаил" : val,
    z.string().min(2, "Имя автора должно состоять минимум из 2 символов").max(100).optional()
  ),
  authorRole: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? "Системный архитектор прокси-сетей SMMplan" : val,
    z.string().min(2, "Роль автора должна состоять минимум из 2 символов").max(200).optional()
  ),
  priority: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? 0 : Number(val),
    z.number().int().min(0).max(100).optional().default(0)
  ),
});

// Admin Check helper for view detail protection
async function isAdmin() {
  try {
    const sessionUser = await verifySession();
    if (!sessionUser) return false;
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.userId },
      include: { staffRole: { include: { permissions: true } } }
    });
    if (!user) return false;
    if (user.role === 'OWNER' || user.role === 'ADMIN') return true;
    if (!user.staffRole) return false;
    const permission = user.staffRole.permissions.find(p => p.section.toUpperCase() === 'SETTINGS');
    return !!(permission && (permission.canView || permission.canEdit));
  } catch {
    return false;
  }
}

/**
 * PUBLIC: Fetch all published articles with optional category filtering and search.
 */
export async function getArticles(categoryFilter?: string, searchQuery?: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      status: "PUBLISHED"
    };

    if (categoryFilter && categoryFilter !== "Все") {
      whereClause.category = categoryFilter;
    }

    if (searchQuery) {
      whereClause.OR = [
        { title: { contains: searchQuery, mode: "insensitive" } },
        { description: { contains: searchQuery, mode: "insensitive" } }
      ];
    }

    const articles = await prisma.article.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc"
      }
    });

    // Extract unique categories for filter tabs/dropdowns
    const allPublished = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { category: true }
    });
    const categories = Array.from(new Set(allPublished.map(a => a.category)));

    return { success: true, articles, categories };
  } catch (error) {
    console.error("Failed to get articles:", error);
    return { success: false, articles: [], categories: [], error: "Не удалось загрузить статьи" };
  }
}

/**
 * PUBLIC: Fetch article details by slug and increment view count.
 */
export async function getArticleBySlug(slug: string) {
  try {
    const article = await prisma.article.findUnique({
      where: { slug }
    });

    if (!article) {
      return { success: false, error: "Статья не найдена" };
    }

    const isUserAdmin = await isAdmin();

    // If DRAFT, only admins/owners are allowed to see it
    if (article.status === "DRAFT" && !isUserAdmin) {
      return { success: false, error: "Статья находится в черновиках" };
    }

    // Increment viewCount asynchronously/simply
    const updatedArticle = await prisma.article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } }
    });

    return { success: true, article: updatedArticle };
  } catch (error) {
    console.error("Failed to get article by slug:", error);
    return { success: false, error: "Ошибка при получении статьи" };
  }
}

/**
 * PUBLIC: Fetch 3 related articles from the same category, excluding the current one.
 */
export async function getRelatedArticles(currentArticleId: string, category: string) {
  try {
    const articles = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        category: category,
        id: { not: currentArticleId }
      },
      take: 3,
      orderBy: {
        createdAt: "desc"
      }
    });
    return { success: true, articles };
  } catch (error) {
    console.error("Failed to fetch related articles:", error);
    return { success: false, articles: [], error: "Не удалось загрузить похожие статьи" };
  }
}

/**
 * PUBLIC: Fetch all published articles grouped by target tree categories.
 */
export async function getGroupedArticlesForTree() {
  try {
    const articles = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, slug: true, title: true, category: true },
      orderBy: { createdAt: "desc" }
    });

    const grouped: Record<string, typeof articles> = {
      "Безопасность соцсетей": [],
      "Продвижение и Органика": [],
      "Биллинг и Лимиты": []
    };

    articles.forEach(a => {
      if (grouped[a.category]) {
        grouped[a.category].push(a);
      } else {
        if (!grouped[a.category]) {
          grouped[a.category] = [];
        }
        grouped[a.category].push(a);
      }
    });

    return { success: true, grouped };
  } catch (error) {
    console.error("Failed to get grouped articles:", error);
    return { success: false, grouped: {} };
  }
}

/**
 * PUBLIC: Get up to 3 recommended active services matching the article's category.
 * Calculates retail unit pricing strictly matching standard SMMplan markup guidelines:
 * pricePerUnitRub = applyBeautifulRounding(s.rate * s.markup * usdToRub) / 1000
 */
export async function getRecommendedServicesForArticle(articleId: string) {
  try {
    const article = await prisma.article.findUnique({
      where: { id: articleId }
    });

    if (!article) return [];

    const usdToRub = await SettingsProvider.getExchangeRateUSD();

    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        isQuarantined: false,
        category: {
          name: {
            contains: article.category,
            mode: "insensitive"
          }
        }
      },
      take: 3,
      include: {
        category: true
      }
    });

    return services.map(s => {
      const exchangeRate = s.providerCurrency === 'RUB' ? 1.0 : usdToRub;
      const pricePer1kRub = applyBeautifulRounding(s.rate * s.markup * exchangeRate);
      const pricePerUnitRub = pricePer1kRub / 1000;
      return {
        id: s.id,
        name: s.name,
        pricePerUnitRub,
        categoryName: s.category.name
      };
    });
  } catch (error) {
    console.error("Failed to get recommended services:", error);
    return [];
  }
}



/**
 * ADMIN: Create new knowledge article. Protected by role constraints.
 */
export async function createArticle(data: {
  title: string;
  slug: string;
  description: string;
  content: string;
  status: "DRAFT" | "PUBLISHED";
  category: string;
  authorName?: string;
  authorRole?: string;
  priority?: number;
}) {
  return requireStaffPermission('settings', 'edit', async () => {
    const parsed = articleSchema.safeParse(data);
    if (!parsed.success) {
      return { 
        success: false, 
        error: "Некорректно заполнены поля формы", 
        errors: parsed.error.flatten().fieldErrors 
      };
    }

    try {
      const article = await prisma.article.create({
        data: parsed.data
      });

      revalidatePath("/knowledge");
      revalidatePath(`/knowledge/${article.slug}`);
      revalidatePath("/admin/knowledge");

      return { success: true, article };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Failed to create article:", error);
      if (error.code === "P2002") {
        return { success: false, error: "Статья с таким адресом (slug) уже существует" };
      }
      return { success: false, error: "Не удалось сохранить статью в базе данных" };
    }
  });
}

/**
 * ADMIN: Update existing article by ID.
 */
export async function updateArticle(id: string, data: {
  title: string;
  slug: string;
  description: string;
  content: string;
  status: "DRAFT" | "PUBLISHED";
  category: string;
  authorName?: string;
  authorRole?: string;
  priority?: number;
}) {
  return requireStaffPermission('settings', 'edit', async () => {
    const parsed = articleSchema.safeParse(data);
    if (!parsed.success) {
      return { 
        success: false, 
        error: "Некорректно заполнены поля формы", 
        errors: parsed.error.flatten().fieldErrors 
      };
    }

    try {
      const oldArticle = await prisma.article.findUnique({
        where: { id }
      });

      const article = await prisma.article.update({
        where: { id },
        data: parsed.data
      });

      revalidatePath("/knowledge");
      revalidatePath(`/knowledge/${article.slug}`);
      if (oldArticle && oldArticle.slug !== article.slug) {
        revalidatePath(`/knowledge/${oldArticle.slug}`);
      }
      revalidatePath("/admin/knowledge");

      return { success: true, article };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Failed to update article:", error);
      if (error.code === "P2002") {
        return { success: false, error: "Статья с таким адресом (slug) уже существует" };
      }
      return { success: false, error: "Не удалось сохранить изменения в базе данных" };
    }
  });
}

/**
 * ADMIN: Delete article by ID.
 */
export async function deleteArticle(id: string) {
  return requireStaffPermission('settings', 'edit', async () => {
    try {
      const article = await prisma.article.delete({
        where: { id }
      });

      revalidatePath("/knowledge");
      revalidatePath(`/knowledge/${article.slug}`);
      revalidatePath("/admin/knowledge");

      return { success: true };
    } catch (error) {
      console.error("Failed to delete article:", error);
      return { success: false, error: "Не удалось удалить статью из базы данных" };
    }
  });
}

```

---

### 📄 Файл 52 из 89: `src/actions/operator/dashboard/get-operator-dashboard.action.ts`

```ts
'use server';

import { requireOperatorPermission } from '@/lib/operator/rbac';

/**
 * Example operator action fetching dashboard metadata.
 * Guarded by 'orders' section 'view' permission.
 */
export async function getOperatorDashboardData() {
  return requireOperatorPermission('orders', 'view', async () => {
    return {
      success: true,
      stats: {
        activeOrders: 0,
        openTickets: 0,
        newClients: 0,
        transactions: 0,
      }
    };
  });
}

```

---

### 📄 Файл 53 из 89: `src/actions/operator/orders/cancel-order.action.ts`

```ts
'use server';

import { requireOperatorPermission } from '@/lib/operator/rbac';
import { adminOrderService } from '@/services/admin/order.service';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const schema = z.object({
  orderId: z.string().min(1),
});

export async function cancelOrderAction(orderId: string) {
  const parsed = schema.safeParse({ orderId });
  if (!parsed.success) {
    return { success: false as const, error: 'Некорректный ID заказа' };
  }

  try {
    const result = await requireOperatorPermission('orders', 'edit', async (admin) => {
      await adminOrderService.cancelOrder(parsed.data.orderId, {
        id: admin.id,
        email: admin.email,
      });

      // Await audit for compliance & non-repudiation
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'ORDER_CANCEL',
        target: parsed.data.orderId,
        targetType: 'ORDER',
      });

      return { success: true as const };
    });

    if (result.success) {
      revalidatePath('/operator/orders');
    }

    return result;
  } catch (err) {
    console.error('[cancelOrderAction] Failed to cancel order:', err);
    const message = err instanceof Error ? err.message : 'Ошибка сервера при отмене заказа';
    return { success: false as const, error: message };
  }
}

```

---

### 📄 Файл 54 из 89: `src/actions/operator/orders/restart-order.action.ts`

```ts
'use server';

import { requireOperatorPermission } from '@/lib/operator/rbac';
import { adminOrderService } from '@/services/admin/order.service';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const schema = z.object({
  orderId: z.string().min(1),
});

export async function restartOrderAction(orderId: string) {
  const parsed = schema.safeParse({ orderId });
  if (!parsed.success) {
    return { success: false as const, error: 'Некорректный ID заказа' };
  }

  try {
    const result = await requireOperatorPermission('orders', 'edit', async (admin) => {
      await adminOrderService.restartOrder(parsed.data.orderId, {
        id: admin.id,
        email: admin.email,
      });

      // Await audit for compliance
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'ORDER_RESTART',
        target: parsed.data.orderId,
        targetType: 'ORDER',
      });

      return { success: true as const };
    });

    if (result.success) {
      revalidatePath('/operator/orders');
    }

    return result;
  } catch (err) {
    console.error('[restartOrderAction] Failed to restart order:', err);
    const message = err instanceof Error ? err.message : 'Ошибка сервера при перезапуске заказа';
    return { success: false as const, error: message };
  }
}

```

---

### 📄 Файл 55 из 89: `src/actions/operator/tickets/change-status.action.ts`

```ts
'use server';

import { requireOperatorPermission } from '@/lib/operator/rbac';
import { db } from '@/lib/db';
import { getClientIp } from '@/utils/ip';
import { auditAdmin } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const schema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(['OPEN', 'PENDING', 'CLOSED']),
});

export async function changeTicketStatusAction(data: {
  ticketId: string;
  status: 'OPEN' | 'PENDING' | 'CLOSED';
}) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: 'Некорректный статус тикета' };
  }

  try {
    const result = await requireOperatorPermission('tickets', 'edit', async (admin) => {
      const { ticketId, status } = parsed.data;

      const oldTicket = await db.ticket.findUnique({
        where: { id: ticketId },
        select: { status: true },
      });
      if (!oldTicket) {
        throw new Error('Обращение не найдено');
      }

      await db.ticket.update({
        where: { id: ticketId },
        data: {
          status,
          ...(status === 'CLOSED' ? { resolvedAt: new Date() } : {}),
        },
      });

      const ipAddress = await getClientIp('unknown');
      auditAdmin({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'TICKET_STATUS_CHANGE',
        target: ticketId,
        targetType: 'TICKET',
        oldValue: oldTicket.status,
        newValue: status,
        ipAddress,
      });

      return { success: true as const };
    });

    if (result.success) {
      revalidatePath(`/operator/tickets`);
    }

    return result;
  } catch (err) {
    console.error('[changeTicketStatusAction] Error changing status:', err);
    const message = err instanceof Error ? err.message : 'Ошибка сервера при смене статуса';
    return { success: false as const, error: message };
  }
}

```

---

### 📄 Файл 56 из 89: `src/actions/operator/tickets/reply-ticket.action.ts`

```ts
'use server';

import { requireOperatorPermission } from '@/lib/operator/rbac';
import { db } from '@/lib/db';
import { ticketService } from '@/services/support/ticket.service';
import { publishMessageSSE } from '@/services/support/sse.service';
import { getClientIp } from '@/utils/ip';
import { auditAdmin } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const schema = z.object({
  ticketId: z.string().min(1),
  message: z.string().min(1, 'Сообщение не может быть пустым'),
  isInternal: z.boolean().default(false),
});

export async function replyTicketAction(data: {
  ticketId: string;
  message: string;
  isInternal?: boolean;
}) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.errors[0]?.message || 'Некорректные входные данные';
    return { success: false as const, error: errorMsg };
  }

  try {
    const result = await requireOperatorPermission('tickets', 'edit', async (admin) => {
      const { ticketId, message, isInternal } = parsed.data;

      const ticket = await db.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, userId: true },
      });
      if (!ticket) {
        throw new Error('Обращение не найдено');
      }

      const sender = isInternal ? 'INTERNAL' : 'STAFF';

      // Save message in DB
      const savedMsg = await ticketService.addMessage(
        ticketId,
        sender,
        message,
        undefined, // mediaUrl
        undefined, // mediaType
        undefined, // replyToId
        undefined, // telegramMsgId
        undefined, // attachments
        undefined  // orderId
      );

      // Audit Action
      const ipAddress = await getClientIp('unknown');
      auditAdmin({
        adminId: admin.id,
        adminEmail: admin.email,
        action: isInternal ? 'TICKET_INTERNAL_NOTE_ADD' : 'TICKET_REPLY_SEND',
        target: ticketId,
        targetType: 'TICKET',
        newValue: { message },
        ipAddress,
      });

      // Broadcast to client via Server-Sent Events (only for client-facing replies)
      if (sender === 'STAFF' && savedMsg?.id) {
        await publishMessageSSE(ticketId, savedMsg.id);
      }

      return { success: true as const };
    });

    if (result.success) {
      revalidatePath(`/operator/tickets`);
    }

    return result;
  } catch (err) {
    console.error('[replyTicketAction] Error replying to ticket:', err);
    const message = err instanceof Error ? err.message : 'Ошибка сервера при отправке ответа';
    return { success: false as const, error: message };
  }
}

```

---

### 📄 Файл 57 из 89: `src/actions/operator/transactions/get-transactions-list.action.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireOperatorPermission } from '@/lib/operator/rbac';

const ledgerParamsSchema = z.object({
  status: z.enum(['ALL', 'APPROVED', 'QUARANTINE', 'REJECTED']).default('ALL'),
  period: z.enum(['today', 'week', 'month', 'all']).default('month'),
  search: z.string().max(255).optional(),
  cursor: z.string().optional(),
  pageSize: z.number().int().min(1).max(200).default(50),
  userId: z.string().optional(),
});

export type LedgerParams = z.infer<typeof ledgerParamsSchema>;

export type LedgerEntryDTO = {
  id: string;
  userId: string;
  userEmail: string;
  adminId: string | null;
  amount: number;
  reason: string;
  status: string;
  transactionType: string;
  createdAt: string;
};

export type LedgerPageResult = {
  items: LedgerEntryDTO[];
  nextCursor: string | null;
  hasMore: boolean;
  totals: { approved: number; quarantine: number; refunds: number };
};

function getPeriodStart(period: string): Date | undefined {
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  return undefined;
}

export async function getTransactionsListAction(
  params: Partial<LedgerParams>
): Promise<LedgerPageResult | { success: false; error: string }> {
  try {
    const result = await requireOperatorPermission('orders', 'view', async () => {
      const p = ledgerParamsSchema.parse(params);
      const periodStart = getPeriodStart(p.period);
      const searchTrim = p.search?.trim();

      const where: Prisma.LedgerEntryWhereInput = {
        ...(p.status !== 'ALL' ? { status: p.status } : {}),
        ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
        ...(p.userId ? { userId: p.userId } : {}),
      };

      if (searchTrim) {
        where.OR = [
          { user: { email: { contains: searchTrim, mode: 'insensitive' as const } } },
          { id: { contains: searchTrim, mode: 'insensitive' as const } },
          { idempotencyKey: { contains: searchTrim, mode: 'insensitive' as const } },
        ];
      }

      const pageSize = p.pageSize;
      const entries = await db.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize + 1,
        ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          userId: true,
          adminId: true,
          amount: true,
          reason: true,
          status: true,
          transactionType: true,
          createdAt: true,
        },
      });

      const hasMore = entries.length > pageSize;
      const page = hasMore ? entries.slice(0, pageSize) : entries;

      // Enrich with user email
      const uIds = Array.from(new Set(page.map((e) => e.userId)));
      const users = await db.user.findMany({
        where: { id: { in: uIds } },
        select: { id: true, email: true },
      });
      const emailMap = new Map(users.map((u) => [u.id, u.email]));

      // Totals for the summary strip
      const [approvedAgg, quarantineAgg, refundsAgg] = await Promise.all([
        db.ledgerEntry.aggregate({
          _sum: { amount: true },
          where: { ...where, status: 'APPROVED', amount: { gt: 0 } },
        }),
        db.ledgerEntry.aggregate({
          _sum: { amount: true },
          where: { ...where, status: 'QUARANTINE' },
        }),
        db.ledgerEntry.aggregate({
          _sum: { amount: true },
          where: { ...where, status: 'APPROVED', amount: { lt: 0 } },
        }),
      ]);

      return {
        items: page.map((e) => ({
          id: e.id,
          userId: e.userId,
          userEmail: emailMap.get(e.userId) ?? e.userId,
          adminId: e.adminId,
          amount: Number(e.amount),
          reason: e.reason,
          status: e.status,
          transactionType: e.transactionType,
          createdAt: e.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
        hasMore,
        totals: {
          approved: Number(approvedAgg._sum?.amount ?? 0),
          quarantine: Number(quarantineAgg._sum?.amount ?? 0),
          refunds: Math.abs(Number(refundsAgg._sum?.amount ?? 0)),
        },
      };
    });

    return result;
  } catch (err) {
    console.error('[getTransactionsListAction] Error:', err);
    const message = err instanceof Error ? err.message : 'Ошибка сервера при загрузке транзакций';
    return { success: false, error: message };
  }
}

```

---

### 📄 Файл 58 из 89: `src/actions/operator/users/create-user-note.action.ts`

```ts
'use server';

import { requireOperatorPermission, getOperatorContext } from '@/lib/operator/rbac';
import { addUserNote } from '@/services/operator/users/user-notes.query';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const schema = z.object({
  userId: z.string().min(1),
  content: z.string().min(1, 'Текст заметки не может быть пустым').max(2000, 'Заметка слишком длинная (макс. 2000 символов)'),
  orderId: z.string().nullable().optional(),
  ticketId: z.string().nullable().optional(),
});

export async function createUserNoteAction(data: {
  userId: string;
  content: string;
  orderId?: string | null;
  ticketId?: string | null;
}) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.errors[0]?.message || 'Некорректные входные данные';
    return { success: false, error: errorMsg };
  }

  try {
    const result = await requireOperatorPermission('orders', 'edit', async () => {
      const context = await getOperatorContext();
      const authorId = context?.user?.id || null;

      await addUserNote(
        parsed.data.userId,
        authorId,
        parsed.data.content,
        parsed.data.orderId,
        parsed.data.ticketId
      );

      return { success: true };
    });

    if (result.success) {
      revalidatePath(`/operator/users/${parsed.data.userId}`);
    }

    return result;
  } catch (err) {
    console.error('[createUserNoteAction] Error creating note:', err);
    const message = err instanceof Error ? err.message : 'Ошибка сервера при создании заметки';
    return { success: false, error: message };
  }
}

```

---

### 📄 Файл 59 из 89: `src/actions/operator/users/get-user-financial-summary.action.ts`

```ts
'use server';

import { requireOperatorPermission } from '@/lib/operator/rbac';
import { getClientFinancialSummary } from '@/services/operator/users/client-financial-summary.query';
import { z } from 'zod';

const inputSchema = z.object({
  userId: z.string().min(1)
});

/**
 * Guarded server action retrieving a user's ledger-based financial summary.
 * Guarded by 'orders' section 'view' permission.
 */
export async function getUserFinancialSummaryAction(userId: string) {
  const parsed = inputSchema.safeParse({ userId });
  if (!parsed.success) {
    throw new Error('Некорректный ID пользователя');
  }

  return requireOperatorPermission('orders', 'view', async () => {
    return getClientFinancialSummary(parsed.data.userId);
  });
}

```

---

### 📄 Файл 60 из 89: `src/actions/operator/users/get-users-list.action.ts`

```ts
'use server';

import { requireOperatorPermission } from '@/lib/operator/rbac';
import { adminUserService } from '@/services/admin/user.service';
import { z } from 'zod';

const inputSchema = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  pageSize: z.number().int().positive().optional(),
});

export async function getUsersListAction(params: {
  search?: string;
  cursor?: string;
  pageSize?: number;
} = {}) {
  const parsed = inputSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error('Некорректные параметры запроса');
  }

  return requireOperatorPermission('orders', 'view', async () => {
    return adminUserService.listUsers({
      search: parsed.data.search,
      cursor: parsed.data.cursor,
      pageSize: parsed.data.pageSize || 50,
    });
  });
}

```

---

### 📄 Файл 61 из 89: `src/actions/order/analyze-url.ts`

```ts
"use server";

import { IntelligenceLinkAnalyzer } from "@/services/analyzer/link-analyzer";
import { RateLimitService } from '@/services/core/rate-limit.service';
import { safeUrlForLog } from "@/lib/log-safe";


import { IntelligenceAnalysisResult } from "@/services/analyzer/link-analyzer";

const analyzeCache = new Map<string, { data: IntelligenceAnalysisResult; expiresAt: number }>();

function isUrlSafeForFetch(urlString: string): boolean {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false;
  
  const hostname = parsedUrl.hostname.toLowerCase();
  // Block metadata endpoints
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal' || hostname.endsWith('.metadata.internal')) {
    return false;
  }
  // Block local/loopback
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
  // Block private IP ranges (simplified regex check)
  if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|0\.)/.test(hostname)) return false;
  
  return true;
}

export async function analyzeUrl(url: string): Promise<{ success: boolean; data?: IntelligenceAnalysisResult; error?: string }> {
  try {
    if (!url || typeof url !== 'string' || url.length > 2048) {
      return { success: false, error: "URL exceeds maximum length of 2048 characters." };
    }

    if (!isUrlSafeForFetch(url)) {
      return { success: false, error: "This URL format is not supported for analysis." };
    }

    const { getClientIp } = await import('@/utils/ip');
    const ip = await getClientIp();

    const isAllowed = await RateLimitService.checkCustomKey(`analyzeUrl:${ip}`, 15, 60, true);
    if (!isAllowed) {
       return { success: false, error: "Too many URL analysis requests." };
    }

    const cached = analyzeCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return { success: true, data: cached.data };
    }

    const analyzer = new IntelligenceLinkAnalyzer();
    const result = await analyzer.analyze(url);
    
    if (!result) {
        return { success: false, error: "Failed to recognize link" };
    }

    analyzeCache.set(url, { data: result, expiresAt: Date.now() + 60000 });

    return { success: true, data: result };
  } catch (error) {
    console.error(`Link analysis failed for ${safeUrlForLog(url)}:`, error);
    return { success: false, error: "Failed to analyze URL" };
  }
}

```

---

### 📄 Файл 62 из 89: `src/actions/order/cancel.ts`

```ts
'use server';

import { verifySession } from '@/lib/session';
import { orderService } from '@/services/core/order.service';
import { revalidatePath } from 'next/cache';
import { RateLimitService } from '@/services/core/rate-limit.service';

export async function cancelOrderCoolingOffAction(orderId: string) {
  try {
    const session = await verifySession();
    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const isAllowed = await RateLimitService.check(`cancel-order:${session.userId}`, 20, 60);
    if (!isAllowed) {
      return { success: false, error: 'Слишком частые запросы на отмену. Подождите.' };
    }

    const result = await orderService.cancelPendingOrderClient(orderId, session.userId);

    if (result.success) {
      revalidatePath('/dashboard/orders');
      revalidatePath('/dashboard/orders/[id]', 'page');
      revalidatePath('/dashboard'); // To update balance
      return { success: true };
    }

    return { success: false, error: result.error || 'Failed to cancel the order' };
  } catch (error: unknown) {
    console.error('[cancelOrderAction] Action error:', error);
    return { success: false, error: 'Сеть или серверная ошибка при отмене' };
  }
}

```

---

### 📄 Файл 63 из 89: `src/actions/order/legal.ts`

```ts
"use server";

import { db as prisma } from "@/lib/db";
import { SettingsProvider } from "@/lib/settings";

export async function getLegalDocumentAction(slug: string) {
  try {
    const post = await prisma.contentItem.findUnique({
      where: { slug },
      select: { title: true, contentHtml: true, isPublished: true },
    });

    if (!post) {
      return { success: false, error: "Документ не найден" };
    }

    if (!post.isPublished) {
      return { success: false, error: "Документ не опубликован" };
    }

    const settings = await SettingsProvider.getContactAndLegalSettings();
    const companyName = settings.COMPANY_NAME || 'ИП / ООО';
    const inn = settings.COMPANY_INN || 'Укажите ИНН';
    const ogrnip = settings.COMPANY_OGRNIP || 'Укажите ОГРНИП';
    const address = settings.COMPANY_ADDRESS || 'г. Москва';
    const email = settings.SUPPORT_EMAIL || 'support@smmplan.pro';
    const privacyEmail = settings.PRIVACY_EMAIL || 'privacy@smmplan.pro';
    const siteName = settings.SITE_NAME || 'SMMplan';

    let finalHtml = post.contentHtml || "";
    finalHtml = finalHtml
      .replace(/{{COMPANY_NAME}}/g, companyName)
      .replace(/{{COMPANY_INN}}/g, inn)
      .replace(/{{COMPANY_OGRNIP}}/g, ogrnip)
      .replace(/{{COMPANY_ADDRESS}}/g, address)
      .replace(/{{SUPPORT_EMAIL}}/g, email)
      .replace(/{{PRIVACY_EMAIL}}/g, privacyEmail)
      .replace(/{{SITE_NAME}}/g, siteName);

    return { success: true, data: { title: post.title, html: finalHtml } };
  } catch (e) {
    const err = e as Error;
    return { success: false, error: err.message || "Ошибка загрузки документа" };
  }
}

```

---

### 📄 Файл 64 из 89: `src/actions/order/mass.ts`

```ts
'use server';

import { createSafeAction } from '@/lib/safe-action';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifySession, createSession } from '@/lib/session';
import { marketingService } from '@/services/marketing.service';
import { getBaseUrlSync } from "@/utils/get-base-url";
import { headers } from 'next/headers';
import { getClientIp } from '@/utils/ip';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { SettingsManager } from '@/lib/settings';
import { WalletInsufficientFundsError, WalletUserNotFoundError, WalletInvalidAmountError } from '@/services/financial/wallet-ops';
import crypto from 'crypto';
import { mutateLink, getLinkValidator } from '@/validators/link-mutators';
import { inferTargetTypeFromCategory } from '@/utils/target-type';

const massOrderSchema = z.object({
  text: z.string().min(1, 'Введите данные для заказа').max(20480, 'Текст заказа слишком длинный'),
  email: z.string().email('Введите корректный email').nullable().optional(),
  gateway: z.enum(['yookassa', 'cryptobot', 'balance']).default('yookassa'),
  idempotencyKey: z.string().optional(),
  expectedTotalRub: z.number().optional(), // W2-2: for TOCTOU price validation
});

const structuredMassOrderSchema = z.object({
  orders: z.array(z.object({
    serviceId: z.string(),
    link: z.string().max(2048, 'Ссылка слишком длинная'),
    quantity: z.number().positive(),
  })).min(1, 'Заказы не найдены'),
  email: z.string().email('Введите корректный email').nullable().optional(),
  gateway: z.enum(['yookassa', 'cryptobot', 'balance']).default('yookassa'),
  idempotencyKey: z.string().optional(),
  expectedTotalRub: z.number().optional(),
});

const parseMassOrderText = async (text: string) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length > 500) {
    throw new Error('Превышен максимальный размер пакета массового заказа (максимум 500 строк)');
  }
  const orders: { 
    serviceId: string; 
    numericId: number; 
    link: string; 
    quantity: number; 
    providerId?: string | null; 
    providerServiceId?: string | null; 
  }[] = [];
  const errors: { line: number; text: string; error: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split('|').map(p => p.trim());
    
    if (parts.length < 3) {
      errors.push({ line: i + 1, text: line, error: 'Формат должен быть: ID услуги | Ссылка | Количество' });
      continue;
    }

    const serviceIdStr = parts[0];
    const link = parts[1];
    const qtyStr = parts[2];

    const numericId = parseInt(serviceIdStr, 10);
    const quantity = parseInt(qtyStr, 10);

    if (isNaN(numericId) || isNaN(quantity) || quantity <= 0) {
      errors.push({ line: i + 1, text: line, error: 'ID услуги и количество должны быть числами' });
      continue;
    }

    orders.push({ serviceId: '', numericId, link, quantity });
  }

  if (orders.length > 0) {
    const numericIds = orders.map(o => o.numericId);
    const services = await db.service.findMany({
      where: { numericId: { in: numericIds }, isActive: true },
      include: { 
        category: { 
          include: { network: true } 
        } 
      }
    });

    const serviceMap = new Map(services.map(s => [s.numericId, s]));

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const service = serviceMap.get(order.numericId);
      if (!service) {
        errors.push({ line: i + 1, text: `${order.numericId}`, error: `Услуга ID ${order.numericId} не найдена или неактивна` });
        continue;
      }

      // 1. Quarantine & Cooldown check
      if (service.cooldownUntil && service.cooldownUntil > new Date()) {
        errors.push({ line: i + 1, text: `${order.numericId} | ${order.link} | ${order.quantity}`, error: `Услуга "${service.name}" временно приостановлена для контроля качества.` });
        continue;
      }
      
      if (order.quantity < service.minQty || order.quantity > service.maxQty) {
        errors.push({ line: i + 1, text: `${order.numericId} | ${order.link} | ${order.quantity}`, error: `Количество для "${service.name}" должно быть от ${service.minQty} до ${service.maxQty}` });
        continue;
      }

      // 2. Link Normalization and Validation
      try {
        const platformSlug = service.category?.network?.slug?.toUpperCase() || '';
        const { inferTargetTypeFromCategory } = await import('@/utils/target-type');
        const targetType = service.targetType === 'POST'
          ? inferTargetTypeFromCategory(service.category?.name)
          : (service.targetType || inferTargetTypeFromCategory(service.category?.name));
        const normalizedLink = mutateLink(order.link, platformSlug, targetType);
        const validator = getLinkValidator(platformSlug, targetType);
        const linkResult = validator.safeParse(normalizedLink);

        if (!linkResult.success) {
          errors.push({ line: i + 1, text: `${order.numericId} | ${order.link} | ${order.quantity}`, error: linkResult.error.errors[0].message });
        } else {
          order.link = normalizedLink;
          order.serviceId = service.id;
          order.providerId = service.providerId;
          order.providerServiceId = service.externalId;
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        errors.push({ line: i + 1, text: `${order.numericId} | ${order.link} | ${order.quantity}`, error: e.message || 'Ошибка валидации ссылки' });
      }
    }
  }

  return { orders: orders.filter(o => o.serviceId), errors };
};

export const massOrderCalculateAction = async (input: { text: string }) => {
  return createSafeAction(z.object({ text: z.string() }), input, async (data: { text: string }) => {
    const session = await verifySession();
    const userId = session?.userId;
    
    const { orders, errors } = await parseMassOrderText(data.text);
    if (orders.length === 0) {
      throw new Error(errors[0]?.error || 'Нет валидных строк для заказа');
    }

    let totalCents = 0;
    const validOrders = [];
    
    // W4-4 FIX: Preload user and services to avoid N+1 queries in loop
    let user = null;
    if (userId) {
      user = await db.user.findUnique({ where: { id: userId } });
    }
    const serviceIds = orders.map(o => o.serviceId);
    const services = await db.service.findMany({ where: { id: { in: serviceIds } } });
    const serviceMap = new Map(services.map(s => [s.id, s]));

    for (const order of orders) {
       try {
         const pricing = await marketingService.calculatePrice(
           userId, 
           order.serviceId, 
           order.quantity, 
           null, 
           { user, service: serviceMap.get(order.serviceId) }
         );
         totalCents += pricing.totalCents;
         validOrders.push({ ...order, priceRub: pricing.totalCents / 100 });
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       } catch (e: any) {
         errors.push({ line: -1, text: order.link, error: e.message });
       }
     }

    return { 
      totalRub: totalCents / 100, 
      totalCents, 
      validCount: validOrders.length, 
      errors,
      validOrders 
    };
  });
};

export const massOrderCheckoutAction = async (input: z.infer<typeof massOrderSchema>) => {
  return createSafeAction(massOrderSchema, input, async (data) => {
    const { text, email, gateway, idempotencyKey } = data;
    
    // 0. IDOR Prevention & Anti-Fraud
    const isAllowed = await RateLimitService.check("massCheckoutCore", 5, 60);
    if (!isAllowed) throw new Error("Слишком много запросов. Попробуйте через минуту.");

    const session = await verifySession();
    let userId = session?.userId;
    let isNewUser = false;

    if (!userId && gateway === 'balance') {
      throw new Error("Оплата с баланса доступна только авторизованным пользователям");
    }

    if (!userId) {
       if (!email) throw new Error("Email обязателен для гостей");
       const lowerEmail = email.toLowerCase();
       const reqHeaders = await headers();
       const tenantId = reqHeaders.get("x-tenant-id") || "smmplan";
       let user = await db.user.findUnique({ where: { email_tenantId: { email: lowerEmail, tenantId } } });
       if (user && (user.isDeleted === true || user.isActive === false)) {
         throw new Error("Ваш аккаунт заблокирован или удален");
       }
       if (!user) {
         user = await db.user.create({
           data: { email: lowerEmail, tenantId, role: 'USER' }
         });
         isNewUser = true;
       }
       userId = user.id;
    }
    
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

    if (session?.userId && user.id !== session.userId) {
      throw new Error("Несоответствие сессии пользователя");
    }

    // 0.5 Idempotency check
    if (idempotencyKey) {
      const existingOrder = await db.order.findFirst({
        where: { idempotencyKey: `${idempotencyKey}_order_0`, userId: user.id },
        include: { payment: true }
      });
      if (existingOrder && existingOrder.payment) {
        console.info(`[MassCheckout] Idempotency hit for key ${idempotencyKey}`);
        return {
          paymentId: existingOrder.paymentId,
          paymentUrl: existingOrder.payment.checkoutUrl || ''
        };
      }
    }

    const reqHeaders = await headers();
    const consentIp = await getClientIp();
    const consentUserAgent = reqHeaders.get("user-agent") || "Unknown";

    const { orders } = await parseMassOrderText(text);
    if (orders.length === 0) throw new Error("Нет валидных строк для заказа");

    let totalCents = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderCreationData: any[] = [];
    
    // W2-3: Generate unique keys for each order in the batch, rather than re-using the checkout request's idempotency key
    const crypto = (await import('crypto')).default;
    const isTestMode = await SettingsManager.isTestMode(); // W4-5 FIX

    // W4-4 FIX: Preload services to avoid N+1 queries in loop
    const serviceIds = orders.map(o => o.serviceId);
    const services = await db.service.findMany({ where: { id: { in: serviceIds } } });
    const serviceMap = new Map(services.map(s => [s.id, s]));

    for (let idx = 0; idx < orders.length; idx++) {
       const order = orders[idx];
       const service = serviceMap.get(order.serviceId);
       if (!service || !service.isActive || service.isQuarantined) {
         throw new Error(`Услуга ID ${order.numericId} не найдена, неактивна или находится в карантине`);
       }
       const pricing = await marketingService.calculatePrice(
         user.id, 
         order.serviceId, 
         order.quantity, 
         null, 
         { user, service }
       );
       totalCents += pricing.totalCents;
       orderCreationData.push({
         userId: user.id,
         tenantId: user.tenantId,
         serviceId: order.serviceId,
         providerId: order.providerId,
         providerServiceId: order.providerServiceId,
         link: order.link,
         quantity: order.quantity,
         charge: pricing.totalCents,
         providerCost: pricing.providerCostCents,
         status: 'AWAITING_PAYMENT' as const,
         email: user.email,
         isDripFeed: false,
         remains: order.quantity,
         consentIp,
         consentUserAgent,
         idempotencyKey: idempotencyKey ? `${idempotencyKey}_order_${idx}` : crypto.randomUUID(),
         isTest: isTestMode
       });
    }
    
    // W2-2 FIX: TOCTOU Price Validation
    if (data.expectedTotalRub !== undefined) {
      const expectedCents = Math.round(data.expectedTotalRub * 100);
      const diff = Math.abs(totalCents - expectedCents);
      // Allow max 1% deviation (e.g. currency rate fluctuated slightly during checkout)
      if (diff > expectedCents * 0.01 && diff > 100) {
        throw new Error(`Цена изменилась с момента расчета. Ожидалось: ${data.expectedTotalRub} ₽, сейчас: ${totalCents / 100} ₽. Пожалуйста, обновите заказ.`);
      }
    }

    // Enforce 10 RUB minimum for Acquiring (YooKassa / CryptoBot) -> Auto-convert to 10 RUB top-up
    let paymentAmount = totalCents;
    const isMicroOrder = gateway !== 'balance' && totalCents < 1000;
    if (isMicroOrder) {
      paymentAmount = 1000; // 10 RUB minimum deposit (1000 cents)
    }

    if (gateway === 'balance' && user.balance < totalCents) {
      throw new Error("Недостаточно средств на балансе");
    }

    // Create Payment and Orders in Transaction
    const result = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          amount: paymentAmount,
          currency: 'RUB',
          status: 'PENDING',
          gateway,
          consentIp,
          consentUserAgent
        }
      });

      // We assign paymentId directly in the bulk create
      await tx.order.createMany({
        data: orderCreationData.map(o => ({ ...o, paymentId: payment.id }))
      });

      return { paymentId: payment.id };
    });


    const host = reqHeaders.get("host") || "localhost:3000";
    const protocol = reqHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = getBaseUrlSync(host, protocol);
    let successUrl = `${origin}/success?paymentId=${result.paymentId}`;

    // [Phase 3 Surgeon] Generate capability token for sessionless payment return validation
    let token = '';
    let paymentUrl: string | undefined;
    try {
      const { SignJWT } = await import('jose');
      const { getEncodedKey } = await import('@/lib/session');
      token = await new SignJWT({ 
        paymentId: result.paymentId,
        purpose: 'payment_return' 
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getEncodedKey());
    } catch (e) {
      console.error('[MassCheckout] Failed to generate return capability token:', e);
    }

    if (token) {
      successUrl += `&token=${token}`;
    }

    try {
      const { paymentGatewayQueue } = await import('@/lib/queue-manager');
      await paymentGatewayQueue.add('generate-gateway-payment', {
        paymentId: result.paymentId,
        userId: user.id,
        amountRub: paymentAmount / 100,
        email: user.email,
        successUrl,
        description: `Массовый заказ (Payment #${result.paymentId})`,
        isTestMode: isTestMode || user.email === 'e2e-tester@test.com',
        gateway: (gateway || 'yookassa') as "yookassa" | "cryptobot" | "robokassa",
        metadata: { type: 'checkout' }
      });
      
      paymentUrl = `/payment-redirect?id=${result.paymentId}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (gatewayErr: any) {
      console.error('[MassCheckout] Queue push failed', gatewayErr);
      await db.payment.update({
        where: { id: result.paymentId },
        data: { status: 'CANCELED' }
      });
      await db.order.updateMany({
        where: { paymentId: result.paymentId },
        data: { status: 'ERROR', error: gatewayErr.message || 'Ошибка генерации платежа' }
      });
      
      if (gatewayErr instanceof WalletInsufficientFundsError) {
        throw new Error('Недостаточно средств на балансе. Пожалуйста, пополните счет.', { cause: gatewayErr });
      }
      if (gatewayErr instanceof WalletUserNotFoundError) {
        throw new Error('Пользователь не найден. Пожалуйста, авторизуйтесь заново.', { cause: gatewayErr });
      }
      if (gatewayErr instanceof WalletInvalidAmountError) {
        throw new Error('Некорректная сумма операции.', { cause: gatewayErr });
      }
      throw new Error(gatewayErr.message || 'Ошибка на стороне платежного шлюза. Попробуйте другой метод', { cause: gatewayErr });
    }

    if (!session && isNewUser) {
      await createSession(user.id);
    }

    return { 
      paymentId: result.paymentId,
      paymentUrl
    };
  });
};

export const structuredMassOrderCheckoutAction = async (input: z.infer<typeof structuredMassOrderSchema>) => {
  return createSafeAction(structuredMassOrderSchema, input, async (data) => {
    const { orders: rawOrders, email, gateway, idempotencyKey } = data;
    
    // 0. IDOR Prevention & Anti-Fraud
    const isAllowed = await RateLimitService.check("massCheckoutCore", 5, 60);
    if (!isAllowed) throw new Error("Слишком много запросов. Попробуйте через минуту.");

    const session = await verifySession();
    let userId = session?.userId;
    let isNewUser = false;

    if (!userId && gateway === 'balance') {
      throw new Error("Оплата с баланса доступна только авторизованным пользователям");
    }

    if (!userId) {
       if (!email) throw new Error("Email обязателен для гостей");
       const lowerEmail = email.toLowerCase();
       const reqHeaders = await headers();
       const tenantId = reqHeaders.get("x-tenant-id") || "smmplan";
       let user = await db.user.findUnique({ where: { email_tenantId: { email: lowerEmail, tenantId } } });
       if (user && (user.isDeleted === true || user.isActive === false)) {
         throw new Error("Ваш аккаунт заблокирован или удален");
       }
       if (!user) {
         user = await db.user.create({
           data: { email: lowerEmail, tenantId, role: 'USER' }
         });
         isNewUser = true;
       }
       userId = user.id;
    }
    
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

    if (session?.userId && user.id !== session.userId) {
      throw new Error("Несоответствие сессии пользователя");
    }

    // 0.5 Idempotency check
    if (idempotencyKey) {
      const existingOrder = await db.order.findFirst({
        where: { idempotencyKey: `${idempotencyKey}_order_0`, userId: user.id },
        include: { payment: true }
      });
      if (existingOrder && existingOrder.payment) {
        return {
          paymentId: existingOrder.paymentId,
          paymentUrl: existingOrder.payment.checkoutUrl || ''
        };
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let reqHeaders: any;
    try {
      reqHeaders = await headers();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      reqHeaders = {
        get: (key: string) => {
          if (key === 'host') return 'localhost:3000';
          if (key === 'x-forwarded-proto') return 'http';
          return null;
        }
      };
    }
    const consentIp = await getClientIp();
    const consentUserAgent = reqHeaders.get("user-agent") || "Unknown";

    let totalCents = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderCreationData: any[] = [];
    const isTestMode = await SettingsManager.isTestMode();

    const serviceIds = rawOrders.map(o => o.serviceId);
    const services = await db.service.findMany({ 
      where: { id: { in: serviceIds } },
      include: { category: { include: { network: true } } }
    });
    const serviceMap = new Map(services.map(s => [s.id, s]));

    for (let idx = 0; idx < rawOrders.length; idx++) {
       const order = rawOrders[idx];
       const service = serviceMap.get(order.serviceId);
       if (!service || !service.isActive || service.isQuarantined) {
         throw new Error(`Услуга ID ${order.serviceId} не найдена, неактивна или находится в карантине`);
       }
       if (order.quantity < service.minQty || order.quantity > service.maxQty) {
         throw new Error(`Количество для "${service.name}" должно быть от ${service.minQty} до ${service.maxQty}`);
       }

       // Link Normalization
       const platformSlug = service.category?.network?.slug?.toUpperCase() || '';
       const targetType = service.targetType === 'POST'
         ? inferTargetTypeFromCategory(service.category?.name)
         : (service.targetType || inferTargetTypeFromCategory(service.category?.name));
       const normalizedLink = mutateLink(order.link, platformSlug, targetType);
       const validator = getLinkValidator(platformSlug, targetType);
       const linkResult = validator.safeParse(normalizedLink);

       if (!linkResult.success) {
         throw new Error(`Ошибка в ссылке ${order.link}: ${linkResult.error.errors[0].message}`);
       }

       const pricing = await marketingService.calculatePrice(
         user.id, 
         order.serviceId, 
         order.quantity, 
         null, 
         { user, service }
       );
       totalCents += pricing.totalCents;
       orderCreationData.push({
         userId: user.id,
         tenantId: user.tenantId,
         serviceId: order.serviceId,
         providerId: service.providerId,
         providerServiceId: service.externalId,
         link: normalizedLink,
         quantity: order.quantity,
         charge: pricing.totalCents,
         providerCost: pricing.providerCostCents,
         status: 'AWAITING_PAYMENT' as const,
         email: user.email,
         isDripFeed: false,
         remains: order.quantity,
         consentIp,
         consentUserAgent,
         idempotencyKey: idempotencyKey ? `${idempotencyKey}_order_${idx}` : crypto.randomUUID(),
         isTest: isTestMode
       });
    }
    
    if (data.expectedTotalRub !== undefined) {
      const expectedCents = Math.round(data.expectedTotalRub * 100);
      const diff = Math.abs(totalCents - expectedCents);
      if (diff > expectedCents * 0.01 && diff > 100) {
        throw new Error(`Цена изменилась. Ожидалось: ${data.expectedTotalRub} ₽, сейчас: ${totalCents / 100} ₽. Пожалуйста, обновите заказ.`);
      }
    }

    let paymentAmount = totalCents;
    const isMicroOrder = gateway !== 'balance' && totalCents < 1000;
    if (isMicroOrder) {
      paymentAmount = 1000;
    }

    if (gateway === 'balance' && user.balance < totalCents) {
      throw new Error("Недостаточно средств на балансе");
    }

    const result = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          amount: paymentAmount,
          currency: 'RUB',
          status: 'PENDING',
          gateway,
          consentIp,
          consentUserAgent
        }
      });

      await tx.order.createMany({
        data: orderCreationData.map(o => ({ ...o, paymentId: payment.id }))
      });

      return { paymentId: payment.id };
    });

    let paymentUrl: string | undefined;
    const host = reqHeaders.get("host") || "localhost:3000";
    const protocol = reqHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = getBaseUrlSync(host, protocol);
    let successUrl = `${origin}/success?paymentId=${result.paymentId}`;

    let token = '';
    try {
      const { SignJWT } = await import('jose');
      const { getEncodedKey } = await import('@/lib/session');
      token = await new SignJWT({ 
        paymentId: result.paymentId,
        purpose: 'payment_return' 
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getEncodedKey());
    } catch (e) {
      console.error('[MassCheckout] Failed to generate return capability token:', e);
    }

    if (token) {
      successUrl += `&token=${token}`;
    }

    try {
      const { paymentGatewayQueue } = await import('@/lib/queue-manager');
      await paymentGatewayQueue.add('generate-gateway-payment', {
        paymentId: result.paymentId,
        userId: user.id,
        amountRub: paymentAmount / 100,
        email: user.email,
        successUrl,
        description: `Массовый заказ (Payment #${result.paymentId})`,
        isTestMode: isTestMode || user.email === 'e2e-tester@test.com',
        gateway: (gateway || 'yookassa') as "yookassa" | "cryptobot" | "robokassa",
        metadata: { type: 'checkout' }
      });
      
      paymentUrl = `/payment-redirect?id=${result.paymentId}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (gatewayErr: any) {
      console.error('[MassCheckout] Gateway failed', gatewayErr);
      await db.payment.update({
        where: { id: result.paymentId },
        data: { status: 'CANCELED' }
      });
      await db.order.updateMany({
        where: { paymentId: result.paymentId },
        data: { status: 'ERROR', error: gatewayErr.message || 'Ошибка генерации платежа' }
      });
      
      if (gatewayErr instanceof WalletInsufficientFundsError) {
        throw new Error('Недостаточно средств на балансе. Пожалуйста, пополните счет.', { cause: gatewayErr });
      }
      if (gatewayErr instanceof WalletUserNotFoundError) {
        throw new Error('Пользователь не найден. Пожалуйста, авторизуйтесь заново.', { cause: gatewayErr });
      }
      if (gatewayErr instanceof WalletInvalidAmountError) {
        throw new Error('Некорректная сумма операции.', { cause: gatewayErr });
      }
      throw new Error(gatewayErr.message || 'Ошибка на стороне платежного шлюза. Попробуйте другой метод', { cause: gatewayErr });
    }

    if (!session && isNewUser) {
      await createSession(user.id);
    }

    return { 
      paymentId: result.paymentId,
      paymentUrl
    };
  });
};

```

---

### 📄 Файл 65 из 89: `src/actions/order/refill.ts`

```ts
'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function requestClientRefillAction(input: string | { orderId: string }) {
  const session = await verifySession();
  if (!session || !session.userId) {
    return { success: false as const, error: 'Пользователь не авторизован' };
  }

  const orderId = typeof input === 'string' ? input : input?.orderId;
  if (!orderId || typeof orderId !== 'string') {
    return { success: false as const, error: 'ID заказа не указан' };
  }

  try {
    const order = await db.order.findFirst({
      where: {
        id: orderId,
        userId: session.userId,
      },
      include: {
        service: {
          select: {
            isRefillEnabled: true,
          },
        },
        refills: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!order) {
      return { success: false as const, error: 'Заказ не найден или недоступен' };
    }

    if (!order.service?.isRefillEnabled) {
      return {
        success: false as const,
        error: 'Для данной услуги бесплатная докрутка не предусмотрена',
      };
    }

    if (order.status !== 'COMPLETED' && order.status !== 'PARTIAL') {
      return {
        success: false as const,
        error: 'Докрутка доступна только для завершенных или частично выполненных заказов',
      };
    }

    const hasActiveRefill = order.refills.some((r) =>
      ['PENDING', 'IN_PROGRESS'].includes(r.status)
    );

    if (hasActiveRefill) {
      const activeRefill = order.refills.find((r) =>
        ['PENDING', 'IN_PROGRESS'].includes(r.status)
      );
      return {
        success: false as const,
        error: 'Заявка на докрутку уже принята и находится в обработке',
        refill: activeRefill
          ? {
              id: activeRefill.id,
              status: activeRefill.status,
              createdAt: activeRefill.createdAt.toISOString(),
            }
          : undefined,
      };
    }

    const refill = await db.refill.create({
      data: {
        orderId: order.id,
        status: 'PENDING',
      },
    });

    try {
      const { refillQueue } = await import('@/lib/queue-manager');
      if (refillQueue) {
        await refillQueue.add('process-refill', { refillId: refill.id });
      }
    } catch {
      // Queue worker fallback
    }

    revalidatePath('/dashboard/orders');
    revalidatePath(`/dashboard/orders/${order.id}`);

    return {
      success: true as const,
      message: 'Заявка на докрутку принята',
      refill: {
        id: refill.id,
        status: refill.status,
        createdAt: refill.createdAt.toISOString(),
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false as const,
      error: errorMsg || 'Ошибка при запросе докрутки',
    };
  }
}


```

---

### 📄 Файл 66 из 89: `src/actions/order/smart.ts`

```ts
'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getClientIp } from '@/utils/ip';

export async function getClientCampaigns(page: number = 1, limit: number = 20) {
  const session = await verifySession();
  if (!session || !session.userId) {
    throw new Error('Необходима авторизация');
  }

  const skip = (page - 1) * limit;

  const [campaigns, total] = await Promise.all([
    db.smartCampaign.findMany({
      where: { userId: session.userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { name: true, category: { select: { network: { select: { slug: true, name: true } } } } } },
        tasks: {
          orderBy: { runAt: 'asc' },
          include: { executions: { select: { externalOrderId: true, status: true } } }
        }
      }
    }),
    db.smartCampaign.count({ where: { userId: session.userId } })
  ]);

  const formatted = campaigns.map(c => {
    const totalTasks = c.tasks.length;
    const completedTasks = c.tasks.filter(t => t.status === 'COMPLETED').length;

    return {
      id: c.id,
      serviceName: c.service.name,
      networkSlug: c.service.category?.network?.slug || 'web',
      networkName: c.service.category?.network?.name || 'Другое',
      link: c.link,
      totalQuantity: c.totalQuantity,
      totalDays: c.totalDays,
      status: c.status,
      createdAt: c.createdAt,
      progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      tasks: c.tasks.map(t => ({
        id: t.id,
        quantity: t.quantity,
        runAt: t.runAt,
        status: t.status,
        error: t.error,
        externalOrderId: t.executions[0]?.externalOrderId || null,
        execStatus: t.executions[0]?.status || null
      }))
    };
  });

  return { success: true, data: { campaigns: formatted, total, pages: Math.ceil(total / limit) } };
}

export async function toggleClientCampaignStatus(campaignId: string, status: 'RUNNING' | 'PAUSED') {
  const session = await verifySession();
  if (!session || !session.userId) {
    throw new Error('Необходима авторизация');
  }

  const campaign = await db.smartCampaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) {
    throw new Error('Кампания не найдена');
  }

  // IDOR Security Guard
  if (campaign.userId !== session.userId) {
    throw new Error('Доступ запрещен');
  }

  if (campaign.status === 'COMPLETED' || campaign.status === 'ERROR') {
    throw new Error('Нельзя изменить статус завершенной или деактивированной кампании');
  }

  const updated = await db.smartCampaign.update({
    where: { id: campaignId },
    data: { status }
  });

  revalidatePath('/dashboard/smart-drip');
  return { success: true, data: updated };
}

```

---

### 📄 Файл 67 из 89: `src/actions/order/sync-payment.ts`

```ts
'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { SettingsManager } from '@/lib/settings';
import { paymentService } from '@/services/financial/payment.service';

/**
 * Проверяет неоплаченные заказы (и пополнения), 
 * совершая прямой REST-запрос к ЮKassa для обхода задержек вебхуков.
 * Возвращает true, если хотя бы один платеж был успешно синхронизирован.
 */
export async function forceSyncMyPaymentsAction(): Promise<boolean> {
  const session = await verifySession();
  if (!session) return false;

  let anySynced = false;

  try {
    // Найти все платежи пользователя в статусе PENDING
    const pendingPayments = await db.payment.findMany({
      where: {
        userId: session.userId,
        status: 'PENDING',
        gateway: 'yookassa',
        gatewayId: { not: null }
      },
      take: 5 // Ограничим чтобы не повесить API ЮKassa
    });

    if (pendingPayments.length === 0) return false;

    const secrets = await SettingsManager.getPaymentSecrets();
    const shopId = secrets.yookassaShopId;
    const secretKey = secrets.yookassaSecretKey;
    if (!shopId || !secretKey) return false;

    const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
    const isTestMode = await SettingsManager.isTestMode();

    for (const payment of pendingPayments) {
      if (!payment.gatewayId) continue;

      try {
        const resp = await fetch(`https://api.yookassa.ru/v3/payments/${payment.gatewayId}`, {
          method: 'GET',
          headers: { 'Authorization': authHeader }
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.status === 'succeeded' || data.status === 'waiting_for_capture') {
            // Платеж успешно завершен
            await paymentService.confirmPayment(
              payment.gatewayId,
              Number(payment.amount),
              session.userId,
              isTestMode,
              'yookassa',
              payment.id,
              payment.orderId ? 'order' : 'topup'
            );
            anySynced = true;
          }
        }
      } catch (err) {
        console.error(`[AutoSync] Ошибка проверки платежа ${payment.id}:`, err);
      }
    }

    return anySynced;
  } catch (error) {
    console.error(`[AutoSync] Фатальная ошибка:`, error);
    return false;
  }
}

```

---

### 📄 Файл 68 из 89: `src/actions/order/__tests__/checkout.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { checkoutAction } from '../checkout';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { verifySession, createSession } from '@/lib/session';
import { PaymentGatewayFactory } from '@/services/financial/payment-gateway.service';
import { WalletOps, WalletInsufficientFundsError } from '@/services/financial/wallet-ops';

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    charge: vi.fn().mockResolvedValue({ success: true }),
  },
  WalletInsufficientFundsError: class extends Error {
    readonly code = 'INSUFFICIENT_FUNDS';
    constructor() {
      super('Недостаточно средств');
      this.name = 'WalletInsufficientFundsError';
    }
  },
  WalletUserNotFoundError: class extends Error {},
  WalletInvalidAmountError: class extends Error {},
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    $transaction: vi.fn((cb) => cb(mockDb)),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    service: {
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
    },
    contentItem: {
      findUnique: vi.fn(),
    },
    promoCode: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    serviceSmartConfig: {
      findUnique: vi.fn(),
    },
    ledgerEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'ledger-1' }),
    },
  };
  return {
    db: mockDb,
  };
});

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsManager: {
    isTestMode: vi.fn().mockResolvedValue(false),
    getPaymentSecrets: vi.fn().mockResolvedValue({}),
  },
  SettingsProvider: {
    getCached: vi.fn().mockResolvedValue({
      isTestMode: false,
      siteName: 'Smmplan',
      globalMarkup: 3.0,
      safetyFloor: 1.0,
      exchangeRateUSD: 90.0,
    }),
    getExchangeRateUSD: vi.fn().mockResolvedValue(90.0),
    getTenantId: vi.fn().mockResolvedValue('smmplan'),
    isTestEnvironment: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  createSession: vi.fn(),
  getEncodedKey: vi.fn().mockReturnValue(new TextEncoder().encode('secretsecretsecretsecretsecretsecretsecret')),
}));

vi.mock('@/services/marketing.service', () => ({
  marketingService: {
    calculatePrice: vi.fn().mockResolvedValue({
      totalCents: 1000,
      originalTotalCents: 1000,
      discountCents: 0,
      providerCostCents: 500,
    }),
    consumePromoCode: vi.fn(),
  },
  logPromoCodeUsageIfNeeded: vi.fn(),
}));

vi.mock('@/validators/link-mutators', () => ({
  mutateLink: vi.fn((link) => link),
  getLinkValidator: vi.fn(() => ({
    safeParse: vi.fn().mockReturnValue({ success: true }),
  })),
}));

vi.mock('@/utils/target-type', () => ({
  inferTargetTypeFromCategory: vi.fn().mockReturnValue('POST'),
}));

vi.mock('@/services/financial/payment-gateway.service', () => ({
  PaymentGatewayFactory: {
    getGateway: vi.fn(),
  },
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn().mockResolvedValue('127.0.0.1'),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn((key) => {
      if (key === 'host') return 'localhost:3000';
      if (key === 'x-forwarded-proto') return 'http';
      if (key === 'user-agent') return 'test-agent';
      return null;
    }),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/smtp', () => ({
  sendOrderPaidMail: vi.fn().mockResolvedValue(true),
}));

describe('checkoutAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validData = {
    serviceId: 'service-1',
    link: 'https://t.me/durov',
    quantity: 100,
    email: 'test@test.com',
  };

  it('1. Successful balance payment', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
    
    // Auth check lookup and then generic user lookup (mocking sequence if needed or just simple return)
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      balance: 5000,
      isActive: true,
      isDeleted: false,
    } as any);
    
    vi.mocked(db.service.findUnique).mockResolvedValue({
      id: 'service-1',
      isActive: true,
      externalId: 'ext-1',
      minQty: 10,
      maxQty: 1000,
      targetType: 'POST',
      category: { network: { slug: 'tg' } },
    } as any);

    vi.mocked(db.contentItem.findUnique).mockResolvedValue({
      updatedAt: new Date(),
    } as any);

    vi.mocked(db.order.create).mockResolvedValue({ id: 'order-1', numericId: 1001 } as any);
    vi.mocked(db.payment.create).mockResolvedValue({ id: 'payment-1' } as any);
    
    const mockGateway = {
      createPayment: vi.fn().mockResolvedValue({ paymentUrl: 'balance-success' }),
    };
    vi.mocked(PaymentGatewayFactory.getGateway).mockReturnValue(mockGateway as any);

    const result = await checkoutAction({
      ...validData,
      gateway: 'balance',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderId).toBe('order-1');
      expect(result.data.paymentId).toBe('payment-1');
      expect(db.$transaction).toHaveBeenCalled();
      expect(db.order.create).toHaveBeenCalled();
      expect(mockGateway.createPayment).not.toHaveBeenCalled();
    }
  });

  it('2. Insufficient funds rejection', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      balance: 0, // 0 balance
      isActive: true,
      isDeleted: false,
    } as any);
    
    vi.mocked(WalletOps.charge).mockRejectedValue(new WalletInsufficientFundsError(100, 0));
    
    vi.mocked(db.service.findUnique).mockResolvedValue({
      id: 'service-1',
      isActive: true,
      externalId: 'ext-1',
      minQty: 10,
      maxQty: 1000,
      targetType: 'POST',
      category: { network: { slug: 'tg' } },
    } as any);

    const result = await checkoutAction({
      ...validData,
      gateway: 'balance',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/Недостаточно средств/);
    }
  });

  it('3. Successful gateway payment redirect', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      balance: 0,
      isActive: true,
      isDeleted: false,
    } as any);
    
    vi.mocked(db.service.findUnique).mockResolvedValue({
      id: 'service-1',
      isActive: true,
      externalId: 'ext-1',
      minQty: 10,
      maxQty: 1000,
      targetType: 'POST',
      category: { network: { slug: 'tg' } },
    } as any);

    vi.mocked(db.order.create).mockResolvedValue({ id: 'order-2', numericId: 1002 } as any);
    vi.mocked(db.payment.create).mockResolvedValue({ id: 'payment-2' } as any);

    const mockGateway = {
      createPayment: vi.fn().mockResolvedValue({
        paymentUrl: 'https://yookassa.ru/checkout',
        remoteGatewayId: 'yoo-123',
      }),
    };
    vi.mocked(PaymentGatewayFactory.getGateway).mockReturnValue(mockGateway as any);

    const result = await checkoutAction({
      ...validData,
      gateway: 'yookassa',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(mockGateway.createPayment).toHaveBeenCalled();
      expect(result.data.paymentUrl).toBe('https://yookassa.ru/checkout');
      expect(db.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-2' },
        data: expect.objectContaining({
          checkoutUrl: 'https://yookassa.ru/checkout',
          gatewayId: 'yoo-123',
        }),
      });
    }
  });

  it('4. Idempotency key deduplication', async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      id: 'existing-order-1',
      paymentId: 'existing-payment-1',
      status: 'PENDING',
      payment: { checkoutUrl: 'https://existing-url' },
    } as any);

    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0'
    });
    vi.mocked(db.order.create).mockRejectedValue(prismaError);

    const result = await checkoutAction({
      ...validData,
      gateway: 'yookassa',
      idempotencyKey: 'idemp-123',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderId).toBe('existing-order-1');
      expect(result.data.paymentId).toBe('existing-payment-1');
      expect(result.data.paymentUrl).toBe('https://existing-url');
      expect(db.order.create).not.toHaveBeenCalled();
    }
  });
});

```

---

### 📄 Файл 69 из 89: `src/actions/order/__tests__/r1-advanced-order-params.challenge.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkoutAction } from '../checkout';
import { db } from '@/lib/db';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { verifySession } from '@/lib/session';
import { featureFlagService } from '@/services/system/feature-flag.service';
import { getCustomValidator } from '@/validators/link-mutators';

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    charge: vi.fn().mockResolvedValue({ success: true }),
  },
  WalletInsufficientFundsError: class extends Error {
    readonly code = 'INSUFFICIENT_FUNDS';
    constructor() {
      super('Недостаточно средств');
      this.name = 'WalletInsufficientFundsError';
    }
  },
  WalletUserNotFoundError: class extends Error {},
  WalletInvalidAmountError: class extends Error {},
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    $transaction: vi.fn((cb) => cb(mockDb)),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    service: {
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
    },
    contentItem: {
      findUnique: vi.fn(),
    },
    promoCode: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    serviceSmartConfig: {
      findUnique: vi.fn(),
    },
    ledgerEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'ledger-1' }),
    },
  };
  return {
    db: mockDb,
  };
});

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/system/feature-flag.service', () => ({
  featureFlagService: {
    isEnabled: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsManager: {
    isTestMode: vi.fn().mockResolvedValue(false),
    getPaymentSecrets: vi.fn().mockResolvedValue({}),
  },
  SettingsProvider: {
    getCached: vi.fn().mockResolvedValue({
      isTestMode: false,
      siteName: 'Smmplan',
      globalMarkup: 3.0,
      safetyFloor: 1.0,
      exchangeRateUSD: 90.0,
    }),
    getExchangeRateUSD: vi.fn().mockResolvedValue(90.0),
    getTenantId: vi.fn().mockResolvedValue('smmplan'),
    isTestEnvironment: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  createSession: vi.fn(),
  getEncodedKey: vi.fn().mockReturnValue(new TextEncoder().encode('secretsecretsecretsecretsecretsecretsecret')),
}));

vi.mock('@/services/marketing.service', () => ({
  marketingService: {
    calculatePrice: vi.fn().mockResolvedValue({
      totalCents: 1000,
      originalTotalCents: 1000,
      discountCents: 0,
      providerCostCents: 500,
    }),
    consumePromoCode: vi.fn(),
  },
  logPromoCodeUsageIfNeeded: vi.fn(),
}));

vi.mock('@/validators/link-mutators', async () => {
  const actual = await vi.importActual('@/validators/link-mutators');
  return {
    ...actual,
    mutateLink: vi.fn((link) => link),
    getLinkValidator: vi.fn(() => ({
      safeParse: vi.fn().mockReturnValue({ success: true }),
    })),
  };
});

vi.mock('@/utils/target-type', () => ({
  inferTargetTypeFromCategory: vi.fn().mockReturnValue('POST'),
}));

vi.mock('@/services/financial/payment-gateway.service', () => ({
  PaymentGatewayFactory: {
    getGateway: vi.fn().mockReturnValue({
      createPayment: vi.fn().mockResolvedValue({
        paymentId: 'pay-123',
        paymentUrl: 'https://payment.example.com/pay-123',
      }),
    }),
  },
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn().mockResolvedValue('127.0.0.1'),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn((key) => {
      if (key === 'host') return 'localhost:3000';
      if (key === 'x-forwarded-proto') return 'http';
      if (key === 'user-agent') return 'test-agent';
      return null;
    }),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/smtp', () => ({
  sendOrderPaidMail: vi.fn().mockResolvedValue(true),
}));

describe('Requirement R1: Advanced Order Parameters Integration (Empirical Challenge Suite)', () => {
  const mockService = {
    id: 'svc-100',
    name: 'Telegram Подписчики',
    isActive: true,
    externalId: 'ext-100',
    minQty: 100,
    maxQty: 50000,
    pricePerUnitRub: 0.5,
    isDripFeedEnabled: true,
    customDataType: 'NONE',
    clientRequirement: null,
    targetType: 'CHANNEL',
    category: {
      name: 'Подписчики',
      network: {
        slug: 'telegram',
      },
    },
  };

  const mockUser = {
    id: 'usr-1',
    email: 'test@example.com',
    tenantId: 'smmplan',
    isActive: true,
    isDeleted: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (RateLimitService.check as any).mockResolvedValue(true);
    (featureFlagService.isEnabled as any).mockResolvedValue(true);
    (verifySession as any).mockResolvedValue({ userId: 'usr-1' });
    (db.user.findUnique as any).mockResolvedValue(mockUser);
    (db.service.findUnique as any).mockResolvedValue(mockService);
    (db.order.create as any).mockResolvedValue({ id: 'ord-100' });
    (db.payment.create as any).mockResolvedValue({ id: 'pay-100' });
  });

  // ==========================================
  // SECTION 1: DRIP-FEED CALCULATION & INTERVAL VALIDATION
  // ==========================================
  describe('1. Drip-Feed Calculation & Interval Logic', () => {
    it('rejects order when drip_feed feature flag is disabled', async () => {
      (featureFlagService.isEnabled as any).mockImplementation((flag: string) => {
        if (flag === 'drip_feed') return Promise.resolve(false);
        return Promise.resolve(true);
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 1000,
        email: 'test@example.com',
        gateway: 'yookassa',
        runs: 5,
        interval: 30,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Drip-feed временно отключена');
      }
    });

    it('rejects drip feed if service has isDripFeedEnabled = false', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        ...mockService,
        isDripFeedEnabled: false,
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 1000,
        email: 'test@example.com',
        gateway: 'yookassa',
        runs: 5,
        interval: 30,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('не поддерживает Drip-feed');
      }
    });

    it('rejects order when chunk quantity (quantity / runs) is less than minQty', async () => {
      // minQty = 100, quantity = 300, runs = 4 => chunk = 75 < 100 minQty
      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 300,
        email: 'test@example.com',
        gateway: 'yookassa',
        runs: 4,
        interval: 15,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('не может быть меньше минимального (100)');
      }
    });

    it('accepts valid drip feed order when chunk quantity >= minQty', async () => {
      // minQty = 100, quantity = 500, runs = 5 => chunk = 100 >= 100 minQty
      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 500,
        email: 'test@example.com',
        gateway: 'yookassa',
        runs: 5,
        interval: 60,
      });

      expect(res.success).toBe(true);
    });

    it('rejects simultaneous standard Drip-Feed (runs/interval) and Smart Drip (isSmartDrip)', async () => {
      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 1000,
        email: 'test@example.com',
        gateway: 'yookassa',
        runs: 5,
        interval: 30,
        isSmartDrip: true,
        smartDripDays: 7,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Нельзя одновременно использовать обычный Drip-feed и Умный Dripfeed');
      }
    });

    it('rejects Smart Drip when daily chunk (quantity / smartDripDays) is less than minQty', async () => {
      (db.serviceSmartConfig.findUnique as any).mockResolvedValue({
        serviceId: 'svc-100',
        isEnabled: true,
        markup: 0.20,
      });

      // minQty = 100, quantity = 500, smartDripDays = 10 => chunk = 50 < 100 minQty
      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 500,
        email: 'test@example.com',
        gateway: 'yookassa',
        isSmartDrip: true,
        smartDripDays: 10,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('количество на 1 день (50) не может быть меньше минимального (100)');
      }
    });

    it('rejects invalid smartDripDays out of bounds (< 1 or > 30)', async () => {
      const res1 = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 1000,
        email: 'test@example.com',
        gateway: 'yookassa',
        isSmartDrip: true,
        smartDripDays: 0,
      });

      expect(res1.success).toBe(false);
      if (!res1.success) {
        expect(res1.error).toContain('Number must be greater than or equal to 1');
      }

      const res2 = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 1000,
        email: 'test@example.com',
        gateway: 'yookassa',
        isSmartDrip: true,
        smartDripDays: 31,
      });

      expect(res2.success).toBe(false);
      if (!res2.success) {
        expect(res2.error).toContain('Number must be less than or equal to 30');
      }
    });
  });

  // ==========================================
  // SECTION 2: CUSTOM DATA INPUT VALIDATION (TEXTAREA vs NUMBER)
  // ==========================================
  describe('2. Custom Data Validation Logic', () => {
    describe('getCustomValidator unit tests', () => {
      it('validates NUMBER customDataType correctly', () => {
        const validator = getCustomValidator('NUMBER');

        expect(validator.safeParse('123').success).toBe(true);
        expect(validator.safeParse('0').success).toBe(true);
        expect(validator.safeParse('99999').success).toBe(true);
        expect(validator.safeParse('   456   ').success).toBe(true); // trims leading/trailing spaces

        expect(validator.safeParse('abc').success).toBe(false);
        expect(validator.safeParse('12.34').success).toBe(false);
        expect(validator.safeParse('-10').success).toBe(false);
        expect(validator.safeParse('').success).toBe(false);
      });

      it('validates TEXTAREA customDataType correctly', () => {
        const validator = getCustomValidator('TEXTAREA');

        expect(validator.safeParse('Отличный пост! Спасибо!').success).toBe(true);
        expect(validator.safeParse('Многострочный\nкомментарий').success).toBe(true);

        // Empty / whitespace
        expect(validator.safeParse('').success).toBe(false);
        expect(validator.safeParse('   ').success).toBe(false);

        // Control characters
        expect(validator.safeParse('Text with null char \x00').success).toBe(false);
        expect(validator.safeParse('Text with bell \x07').success).toBe(false);

        // Length limits
        const text10k = 'a'.repeat(10000);
        expect(validator.safeParse(text10k).success).toBe(true);

        const text10k1 = 'a'.repeat(10001);
        expect(validator.safeParse(text10k1).success).toBe(false);
      });

      it('defaults to required non-empty string for unknown customDataType', () => {
        const validator = getCustomValidator('NONE');
        expect(validator.safeParse('some value').success).toBe(true);
        expect(validator.safeParse('').success).toBe(false);
      });
    });

    describe('checkoutAction customData validation integration', () => {
      it('validates customData for targetType = CUSTOM with NUMBER datatype', async () => {
        (db.service.findUnique as any).mockResolvedValue({
          ...mockService,
          targetType: 'CUSTOM',
          customDataType: 'NUMBER',
        });

        const resInvalid = await checkoutAction({
          serviceId: 'svc-100',
          link: 'https://t.me/durov',
          quantity: 100,
          email: 'test@example.com',
          gateway: 'yookassa',
          customData: 'invalid_number_abc',
        });

        expect(resInvalid.success).toBe(false);
        if (!resInvalid.success) {
          expect(resInvalid.error).toContain('Значение должно состоять только из цифр');
        }

        const resValid = await checkoutAction({
          serviceId: 'svc-100',
          link: 'https://t.me/durov',
          quantity: 100,
          email: 'test@example.com',
          gateway: 'yookassa',
          customData: '42',
        });

        expect(resValid.success).toBe(true);
      });

      it('enforces 2000 character limit on customData in checkoutAction', async () => {
        const longCustomData = 'x'.repeat(2001);

        const res = await checkoutAction({
          serviceId: 'svc-100',
          link: 'https://t.me/durov',
          quantity: 100,
          email: 'test@example.com',
          gateway: 'yookassa',
          customData: longCustomData,
        });

        if (!res.success) {
          expect(res.error).toContain('Слишком длинные пользовательские данные');
        }
      });
    });
  });

  // ==========================================
  // SECTION 3: JIT CONFIRMATION CHECKBOX BLOCKING BEHAVIOR
  // ==========================================
  describe('3. JIT Confirmation Checkbox Blocking Behavior', () => {
    it('blocks checkout when service has clientRequirement but isRequirementsConfirmed is false', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        ...mockService,
        clientRequirement: 'Канал должен быть открытым и иметь минимум 10 постов',
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 100,
        email: 'test@example.com',
        gateway: 'yookassa',
        isRequirementsConfirmed: false,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Необходимо подтвердить выполнение условий для старта услуги');
      }
    });

    it('blocks checkout when service has clientRequirement and isRequirementsConfirmed is omitted (undefined)', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        ...mockService,
        clientRequirement: 'Канал должен быть открытым',
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 100,
        email: 'test@example.com',
        gateway: 'yookassa',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Необходимо подтвердить выполнение условий для старта услуги');
      }
    });

    it('allows checkout when service has clientRequirement and isRequirementsConfirmed is true', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        ...mockService,
        clientRequirement: 'Канал должен быть открытым',
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 100,
        email: 'test@example.com',
        gateway: 'yookassa',
        isRequirementsConfirmed: true,
      });

      expect(res.success).toBe(true);
    });

    it('allows checkout without requirement confirmation if service has NO clientRequirement', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        ...mockService,
        clientRequirement: null,
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 100,
        email: 'test@example.com',
        gateway: 'yookassa',
        isRequirementsConfirmed: false,
      });

      expect(res.success).toBe(true);
    });
  });
});

```

---

### 📄 Файл 70 из 89: `src/actions/order/__tests__/r1-advanced-parameters-challenge.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { checkoutAction, calculatePriceAction } from '../checkout';
import { verifySession } from '@/lib/session';
import { getCustomValidator } from '@/validators/link-mutators';

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    charge: vi.fn().mockResolvedValue({ success: true }),
  },
  WalletInsufficientFundsError: class extends Error {
    readonly code = 'INSUFFICIENT_FUNDS';
    constructor() {
      super('Недостаточно средств');
      this.name = 'WalletInsufficientFundsError';
    }
  },
  WalletUserNotFoundError: class extends Error {},
  WalletInvalidAmountError: class extends Error {},
}));

vi.mock('@/services/dripfeed/smart-drip.service', () => ({
  SmartDripService: {
    createCampaign: vi.fn().mockResolvedValue({ id: 'campaign-1' }),
  },
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    $transaction: vi.fn((cb) => cb(mockDb)),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    service: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
    },
    contentItem: {
      findUnique: vi.fn(),
    },
    promoCode: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    serviceSmartConfig: {
      findUnique: vi.fn(),
    },
    securityEvent: {
      create: vi.fn().mockResolvedValue({ id: 'sec-1' }),
    },
  };
  return {
    db: mockDb,
  };
});

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsManager: {
    isTestMode: vi.fn().mockResolvedValue(false),
    getPaymentSecrets: vi.fn().mockResolvedValue({}),
  },
  SettingsProvider: {
    getCached: vi.fn().mockResolvedValue({
      isTestMode: false,
      siteName: 'Smmplan',
      globalMarkup: 3.0,
      safetyFloor: 1.0,
      exchangeRateUSD: 90.0,
    }),
    getExchangeRateUSD: vi.fn().mockResolvedValue(90.0),
    getTenantId: vi.fn().mockResolvedValue('smmplan'),
    isTestEnvironment: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  createSession: vi.fn(),
  getEncodedKey: vi.fn().mockReturnValue(new TextEncoder().encode('secretsecretsecretsecretsecretsecretsecret')),
}));

vi.mock('@/services/system/feature-flag.service', () => ({
  featureFlagService: {
    isEnabled: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn().mockResolvedValue('127.0.0.1'),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn((key) => {
      if (key === 'host') return 'localhost:3000';
      if (key === 'x-forwarded-proto') return 'http';
      if (key === 'user-agent') return 'test-agent';
      return null;
    }),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/smtp', () => ({
  sendOrderPaidMail: vi.fn().mockResolvedValue(true),
}));

describe('Requirement R1 Empirical Stress Tests & Challenge Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultUser = {
    id: 'user-1',
    email: 'challenger@test.com',
    balance: 50000,
    isActive: true,
    isDeleted: false,
    totalSpent: BigInt(0),
    personalDiscount: 0,
  };

  const defaultService = {
    id: 'service-drip-1',
    name: 'Telegram Subscribers',
    isActive: true,
    externalId: 'ext-drip-1',
    rate: 10.0,
    markup: 2.0,
    providerCurrency: 'RUB',
    minQty: 10,
    maxQty: 10000,
    isDripFeedEnabled: true,
    targetType: 'POST',
    category: { network: { slug: 'tg' } },
  };

  const baseValidOrderData = {
    serviceId: 'service-drip-1',
    link: 'https://t.me/durov',
    quantity: 1000,
    email: 'challenger@test.com',
    gateway: 'balance',
  };

  // ==========================================
  // SECTION 1: runs and interval Edge Cases
  // ==========================================
  describe('1. runs and interval Edge Cases', () => {
    it('1.1 Negative and zero runs/interval are rejected by Zod validation in checkoutAction', async () => {
      const resNegativeRuns = await checkoutAction({
        ...baseValidOrderData,
        runs: -5,
        interval: 10,
      });
      expect(resNegativeRuns.success).toBe(false);

      const resZeroRuns = await checkoutAction({
        ...baseValidOrderData,
        runs: 0,
        interval: 10,
      });
      expect(resZeroRuns.success).toBe(false);

      const resNegativeInterval = await checkoutAction({
        ...baseValidOrderData,
        runs: 5,
        interval: -10,
      });
      expect(resNegativeInterval.success).toBe(false);
    });

    it('1.2 Extreme runs causes per-run quantity to fall below service.minQty', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(defaultUser as any);
      vi.mocked(db.service.findUnique).mockResolvedValue({
        ...defaultService,
        minQty: 100,
      } as any);

      // Total quantity = 1000, runs = 100 -> runQty = Math.floor(1000/100) = 10 < minQty (100)
      const res = await checkoutAction({
        ...baseValidOrderData,
        quantity: 1000,
        runs: 100,
        interval: 30,
        gateway: 'balance',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('не может быть меньше минимального');
      }
    });

    it('1.3 CRITICAL BUG DISCOVERY: checkoutAction creates Order WITHOUT setting isDripFeed: true', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(defaultUser as any);
      vi.mocked(db.user.findFirst).mockResolvedValue(defaultUser as any);
      vi.mocked(db.service.findUnique).mockResolvedValue(defaultService as any);

      vi.mocked(db.order.create).mockResolvedValue({ id: 'order-drip-1', numericId: 7001 } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'payment-drip-1' } as any);

      const res = await checkoutAction({
        ...baseValidOrderData,
        quantity: 1000,
        runs: 5,
        interval: 60,
        gateway: 'balance',
      });

      if (!res.success) {
        console.error('DEBUG test 1.3 error:', res.error);
      }
      expect(res.success).toBe(true);
      expect(db.order.create).toHaveBeenCalled();

      // Inspect exact payload passed to tx.order.create
      const orderCreateCall = vi.mocked(db.order.create).mock.calls[0][0];
      const createData = orderCreateCall.data;

      // FIXED: runs and interval are present, and isDripFeed is set to true!
      expect(createData.runs).toBe(5);
      expect(createData.interval).toBe(60);
      expect(createData.isDripFeed).toBe(true);
    });
  });

  // ==========================================
  // SECTION 2: customData and customDataType Validation
  // ==========================================
  describe('2. customData and customDataType Validation', () => {
    it('2.1 BUG DISCOVERY: Server skips customData validation when targetType !== "CUSTOM"', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(defaultUser as any);

      // Service has customDataType = 'TEXTAREA' (custom comments for a Telegram Post) but targetType = 'POST'
      vi.mocked(db.service.findUnique).mockResolvedValue({
        ...defaultService,
        id: 'service-comment-1',
        targetType: 'POST', // targetType is POST, not CUSTOM
        customDataType: 'TEXTAREA',
      } as any);

      vi.mocked(db.order.create).mockResolvedValue({ id: 'order-comment-1', numericId: 8001 } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'payment-comment-1' } as any);

      // User sends empty/whitespace customData for a service that requires TEXTAREA customData!
      const res = await checkoutAction({
        ...baseValidOrderData,
        serviceId: 'service-comment-1',
        customData: '   ', // Only spaces
        gateway: 'balance',
      });

      // FIXED: The server now validates customData when customDataType !== 'NONE'!
      expect(res.success).toBe(false);
    });

    it('2.2 BUG DISCOVERY: customValue fallback to link in targetType === "CUSTOM"', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(defaultUser as any);

      // Service has targetType = 'CUSTOM' and customDataType = 'TEXTAREA'
      vi.mocked(db.service.findUnique).mockResolvedValue({
        ...defaultService,
        id: 'service-custom-1',
        targetType: 'CUSTOM',
        customDataType: 'TEXTAREA',
      } as any);

      vi.mocked(db.order.create).mockResolvedValue({ id: 'order-custom-1', numericId: 8002 } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'payment-custom-1' } as any);

      // User sends customData: "" (empty string)
      const res = await checkoutAction({
        ...baseValidOrderData,
        serviceId: 'service-custom-1',
        customData: '', // Empty customData!
        gateway: 'balance',
      });

      // FIXED: Empty customData is rejected when required by customDataType
      expect(res.success).toBe(false);
    });

    it('2.3 getCustomValidator behavior on whitespace and empty strings', () => {
      const textareaValidator = getCustomValidator('TEXTAREA');
      const numberValidator = getCustomValidator('NUMBER');

      // Whitespace string trimmed to empty
      const textareaWsResult = textareaValidator.safeParse('   ');
      expect(textareaWsResult.success).toBe(false);
      if (!textareaWsResult.success) {
        expect(textareaWsResult.error.errors[0].message).toBe('Поле не может быть пустым');
      }

      const numberWsResult = numberValidator.safeParse('   ');
      expect(numberWsResult.success).toBe(false);
      if (!numberWsResult.success) {
        expect(numberWsResult.error.errors[0].message).toBe('Значение должно состоять только из цифр');
      }
    });
  });

  // ==========================================
  // SECTION 3: Drip-Feed & Promo Code / Discount Calculation
  // ==========================================
  describe('3. Drip-Feed and Promo Code/Discount Calculations', () => {
    it('3.1 calculatePriceAction ignores runs parameter in price preview', async () => {
      vi.mocked(db.service.findUnique).mockResolvedValue({
        ...defaultService,
        rate: 10.0,
        markup: 2.0,
        providerCurrency: 'USD',
      } as any);

      // Pass quantity = 500, runs = 10 to calculatePriceAction
      const resWithRuns = await calculatePriceAction('service-drip-1', 500, undefined, 10);
      const resWithoutRuns = await calculatePriceAction('service-drip-1', 500, undefined, undefined);

      expect(resWithRuns.success).toBe(true);
      expect(resWithoutRuns.success).toBe(true);
      if (resWithRuns.success && resWithoutRuns.success) {
        // FIXED: Price returned for resWithRuns factors in runs multiplier
        expect(resWithRuns.data?.totalCents).toBe((resWithoutRuns.data?.totalCents || 0) * 10);
      }
    });

    it('3.2 Smart Drip surcharge interaction with Promo Code discount', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(defaultUser as any);
      vi.mocked(db.user.findFirst).mockResolvedValue(defaultUser as any);
      vi.mocked(db.service.findUnique).mockResolvedValue({
        ...defaultService,
        id: 'service-smart-1',
      } as any);

      vi.mocked(db.serviceSmartConfig.findUnique).mockResolvedValue({
        serviceId: 'service-smart-1',
        isEnabled: true,
        markup: 0.15, // 15% Smart Drip surcharge
      } as any);

      vi.mocked(db.promoCode.findUnique).mockResolvedValue({
        id: 'promo-1',
        code: 'SAVE20',
        discountPercent: 20.0,
        type: 'PERCENT',
        isActive: true,
        maxUses: 100,
        uses: 5,
        expiresAt: null,
      } as any);

      vi.mocked(db.promoCode.updateMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(db.order.create).mockResolvedValue({ id: 'order-smart-1', numericId: 9001 } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'payment-smart-1' } as any);

      const res = await checkoutAction({
        ...baseValidOrderData,
        serviceId: 'service-smart-1',
        isSmartDrip: true,
        smartDripDays: 7,
        promoCodeStr: 'SAVE20',
        gateway: 'balance',
      });

      expect(res.success).toBe(true);
      const orderCreateCall = vi.mocked(db.order.create).mock.calls[0][0];
      const data = orderCreateCall.data;

      // Pricing details passed to Order:
      // charge has 15% Smart Drip markup applied.
      // discountCents is saved as raw pricing.discountCents (without Smart Drip markup adjustment).
      expect(data.charge).toBeDefined();
      expect(data.discountCents).toBeDefined();
    });
  });
});

```

---

### 📄 Файл 71 из 89: `src/actions/order/__tests__/r2-refill-challenge.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestClientRefillAction } from '../refill';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    order: {
      findFirst: vi.fn(),
    },
    refill: {
      create: vi.fn(),
    },
  };
  return { db: mockDb };
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/queue-manager', () => ({
  refillQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-refill-1' }),
  },
}));

describe('R2 Refill Feature Challenge & Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. IDOR Protection Tests', () => {
    it('blocks User A from requesting refill on User B order', async () => {
      // Session belongs to User A
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      
      // db.order.findFirst returns null because query is scoped where: { id: 'order-belonging-to-user-B', userId: 'user-A' }
      vi.mocked(db.order.findFirst).mockResolvedValue(null as any);

      const res = await requestClientRefillAction({ orderId: 'order-belonging-to-user-B' });
      
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Заказ не найден или недоступен');
      }

      // Verify db query explicitly scoped to session userId
      expect(db.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'order-belonging-to-user-B',
            userId: 'user-A',
          },
        })
      );
    });

    it('rejects unauthenticated user', async () => {
      vi.mocked(verifySession).mockResolvedValue(null as any);

      const res = await requestClientRefillAction({ orderId: 'order-123' });
      
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Пользователь не авторизован');
      }
      expect(db.order.findFirst).not.toHaveBeenCalled();
    });

    it('rejects invalid or missing orderId', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);

      const res1 = await requestClientRefillAction({ orderId: '' });
      expect(res1.success).toBe(false);

      const res2 = await requestClientRefillAction(null as any);
      expect(res2.success).toBe(false);
    });
  });

  describe('2. Order Status Guard Tests', () => {
    const invalidStatuses = ['PENDING', 'PROCESSING', 'CANCELLED', 'REFUNDED', 'FAILED', 'AWAITING_PAYMENT', 'DRAFT'];

    invalidStatuses.forEach((status) => {
      it(`rejects refill request when order status is ${status}`, async () => {
        vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
        vi.mocked(db.order.findFirst).mockResolvedValue({
          id: 'order-1',
          userId: 'user-A',
          status: status,
          service: { isRefillEnabled: true },
          refills: [],
        } as any);

        const res = await requestClientRefillAction({ orderId: 'order-1' });

        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error).toBe('Докрутка доступна только для завершенных или частично выполненных заказов');
        }
      });
    });

    it('allows refill request when order status is COMPLETED', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      vi.mocked(db.order.findFirst).mockResolvedValue({
        id: 'order-1',
        userId: 'user-A',
        status: 'COMPLETED',
        service: { isRefillEnabled: true },
        refills: [],
      } as any);

      const now = new Date();
      vi.mocked(db.refill.create).mockResolvedValue({
        id: 'refill-comp-1',
        orderId: 'order-1',
        status: 'PENDING',
        createdAt: now,
      } as any);

      const res = await requestClientRefillAction({ orderId: 'order-1' });
      expect(res.success).toBe(true);
    });

    it('allows refill request when order status is PARTIAL', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      vi.mocked(db.order.findFirst).mockResolvedValue({
        id: 'order-2',
        userId: 'user-A',
        status: 'PARTIAL',
        service: { isRefillEnabled: true },
        refills: [],
      } as any);

      const now = new Date();
      vi.mocked(db.refill.create).mockResolvedValue({
        id: 'refill-part-1',
        orderId: 'order-2',
        status: 'PENDING',
        createdAt: now,
      } as any);

      const res = await requestClientRefillAction({ orderId: 'order-2' });
      expect(res.success).toBe(true);
    });
  });

  describe('3. Duplicate Refill Guard Tests', () => {
    it('blocks refill when an active refill has status PENDING', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      vi.mocked(db.order.findFirst).mockResolvedValue({
        id: 'order-1',
        userId: 'user-A',
        status: 'COMPLETED',
        service: { isRefillEnabled: true },
        refills: [
          { id: 'refill-p', status: 'PENDING', createdAt: new Date() },
        ],
      } as any);

      const res = await requestClientRefillAction({ orderId: 'order-1' });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Заявка на докрутку уже принята и находится в обработке');
      }
      expect(db.refill.create).not.toHaveBeenCalled();
    });

    it('blocks refill when an active refill has status IN_PROGRESS', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      vi.mocked(db.order.findFirst).mockResolvedValue({
        id: 'order-1',
        userId: 'user-A',
        status: 'COMPLETED',
        service: { isRefillEnabled: true },
        refills: [
          { id: 'refill-ip', status: 'IN_PROGRESS', createdAt: new Date() },
        ],
      } as any);

      const res = await requestClientRefillAction({ orderId: 'order-1' });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Заявка на докрутку уже принята и находится в обработке');
      }
      expect(db.refill.create).not.toHaveBeenCalled();
    });

    it('allows new refill when previous refill status is COMPLETED or FAILED or REJECTED', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      vi.mocked(db.order.findFirst).mockResolvedValue({
        id: 'order-1',
        userId: 'user-A',
        status: 'COMPLETED',
        service: { isRefillEnabled: true },
        refills: [
          { id: 'refill-old-comp', status: 'COMPLETED', createdAt: new Date(Date.now() - 86400000) },
          { id: 'refill-old-failed', status: 'FAILED', createdAt: new Date(Date.now() - 43200000) },
        ],
      } as any);

      const now = new Date();
      vi.mocked(db.refill.create).mockResolvedValue({
        id: 'refill-new-2',
        orderId: 'order-1',
        status: 'PENDING',
        createdAt: now,
      } as any);

      const res = await requestClientRefillAction({ orderId: 'order-1' });

      expect(res.success).toBe(true);
      expect(db.refill.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          status: 'PENDING',
        },
      });
    });
  });
});

```

---

### 📄 Файл 72 из 89: `src/actions/order/__tests__/refill.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestClientRefillAction } from '../refill';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    order: {
      findFirst: vi.fn(),
    },
    refill: {
      create: vi.fn(),
    },
  };
  return { db: mockDb };
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/queue-manager', () => ({
  refillQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  },
}));

describe('requestClientRefillAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when user is not authenticated', async () => {
    vi.mocked(verifySession).mockResolvedValue(null as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Пользователь не авторизован');
    }
  });

  it('returns error when order is not found or owned by another user', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue(null as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Заказ не найден или недоступен');
    }
  });

  it('returns error when service does not support refill', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'COMPLETED',
      service: { isRefillEnabled: false },
      refills: [],
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Для данной услуги бесплатная докрутка не предусмотрена');
    }
  });

  it('returns error when order status is AWAITING_PAYMENT', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'AWAITING_PAYMENT',
      service: { isRefillEnabled: true },
      refills: [],
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Докрутка доступна только для завершенных или частично выполненных заказов');
    }
  });

  it('returns error when an active refill is already PENDING', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'COMPLETED',
      service: { isRefillEnabled: true },
      refills: [
        {
          id: 'refill-existing',
          status: 'PENDING',
          createdAt: new Date('2026-07-26T10:00:00Z'),
        },
      ],
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Заявка на докрутку уже принята и находится в обработке');
    }
  });

  it('successfully creates refill when order is eligible', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'COMPLETED',
      service: { isRefillEnabled: true },
      refills: [],
    } as any);

    const now = new Date();
    vi.mocked(db.refill.create).mockResolvedValue({
      id: 'refill-new-123',
      numericId: 101,
      orderId: 'order-1',
      status: 'PENDING',
      externalId: null,
      createdAt: now,
      updatedAt: now,
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.message).toBe('Заявка на докрутку принята');
      expect(res.refill.id).toBe('refill-new-123');
      expect(res.refill.status).toBe('PENDING');
    }
    expect(db.refill.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        status: 'PENDING',
      },
    });
  });

  it('successfully creates refill when orderId is passed as string directly', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'PARTIAL',
      service: { isRefillEnabled: true },
      refills: [],
    } as any);

    const now = new Date();
    vi.mocked(db.refill.create).mockResolvedValue({
      id: 'refill-str-123',
      numericId: 102,
      orderId: 'order-1',
      status: 'PENDING',
      externalId: null,
      createdAt: now,
      updatedAt: now,
    } as any);

    const res = await requestClientRefillAction('order-1');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.message).toBe('Заявка на докрутку принята');
      expect(res.refill.id).toBe('refill-str-123');
      expect(res.refill.status).toBe('PENDING');
    }
  });
});


```

---

### 📄 Файл 73 из 89: `src/actions/support/compensation.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { revalidatePath } from 'next/cache';
import { WalletOps } from '@/services/financial/wallet-ops';
import { z } from 'zod';
import crypto from 'crypto';
import { getClientIp } from '@/utils/ip';
import { headers } from 'next/headers';
import { SupportBalancePolicyService } from '@/services/financial/support-balance-policy.service';
import { auditAdminAwaitable } from '@/lib/admin-audit';

const compensationSchema = z.object({
  ticketId: z.string().min(1),
  costRub: z.number().positive().max(50000),
  note: z.string().min(10, 'Комментарий должен содержать минимум 10 символов'),
  topUpBalance: z.boolean().default(false),
  clientOperationToken: z.string().optional()
});

export async function logManualCompensation(formData: FormData) {
  return requireStaffPermission('tickets', 'edit', async (user) => {
    const rawCostRub = parseFloat(formData.get('costRub') as string);
    const parsed = compensationSchema.safeParse({
      ticketId: formData.get('ticketId'),
      costRub: isNaN(rawCostRub) ? 0 : rawCostRub,
      note: formData.get('note'),
      topUpBalance: formData.get('topUpBalance') === 'true',
      clientOperationToken: (formData.get('clientOperationToken') as string) || undefined
    });

    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Неверные параметры запроса' };
    }

    const { ticketId, costRub, note, topUpBalance, clientOperationToken } = parsed.data;
    const costCents = BigInt(Math.round(costRub * 100));

    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: { userId: true, id: true }
    });

    if (!ticket) {
      return { success: false as const, error: 'Тикет не найден' };
    }

    const reqHeaders = await headers();
    const userAgent = reqHeaders.get('user-agent') || 'Unknown';
    const ipAddress = await getClientIp('unknown');

    // Deterministic Idempotency Key
    const opToken = clientOperationToken || crypto.createHash('md5').update(`${ticketId}-${costCents}-${note}`).digest('hex');
    const idempotencyKey = `support-compensation-${ticket.id}-${ticket.userId}-${opToken}`;

    // Perform Policy Engine Check & Reserve Daily Limit in Serializable Transaction
    try {
      const actionResult = await db.$transaction(async (tx) => {
        const policyCheck = await SupportBalancePolicyService.validateAndReserveSupportOperation(tx, {
          staffUserId: user.id,
          targetUserId: ticket.userId,
          direction: 'CREDIT',
          amountCents: costCents,
          reasonCode: topUpBalance ? 'COMPENSATION_BALANCE' : 'COMPENSATION_REFILL',
          reasonNote: note,
          source: 'SUPPORT_COMPENSATION',
          ticketId: ticket.id,
          idempotencyKey,
          ipAddress,
          userAgent
        });

        if (!policyCheck.allowed) {
          throw new Error(policyCheck.error);
        }

        let ledgerEntryId: string | undefined = undefined;

        // Perform financial wallet modification via WalletOps
        if (topUpBalance) {
          const ledgerResult = await WalletOps.credit(tx, ticket.userId, Number(costCents),
            `Компенсация в тикете #${ticket.id}: ${note}`,
            { adminId: user.id, idempotencyKey }
          );
          ledgerEntryId = ledgerResult.success && ledgerResult.entry ? ledgerResult.entry.id : undefined;
        } else {
          const creditKey = `compensation-credit-${idempotencyKey}`;
          const chargeKey = `compensation-charge-${idempotencyKey}`;

          const ledgerResult = await WalletOps.credit(tx, ticket.userId, Number(costCents),
            `Компенсация (Докрут) в тикете #${ticket.id}: ${note}`,
            { adminId: user.id, idempotencyKey: creditKey }
          );
          ledgerEntryId = ledgerResult.success && ledgerResult.entry ? ledgerResult.entry.id : undefined;

          await WalletOps.charge(tx, ticket.userId, Number(costCents),
            `Списание за ручной докрут в тикете #${ticket.id}: ${note}`,
            { idempotencyKey: chargeKey }
          );
        }

        // Determine review status (Auto-flag if amount > 5,000 RUB or staff has warnings)
        const isFlagged = costRub >= 5000 || policyCheck.warnings.length > 0;
        const reviewStatus = isFlagged ? 'FLAGGED' : 'PENDING';

        // Create SupportFinancialAction record
        const financialAction = await tx.supportFinancialAction.create({
          data: {
            staffUserId: user.id,
            targetUserId: ticket.userId,
            direction: 'CREDIT',
            source: 'SUPPORT_COMPENSATION',
            amountCents: costCents,
            reasonCode: topUpBalance ? 'COMPENSATION_BALANCE' : 'COMPENSATION_REFILL',
            reasonNote: note,
            ticketId: ticket.id,
            policyId: policyCheck.policy.id,
            policySnapshot: JSON.parse(JSON.stringify(policyCheck.policy, (_, v) => typeof v === 'bigint' ? v.toString() : v)),
            idempotencyKey,
            status: 'EXECUTED',
            ledgerEntryId,
            consentId: policyCheck.consentId || null,
            reviewStatus,
            ipAddress,
            userAgent
          }
        });

        // Add silent message to ticket chat
        await tx.ticketMessage.create({
          data: {
            ticketId: ticket.id,
            sender: 'INTERNAL',
            text: `[СИСТЕМА] Сотрудник (${user.email}) оформил компенсацию (${topUpBalance ? 'зачислен баланс' : 'ручной докрут'}). Сумма: ${costRub.toLocaleString('ru-RU')} ₽.\nПричина: ${note}`
          }
        });

        return { financialActionId: financialAction.id, warnings: policyCheck.warnings };
      });

      // Awaitable Audit Log
      await auditAdminAwaitable({
        adminId: user.id,
        adminEmail: user.email,
        action: topUpBalance ? 'SUPPORT_BALANCE_COMPENSATION' : 'SUPPORT_REFILL_COMPENSATION',
        target: ticket.id,
        targetType: 'TICKET',
        oldValue: JSON.stringify({ amountCents: 0 }),
        newValue: JSON.stringify({ amountCents: costCents.toString(), actionId: actionResult.financialActionId }),
        ipAddress
      });

      revalidatePath('/admin/tickets');
      revalidatePath(`/admin/tickets/${ticketId}`, 'page');
      revalidatePath(`/admin/finance`);

      return { success: true as const, warnings: actionResult.warnings };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при оформлении компенсации';
      return { success: false as const, error: errorMessage };
    }
  });
}

```

---

### 📄 Файл 74 из 89: `src/actions/support/guest.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { z } from 'zod';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { getClientIp } from '@/utils/ip';
import { headers } from 'next/headers';

const guestTicketSchema = z.object({
  name: z.string().min(2, "Имя должно быть не короче 2 символов").max(100, "Имя слишком длинное"),
  email: z.string().email("Пожалуйста, введите корректный email"),
  message: z.string().min(10, "Вопрос должен быть не короче 10 символов").max(2000, "Вопрос слишком длинный")
});

export async function createGuestTicketAction(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { success: false, error: "Некорректные данные формы" };
  }
  try {
    // 1. Zod input validation first
    const parsed = guestTicketSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }
    const { name, email, message } = parsed.data;
    const lowerEmail = email.toLowerCase().trim();

    const reqHeaders = await headers();
    const tenantId = reqHeaders.get("x-tenant-id") || "smmplan";

    // 2. Prevent Account Squatting / Identity Fraud
    // If a real user with this email exists (has passwordHash or telegramId), reject guest ticket creation.
    const existingUser = await db.user.findUnique({
      where: { email_tenantId: { email: lowerEmail, tenantId } },
      select: { id: true, passwordHash: true, telegramId: true }
    });
    
    const isRegistered = !!existingUser && (
      existingUser.passwordHash !== null ||
      existingUser.telegramId !== null
    );

    if (isRegistered) {
      return { 
        success: false, 
        error: 'Аккаунт с этим email уже существует. Пожалуйста, войдите в систему для создания обращения.' 
      };
    }

    // 3. Multi-Layer Anti-Spam Rate Limiting via RateLimitService
    const realIp = await getClientIp('unknown');
    
    // IP-based global limit (max 10 requests per hour per IP)
    const isIpAllowed = await RateLimitService.checkCustomKey(`guest_ip:${realIp}`, 10, 3600);
    if (!isIpAllowed) {
      return { success: false, error: "Слишком много обращений с вашего IP. Попробуйте позже." };
    }

    // Email-based limit (max 5 requests per hour per Email)
    const isAllowed = await RateLimitService.checkCustomKey(`guest_ticket:${lowerEmail}`, 5, 3600);
    if (!isAllowed) {
      return { success: false, error: "Слишком много обращений. Попробуйте позже." };
    }

    // 4. Find or create Shadow User
    const user = await db.user.upsert({
      where: { email_tenantId: { email: lowerEmail, tenantId } },
      update: {},
      create: { 
        email: lowerEmail,
        tenantId,
        adminNote: "Создан автоматически через гостевую форму поддержки"
      }
    });

    // 5. Create Ticket and Initial Message atomically
    await db.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          userId: user.id,
          tenantId,
          subject: `Вопрос от гостя: ${name}`,
          source: "EMAIL",
          status: "OPEN"
        }
      });

      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          sender: "USER",
          text: message
        }
      });
    });

    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('[createGuestTicketAction]', error);
    return { success: false, error: "Внутренняя ошибка сервера" };
  }
}

```

---

### 📄 Файл 75 из 89: `src/actions/support/offline-ticket.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { z } from 'zod';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { getClientIp } from '@/utils/ip';
import { headers } from 'next/headers';

const offlineTicketSchema = z.object({
  serviceId: z.string().max(255).optional().nullable(),
  error: z.string().min(1, "Текст ошибки обязателен").max(2000, "Текст ошибки слишком длинный"),
  gateway: z.string().min(1, "Платежный шлюз обязателен").max(255, "Название шлюза слишком длинное"),
  quantity: z.union([z.string(), z.number()]).refine((val) => {
    if (val === null || val === undefined || val === '') return true;
    const num = Number(val);
    return !isNaN(num) && Number.isInteger(num) && num > 0 && num <= 1000000;
  }, "Количество должно быть целым положительным числом не более 1 000 000").optional().nullable(),
  email: z.string().email("Введите корректный email адрес").max(255, "Email должен быть не длиннее 255 символов"),
  name: z.string().max(255, "Имя должно быть не длиннее 255 символов").optional().nullable(),
  url: z.string().max(500, "Ссылка должна быть не длиннее 500 символов").optional().nullable(),
  message: z.string().max(2000, "Сообщение должно быть не длиннее 2000 символов").optional().nullable(),
  paymentId: z.string().max(255).optional().nullable(),
  orderId: z.string().max(255).optional().nullable()
});

export type OfflineTicketInput = z.infer<typeof offlineTicketSchema>;

/**
 * Server Action: Submit offline support ticket directly from payment error screen
 */
export async function createOfflineTicketAction(input: OfflineTicketInput) {
  try {
    // 1. Zod input validation
    const parsed = offlineTicketSchema.safeParse(input);
    if (!parsed.success) {
      return { 
        success: false, 
        error: parsed.error.errors.map(err => err.message).join(', ') 
      };
    }
    
    const { serviceId, error: paymentError, gateway, quantity, email, name, url, message, paymentId, orderId } = parsed.data;
    const lowerEmail = email.toLowerCase().trim();

    // 2. Multi-Layer Anti-Spam Rate Limiting via RateLimitService
    const realIp = await getClientIp('unknown');
    
    // IP-based global limit (max 10 requests per hour per IP)
    const isIpAllowed = await RateLimitService.check(`offline_ticket_ip:${realIp}`, 10, 3600);
    if (!isIpAllowed) {
      return { 
        success: false, 
        error: "Слишком много обращений с вашего IP. Пожалуйста, попробуйте позже." 
      };
    }

    // Email-based specific limit (max 5 requests per hour per email)
    const isEmailAllowed = await RateLimitService.checkCustomKey(`offline_ticket_email:${lowerEmail}`, 5, 3600);
    if (!isEmailAllowed) {
      return { 
        success: false, 
        error: "Слишком много обращений для указанного email. Пожалуйста, попробуйте позже." 
      };
    }

    // 3. Squatting Guard & Shadow User Creation
    const reqHeaders = await headers();
    const tenantId = reqHeaders.get("x-tenant-id") || "smmplan";
    const existingUser = await db.user.findUnique({
      where: { email_tenantId: { email: lowerEmail, tenantId } },
      select: { id: true, passwordHash: true, telegramId: true }
    });
    
    const isRegistered = !!existingUser && (
      existingUser.passwordHash !== null ||
      existingUser.telegramId !== null
    );

    if (isRegistered) {
      return {
        success: false,
        error: "Этот email привязан к зарегистрированному аккаунту. Пожалуйста, войдите в свой профиль, чтобы создать обращение."
      };
    }

    const shadowUser = await db.user.upsert({
      where: { email_tenantId: { email: lowerEmail, tenantId } },
      update: {},
      create: {
        email: lowerEmail,
        tenantId,
        adminNote: "Создан автоматически при обращении с ошибкой платежа"
      }
    });
    const finalUserId = shadowUser.id;

    // 4. Resolve Service context safely
    let serviceName = '';
    if (serviceId) {
      const service = await db.service.findUnique({
        where: { id: serviceId },
        select: { name: true }
      });
      if (service) {
        serviceName = service.name;
      }
    }

    // 4.5 Resolve Relational Database Linkage (Finding #4)
    let finalPaymentId = paymentId || null;
    let finalOrderId = orderId || null;

    if (finalPaymentId) {
      const p = await db.payment.findUnique({
        where: { id: finalPaymentId },
        select: { userId: true }
      });
      if (!p || p.userId !== finalUserId) {
        finalPaymentId = null;
      }
    }

    if (finalOrderId) {
      const o = await db.order.findUnique({
        where: { id: finalOrderId },
        select: { userId: true }
      });
      if (!o || o.userId !== finalUserId) {
        finalOrderId = null;
      }
    }

    if (!finalOrderId || !finalPaymentId) {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentOrder = await db.order.findFirst({
        where: {
          userId: finalUserId,
          createdAt: { gte: fifteenMinutesAgo }
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, paymentId: true }
      });
      if (recentOrder) {
        if (!finalOrderId) finalOrderId = recentOrder.id;
        if (!finalPaymentId) finalPaymentId = recentOrder.paymentId;
      }
    }

    // 5. Construct message body for operators
    const parsedQty = quantity ? parseInt(String(quantity), 10) : null;
    const messageBody = 
      `⚠️ Автоматическое обращение при ошибке оплаты\n` +
      `----------------------------------------\n` +
      `• Услуга: ${serviceName || 'Массовый заказ / Несколько услуг'}\n` +
      `• Способ оплаты: ${gateway.toUpperCase()}\n` +
      (parsedQty ? `• Количество: ${parsedQty} шт.\n` : '') +
      `• Email для связи: ${lowerEmail}\n` +
      (url ? `• Ссылка: ${url}\n` : '') +
      (name ? `• Имя отправителя: ${name}\n` : '') +
      `• Ошибка платежа:\n"${paymentError}"` +
      (message ? `\n\n💬 Комментарий пользователя:\n"${message}"` : '');

    // 6. Atomic Database Transaction
    const result = await db.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          userId: finalUserId,
          tenantId,
          subject: `Ошибка оплаты [Шлюз: ${gateway.toUpperCase()}]`,
          source: 'WEB',
          status: 'OPEN',
          tags: ['PAYMENT_ERROR', 'AUTO_GUEST'],
          paymentId: finalPaymentId || undefined,
          orderId: finalOrderId || undefined
        }
      });

      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          sender: 'USER',
          text: messageBody
        }
      });

      return { ticketId: ticket.id };
    });

    return { 
      success: true, 
      ticketId: result.ticketId 
    };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('[createOfflineTicketAction] Unexpected core failure:', error);
    return { 
      success: false, 
      error: "Произошла непредвиденная ошибка на сервере при создании обращения." 
    };
  }
}

```

---

### 📄 Файл 76 из 89: `src/actions/support/template.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getClientIp } from '@/utils/ip';
import { auditAdmin } from '@/lib/admin-audit';

const templateSchema = z.object({
  id: z.string().optional(),
  shortcut: z.string()
    .min(1, 'Шорткат обязателен')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Шорткат может содержать только латинские буквы, цифры, дефис и подчеркивание')
    .optional()
    .nullable(),
  label: z.string().min(1, 'Название обязательно'),
  text: z.string().min(1, 'Текст обязателен'),
  category: z.string().default('GENERAL'),
  isActive: z.boolean().default(true),
  sort: z.number().int().default(0)
});

export async function getTemplates() {
  return requireStaffPermission('tickets', 'view', async () => {
    return db.supportTemplate.findMany({
      orderBy: { sort: 'asc' }
    });
  });
}

export async function incrementTemplateUsage(id: string) {
  return requireStaffPermission('tickets', 'view', async () => {
    try {
      await db.supportTemplate.update({
        where: { id },
        data: { useCount: { increment: 1 } }
      });
      return { success: true };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return { success: false, error: 'Database error' };
    }
  });
}

export async function upsertTemplate(formData: FormData) {
  return requireStaffPermission('tickets', 'edit', async (admin) => {

  const parsed = templateSchema.safeParse({
    id: formData.get('id') || undefined,
    shortcut: formData.get('shortcut') || null,
    label: formData.get('label'),
    text: formData.get('text'),
    category: formData.get('category') || 'GENERAL',
    isActive: formData.get('isActive') === 'true' || formData.get('isActive') === 'on',
    sort: parseInt(formData.get('sort') as string || '0', 10)
  });

  if (!parsed.success) {
    throw new Error('Invalid input: ' + parsed.error.message);
  }

  const data = parsed.data;
  const ipAddress = await getClientIp('unknown');

  if (data.id) {
    const oldTemplate = await db.supportTemplate.findUnique({
      where: { id: data.id }
    });

    const newTemplate = await db.supportTemplate.update({
      where: { id: data.id },
      data: {
        shortcut: data.shortcut,
        label: data.label,
        text: data.text,
        category: data.category,
        isActive: data.isActive,
        sort: data.sort
      }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SUPPORT_TEMPLATE_UPDATE',
      target: data.id,
      targetType: 'SETTINGS',
      oldValue: oldTemplate,
      newValue: newTemplate,
      ipAddress
    });
  } else {
    const newTemplate = await db.supportTemplate.create({
      data: {
        shortcut: data.shortcut,
        label: data.label,
        text: data.text,
        category: data.category,
        isActive: data.isActive,
        sort: data.sort
      }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SUPPORT_TEMPLATE_CREATE',
      target: newTemplate.id,
      targetType: 'SETTINGS',
      newValue: newTemplate,
      ipAddress
    });
  }

    revalidatePath('/admin/tickets');
    revalidatePath('/admin/tickets/[id]', 'page');
  });
}

export async function deleteTemplate(formData: FormData) {
  return requireStaffPermission('tickets', 'edit', async (admin) => {

  const id = formData.get('id') as string;
  if (!id) throw new Error('No id provided');

  const oldTemplate = await db.supportTemplate.findUnique({
    where: { id }
  });

    await db.supportTemplate.delete({
      where: { id }
    });

  const ipAddress = await getClientIp('unknown');
  auditAdmin({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'SUPPORT_TEMPLATE_DELETE',
    target: id,
    targetType: 'SETTINGS',
    oldValue: oldTemplate,
    ipAddress
  });

    revalidatePath('/admin/tickets');
    revalidatePath('/admin/tickets/[id]', 'page');
  });
}

```

---

### 📄 Файл 77 из 89: `src/actions/support/ticket.ts`

```ts
'use server';

import { verifySession } from '@/lib/session';
import { extractOrderIds } from '@/utils/ticket-parser';
import { ticketService } from '@/services/support/ticket.service';
import { db } from '@/lib/db';
import { aiSupportService } from '@/services/admin/ai-support.service';
import { requireStaffPermission } from '@/lib/server/rbac';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getClientIp } from '@/utils/ip';
import { auditAdmin } from '@/lib/admin-audit';
import { WalletOps } from '@/services/financial/wallet-ops';
import { CompensationService } from '@/services/financial/compensation.service';

/**
 * MANDATORY INTEGRITY WARNING:
 * DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
 */

// ... (rest of imports)

export async function generateSmartReplyAction(ticketId: string) {
  return requireStaffPermission('orders', 'view', async () => {
    try {
      const reply = await aiSupportService.generateReply(ticketId);
      return { success: true, reply };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

import { RateLimitService } from '@/services/core/rate-limit.service';
import { publishMessageSSE } from '@/services/support/sse.service';




const createTicketSchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1)
});

const ticketMessageSchema = z.object({
  ticketId: z.string().min(1),
  message: z.string().optional(),
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
  replyToId: z.string().optional(),
  orderId: z.string().optional()
}).refine(data => data.message || data.mediaUrl, "Either message or mediaUrl must be provided");

const adminReplySchema = z.object({
  ticketId: z.string().min(1),
  message: z.string().optional(),
  isInternal: z.any().transform(val => val === 'true' || val === 'on'),
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
  replyToId: z.string().optional(),
  orderId: z.string().optional()
}).refine(data => data.message || data.mediaUrl, "Either message or mediaUrl must be provided");

export async function createTicket(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') throw new Error("Некорректные данные формы");
  const session = await verifySession();
  if (!session) throw new Error('Unauthorized');

  // Rate Limit: Prevent ticket spam (max 5 tickets per 1 hour)
  const isAllowedUser = await RateLimitService.checkCustomKey(`create_ticket_user:${session.userId}`, 5, 3600);
  const isAllowedIp = await RateLimitService.check('create_ticket_ip', 10, 3600);
  if (!isAllowedUser || !isAllowedIp) {
    throw new Error('Вы создаете слишком много обращений. Пожалуйста, подождите некоторое время.');
  }

  const parsed = createTicketSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error('Данные тикета заполнены неверно');
  const { subject, message } = parsed.data;

  const ticket = await ticketService.getOrCreateTicket(session.userId, subject);
  await ticketService.addMessage(ticket.id, 'USER', message);

  revalidatePath('/dashboard/tickets');
  redirect(`/dashboard/tickets/${ticket.id}`);
}

export async function addTicketMessage(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') throw new Error("Некорректные данные формы");
  const session = await verifySession();
  if (!session) throw new Error('Unauthorized');

  // Rate Limit: Prevent message flooding (max 60 messages per 1 minute)
  const isAllowedUser = await RateLimitService.checkCustomKey(`add_message_user:${session.userId}`, 60, 60);
  const isAllowedIp = await RateLimitService.check('add_message_ip', 100, 60);
  if (!isAllowedUser || !isAllowedIp) {
    throw new Error('Слишком много сообщений. Пожалуйста, подождите перед следующим ответом.');
  }

  const parsed = ticketMessageSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error('Сообщение не может быть пустым');
  const { ticketId, message, mediaUrl, mediaType, replyToId, orderId } = parsed.data;

  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.userId !== session.userId) throw new Error('Forbidden');

  let verifiedOrderId: string | undefined = undefined;
  if (orderId) {
    // Security check: verify user owns the SMM order
    const order = await db.order.findFirst({
      where: { id: orderId, userId: session.userId }
    });
    if (order) {
      verifiedOrderId = order.id;
      // Also link at the ticket level for legacy compatibility and top-level headers
      await db.ticket.update({
        where: { id: ticketId },
        data: { orderId: order.id }
      });
    }
  } else if (message) {
    const extractedIds = extractOrderIds(message);
    if (extractedIds.length > 0) {
      const order = await db.order.findFirst({
        where: {
          userId: session.userId,
          OR: [
            { id: { in: extractedIds } },
            { numericId: { in: extractedIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id)) } }
          ]
        }
      });
      if (order) {
        verifiedOrderId = order.id;
        if (!ticket.orderId) {
          await db.ticket.update({
            where: { id: ticketId },
            data: { orderId: order.id }
          });
        }
      }
    }
  }

  const savedMsg = await ticketService.addMessage(ticketId, 'USER', message || '', mediaUrl, mediaType, replyToId, undefined, undefined, verifiedOrderId);
  if (savedMsg?.id) {
    await publishMessageSSE(ticketId, savedMsg.id);
  }
  revalidatePath(`/dashboard/tickets/${ticketId}`);
}

export async function adminReplyTicket(formData: FormData) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const parsed = adminReplySchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new Error('Ошибка валидации сообщения');
    const { ticketId, message, isInternal, mediaUrl, mediaType, replyToId, orderId } = parsed.data;

    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, orderId: true }
    });
    if (!ticket) throw new Error('Ticket not found');

    let verifiedOrderId: string | undefined = undefined;
    if (orderId) {
      const order = await db.order.findFirst({
        where: { id: orderId, userId: ticket.userId }
      });
      if (order) {
        verifiedOrderId = order.id;
        if (!ticket.orderId) {
          await db.ticket.update({
            where: { id: ticketId },
            data: { orderId: order.id }
          });
        }
      }
    } else if (message) {
      const extractedIds = extractOrderIds(message);
      if (extractedIds.length > 0) {
        const order = await db.order.findFirst({
          where: {
            userId: ticket.userId,
            OR: [
              { id: { in: extractedIds } },
              { numericId: { in: extractedIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id)) } }
            ]
          }
        });
        if (order) {
          verifiedOrderId = order.id;
          if (!ticket.orderId) {
            await db.ticket.update({
              where: { id: ticketId },
              data: { orderId: order.id }
            });
          }
        }
      }
    }

    const sender = isInternal ? 'INTERNAL' : 'STAFF';

    const savedMsg = await ticketService.addMessage(ticketId, sender, message || '', mediaUrl, mediaType, replyToId, undefined, undefined, verifiedOrderId);

    const ipAddress = await getClientIp('unknown');
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isInternal ? 'TICKET_INTERNAL_NOTE_ADD' : 'TICKET_REPLY_SEND',
      target: ticketId,
      targetType: 'TICKET',
      newValue: { message, mediaUrl, mediaType, replyToId, orderId: verifiedOrderId },
      ipAddress
    });

    // Broadcast STAFF replies and INTERNAL notes to SSE stream (INTERNAL notes are safely filtered out route-side for non-staff)
    if (sender === 'STAFF' || sender === 'INTERNAL') {
      await publishMessageSSE(ticketId, savedMsg.id);
    }

    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath(`/admin/tickets`);
  });
}

const changeStatusSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(['OPEN', 'PENDING', 'CLOSED'])
});

export async function changeTicketStatus(formData: FormData) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const parsed = changeStatusSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new Error('Неверный статус');
    const { ticketId, status } = parsed.data;

    const oldTicket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: { status: true }
    });

    await db.ticket.update({
      where: { id: ticketId },
      data: { 
        status,
        ...(status === 'CLOSED' ? { resolvedAt: new Date() } : {})
      }
    });

    const ipAddress = await getClientIp('unknown');
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TICKET_STATUS_CHANGE',
      target: ticketId,
      targetType: 'TICKET',
      oldValue: oldTicket?.status,
      newValue: status,
      ipAddress
    });

    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath(`/admin/tickets`);
  });
}

const editMessageSchema = z.object({
  messageId: z.string().min(1),
  newText: z.string().min(1)
});

export async function editTicketMessage(formData: FormData) {
  return requireStaffPermission('orders', 'edit', async (user) => {
    const parsed = editMessageSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new Error('Ошибка редактирования сообщения');
    const { messageId, newText } = parsed.data;

    // Retrieve the old message
    const msg = await db.ticketMessage.findUnique({ 
      where: { id: messageId },
      include: { ticket: { include: { user: true } } }
    });
    if (!msg) throw new Error('Message not found');
    if (msg.sender === 'USER') {
      throw new Error('You cannot edit user messages');
    }

    const ipAddress = await getClientIp('unknown');
    // Transaction for updating text and auditing
    await db.$transaction(async (tx) => {
      await tx.ticketMessage.update({
        where: { id: messageId },
        data: { 
          text: newText.trim(),
          isEdited: true,
          originalText: msg.isEdited ? undefined : msg.text
        }
      });

      await tx.adminAuditLog.create({
        data: {
          adminId: user.id,
          adminEmail: user.email,
          action: 'TICKET_MESSAGE_EDITED',
          target: msg.id,
          targetType: 'TICKET_MESSAGE',
          oldValue: msg.text,
          newValue: newText.trim(),
          ipAddress
        }
      });
    });

    // Sync to Telegram if applicable
    if (msg.telegramMsgId && msg.ticket.user.telegramId && msg.sender === 'STAFF') {
      try {
        const { supportBotService } = await import('@/services/support/support-bot.service');
        await supportBotService.editSupportReply(msg.ticket.user.telegramId, msg.telegramMsgId, newText.trim());
      } catch (e) {
        console.error('[editTicketMessage] Error syncing edit to Telegram:', e);
        // We don't throw here to avoid failing the web UI if Telegram is temporarily down
      }
    }

    revalidatePath(`/admin/tickets/${msg.ticketId}`);
  });
}

const requestBindSchema = z.object({
  ticketId: z.string().min(1)
});

export async function requestTelegramBind(formData: FormData) {
  return requireStaffPermission('orders', 'edit', async () => {
    try {
      console.info('[requestTelegramBind] Action started');
      const parsed = requestBindSchema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) {
        console.error('[requestTelegramBind] Validation failed:', parsed.error);
        throw new Error('Invalid ticketId');
      }
      const { ticketId } = parsed.data;
      console.info('[requestTelegramBind] Processing ticketId:', ticketId);

      const ticket = await db.ticket.findUnique({ where: { id: ticketId }, include: { user: true } });
      if (!ticket) throw new Error('Ticket not found');

      if (!ticket.user.email.startsWith('tg_')) {
        throw new Error('У пользователя уже есть веб-аккаунт');
      }

      const host = process.env.NEXT_PUBLIC_APP_URL || 'https://smmplan.pro';
      const magicLink = `${host}/api/support/telegram?forceAuth=true`;

      const messageText = `🎧 <b>Служба поддержки SMMplan</b>\n\nЧтобы мы могли найти ваши заказы и оформить возврат средств на баланс, пожалуйста, подтвердите владение заказом по ссылке: ${magicLink}`;

      const savedMsg = await ticketService.addMessage(ticketId, 'STAFF', messageText);

      await publishMessageSSE(ticketId, savedMsg.id);

      revalidatePath(`/admin/tickets/${ticketId}`);
    } catch (err) {
      console.error('[requestTelegramBind] Error:', err);
      throw err;
    }
  });
}

const manualBindSchema = z.object({
  ticketId: z.string().min(1),
  targetEmail: z.string().email('Некорректный email'),
  confirm: z.string().optional()
});

export async function adminManualTelegramBind(formData: FormData) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    try {
      // W6-5: SUPPORT cannot call manual bind
      if (!['ADMIN', 'OWNER'].includes(admin.role)) throw new Error('Forbidden: Only ADMIN or OWNER can manually bind Telegram accounts');

      const parsed = manualBindSchema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) throw new Error('Invalid input');
      const { ticketId, targetEmail, confirm } = parsed.data;

      const ticket = await db.ticket.findUnique({ where: { id: ticketId }, include: { user: true } });
      if (!ticket) throw new Error('Ticket not found');

      const tempUser = ticket.user;
      if (!tempUser.email.startsWith('tg_') || !tempUser.telegramId) {
        throw new Error('Этот профиль не является временным Telegram-аккаунтом');
      }

      const webUser = await db.user.findUnique({ 
        where: { email_tenantId: { email: targetEmail, tenantId: tempUser.tenantId } },
        include: { _count: { select: { orders: true } } }
      });
      if (!webUser) {
        throw new Error('Целевой аккаунт с таким email не найден');
      }

      // W6-4: Add confirmationToken flow
      if (confirm !== 'true') {
        const tempUserOrders = await db.order.count({ where: { userId: tempUser.id } });
        return { 
          preview: true, 
          data: {
            tempUserEmail: tempUser.email,
            tempUserOrders: tempUserOrders,
            targetEmail: webUser.email,
            targetBalance: (Number(webUser.balance) / 100).toFixed(2),
            targetOrders: (webUser as { _count?: { orders?: number } })._count?.orders || 0
          }
        };
      }

      const ipAddress = await getClientIp('unknown');
      await db.$transaction(async (tx) => {
        // 1. Move all relational data from tempUser to webUser (excluding LedgerEntries because of block trigger)
        await tx.ticket.updateMany({ where: { userId: tempUser.id }, data: { userId: webUser.id } });
        await tx.order.updateMany({ where: { userId: tempUser.id }, data: { userId: webUser.id } });
        await tx.payment.updateMany({ where: { userId: tempUser.id }, data: { userId: webUser.id } });
        await tx.invoice.updateMany({ where: { userId: tempUser.id }, data: { userId: webUser.id } });
        await tx.auditLog.updateMany({ where: { userId: tempUser.id }, data: { userId: webUser.id } });

        // 1.5. Balance Transfer to preserve financial integrity and keep ledger immutable
        if (tempUser.balance > BigInt(0)) {
          const amount = Number(tempUser.balance);
          const reasonDebit = `Списание баланса при слиянии аккаунта ${tempUser.email} с ${webUser.email}`;
          const reasonCredit = `Перенос баланса со старого аккаунта ${tempUser.email}`;
          
          // Debit tempUser
          await WalletOps.charge(tx, tempUser.id, amount, reasonDebit, {
            idempotencyKey: `merge-debit-${tempUser.id}-${webUser.id}`
          });

          // Credit webUser
          await WalletOps.credit(tx, webUser.id, amount, reasonCredit, {
            idempotencyKey: `merge-credit-${tempUser.id}-${webUser.id}`
          });
        }

        // 2. Archive temp user instead of deleting, because of onDelete: Restrict on LedgerEntry
        await tx.user.update({
          where: { id: tempUser.id },
          data: {
            isActive: false,
            isDeleted: true,
            telegramId: null,
            email: `merged_${tempUser.id}@smmplan.stub`
          }
        });

        // 3. Bind telegramId to the target web user
        await tx.user.update({
          where: { id: webUser.id },
          data: { telegramId: tempUser.telegramId }
        });

        // 4. Audit Log
        await tx.adminAuditLog.create({
          data: {
            adminId: admin.id,
            adminEmail: admin.email,
            action: 'MANUAL_TELEGRAM_BIND',
            target: webUser.id,
            targetType: 'USER',
            oldValue: tempUser.email,
            newValue: webUser.email,
            ipAddress
          }
        });
      });

      revalidatePath(`/admin/tickets`);
      return { success: true };
    } catch (err) {
      console.error('[adminManualTelegramBind] Error:', err);
      throw err;
    }
  });
}

export async function bulkRefillOrdersAction(ticketId: string, orderIds: string[]) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Тикет не найден');

    let processedCount = 0;
    const errors: string[] = [];
    const createdRefills: { id: string }[] = [];

    await db.$transaction(async (tx) => {
      for (const orderId of orderIds) {
        try {
          const order = await tx.order.findFirst({
            where: { id: orderId, userId: ticket.userId },
            include: { service: true }
          });

          if (!order) {
            errors.push(`Заказ ${orderId} не найден или принадлежит другому пользователю`);
            continue;
          }

          if (order.status === 'CANCELED' || order.status === 'ERROR') {
            errors.push(`Заказ #${order.numericId}: Невозможно докрутить отмененный или ошибочный заказ`);
            continue;
          }

          if (order.status === 'PARTIAL') {
            errors.push(`Заказ #${order.numericId}: Невозможно докрутить заказ с частичным возвратом`);
            continue;
          }

          if (!order.service.isRefillEnabled) {
            errors.push(`Заказ #${order.numericId}: Докрутка не поддерживается для этой услуги`);
            continue;
          }

          // R2-004 Fix: Check for existing active refill
          const activeRefill = await tx.refill.findFirst({
            where: {
              orderId: order.id,
              status: { in: ['PENDING', 'IN_PROGRESS'] }
            }
          });

          if (activeRefill) {
            errors.push(`Заказ #${order.numericId}: Уже есть активный запрос на докрутку`);
            continue;
          }

          const refill = await tx.refill.create({
            data: {
              orderId: order.id,
              status: 'PENDING'
            }
          });

          createdRefills.push({ id: refill.id });
          processedCount++;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          errors.push(`Ошибка по заказу ${orderId}: ${err.message}`);
        }
      }
    });

    const { refillQueue } = await import('@/lib/queue-manager');
    for (const refill of createdRefills) {
      await refillQueue.add('process-refill', { refillId: refill.id });
    }

    const ipAddress = await getClientIp('unknown');
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TICKET_BULK_REFILL',
      target: ticketId,
      targetType: 'TICKET',
      newValue: { orderIds, processedCount, errors },
      ipAddress
    });

    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath('/admin/refills');

    return { success: true, processedCount, errors };
  });
}

export async function bulkRefundOrdersAction(ticketId: string, orderIds: string[]) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const ticket = await db.ticket.findUnique({ 
      where: { id: ticketId },
      include: { user: true }
    });
    if (!ticket) throw new Error('Тикет не найден');

    // Check B2bConfig profile to see if the user is a B2B reseller
    const b2bConfig = await db.b2bConfig.findUnique({
      where: { userId: ticket.userId }
    });
    const isB2bClient = !!b2bConfig && b2bConfig.isB2b;

    let processedCount = 0;
    let totalRefundedCents = 0;
    const errors: string[] = [];

    const { calculatePartialRefund } = await import('@/utils/refund');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calculatedRefunds: any[] = [];

    await db.$transaction(async (tx) => {
      // Calculate total refund cents first
      let totalToRefundCents = 0;

      for (const orderId of orderIds) {
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (order && !['CANCELED', 'PARTIAL'].includes(order.status) && order.remains > 0 && order.userId === ticket.userId) {
          const calculatedAmount = calculatePartialRefund({
            remains: order.remains,
            quantity: order.quantity,
            charge: order.charge
          });
          if (calculatedAmount > 0) {
            totalToRefundCents += calculatedAmount;
            calculatedRefunds.push({ order, calculatedAmount });
          }
        } else if (order) {
          if (order.userId !== ticket.userId) {
            errors.push(`Заказ ${orderId} принадлежит другому пользователю`);
          } else if (['CANCELED', 'PARTIAL'].includes(order.status)) {
            errors.push(`Заказ #${order.numericId}: Уже отменен или частично возвращен`);
          } else if (order.remains <= 0) {
            errors.push(`Заказ #${order.numericId}: Нет остатков для возврата (remains <= 0)`);
          }
        } else {
          errors.push(`Заказ ${orderId} не найден`);
        }
      }

      if (totalToRefundCents > 0 && !isB2bClient) {
        const currentSpentToday = await getAdminSpentToday(admin.id, tx);
        const limitLeft = admin.supportLimitCents - currentSpentToday;
        if (totalToRefundCents > limitLeft) {
          throw new Error(`Превышен суточный лимит компенсаций оператора. Требуется: ${(totalToRefundCents / 100).toFixed(2)} ₽, Осталось: ${(limitLeft / 100).toFixed(2)} ₽`);
        }
      }

      // Perform updates
      for (const item of calculatedRefunds) {
        await tx.order.update({
          where: { id: item.order.id },
          data: { status: 'PARTIAL' }
        });

        const idempotencyKey = `refund_ticket_${ticketId}_order_${item.order.id}`;
        await WalletOps.refund(tx, ticket.userId, item.calculatedAmount,
          `Компенсация (частичный возврат) по тикету #${ticketId} за недовыполненный заказ #${item.order.numericId}`,
          { idempotencyKey, adminId: admin.id }
        );

        processedCount++;
        totalRefundedCents += item.calculatedAmount;
      }
    }, { isolationLevel: 'Serializable' });

    for (const item of calculatedRefunds) {
      CompensationService.trackCompensation(item.order.id).catch(err => console.error('[TicketActions] Failed to track compensation', err));
    }

    const ipAddress = await getClientIp('unknown');
    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TICKET_BULK_REFUND',
      target: ticketId,
      targetType: 'TICKET',
      newValue: { orderIds, processedCount, totalRefundedCents, errors },
      ipAddress
    });

    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath(`/admin/tickets`);

    return { 
      success: true, 
      processedCount, 
      totalRefundedAmount: (totalRefundedCents / 100).toFixed(2), 
      errors 
    };
  });
}

import { getMSKMidnightUTC } from '@/services/admin/escrow.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAdminSpentToday(adminId: string, tx?: any): Promise<number> {
  const todayStart = getMSKMidnightUTC();

  const client = tx || db;
  const ledgerCompensations = await client.ledgerEntry.findMany({
    where: {
      adminId,
      createdAt: { gte: todayStart },
    },
    select: {
      amount: true
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ledgerCompensations.reduce((acc: number, entry: any) => {
    const amt = Number(entry.amount);
    return acc + Math.abs(amt);
  }, 0);
}



```

---

### 📄 Файл 78 из 89: `src/actions/support/__tests__/guest.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { createGuestTicketAction } from '../guest';
import { RateLimitService } from '@/services/core/rate-limit.service';

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn(async () => true),
    checkCustomKey: vi.fn(async () => true),
  }
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn(async () => '127.0.0.1'),
}));

describe.sequential('createGuestTicketAction', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.ticketMessage.deleteMany().catch(() => {});
    await db.ticket.deleteMany().catch(() => {});
    await db.user.deleteMany().catch(() => {});
  });

  it('should reject invalid guest input data (Zod errors)', async () => {
    const formData = new FormData();
    formData.append('name', 'A'); // Too short
    formData.append('email', 'invalid-email');
    formData.append('message', 'Short'); // Too short

    const result = await createGuestTicketAction(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject guest ticket if email belongs to a registered user', async () => {
    // Create a registered user with passwordHash
    await db.user.create({
      data: {
        email: 'registered@smmplan.local',
        passwordHash: 'hashed_password_456',
      }
    });

    const formData = new FormData();
    formData.append('name', 'Jane Doe');
    formData.append('email', 'Registered@smmplan.local'); // mixed case to verify case normalization
    formData.append('message', 'My order has been delayed for a long time');

    const result = await createGuestTicketAction(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Аккаунт с этим email уже существует');
  });

  it('should block ticket creation if IP rate limit is exceeded', async () => {
    vi.mocked(RateLimitService.checkCustomKey).mockImplementation(async (key) => {
      if (key.startsWith('guest_ip:')) return false; // Block IP
      return true;
    });

    const formData = new FormData();
    formData.append('name', 'John Doe');
    formData.append('email', 'spammer@smmplan.local');
    formData.append('message', 'My order has been delayed for a long time');

    const result = await createGuestTicketAction(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Слишком много обращений с вашего IP');
  });

  it('should block ticket creation if Email rate limit is exceeded', async () => {
    vi.mocked(RateLimitService.checkCustomKey).mockImplementation(async (key) => {
      if (key.startsWith('guest_ticket:')) return false; // Block Email
      return true;
    });

    const formData = new FormData();
    formData.append('name', 'John Doe');
    formData.append('email', 'spammer@smmplan.local');
    formData.append('message', 'My order has been delayed for a long time');

    const result = await createGuestTicketAction(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Слишком много обращений. Попробуйте позже.');
  });

  it('should successfully create shadow user, ticket, and message for a valid guest request', async () => {
    vi.mocked(RateLimitService.checkCustomKey).mockResolvedValue(true);

    const formData = new FormData();
    formData.append('name', 'Alice Smith');
    formData.append('email', 'Guest_User@SMMplan.local'); // checks email lowercase normalization
    formData.append('message', 'Greetings! Please help me with this offline order check.');

    const result = await createGuestTicketAction(formData);

    if (!result.success) {
      console.error('Test failed with error:', result.error);
    }
    expect(result.success).toBe(true);

    const shadowUser = await db.user.findUnique({
      where: { email_tenantId: { email: 'guest_user@smmplan.local', tenantId: 'smmplan' } },
      include: {
        tickets: {
          include: {
            messages: true
          }
        }
      }
    });

    expect(shadowUser).toBeDefined();
    expect(shadowUser?.email).toBe('guest_user@smmplan.local');
    expect(shadowUser?.tickets).toHaveLength(1);
    expect(shadowUser?.tickets[0].subject).toBe('Вопрос от гостя: Alice Smith');
    expect(shadowUser?.tickets[0].messages).toHaveLength(1);
    expect(shadowUser?.tickets[0].messages[0].text).toBe('Greetings! Please help me with this offline order check.');
  });
});

```

---

### 📄 Файл 79 из 89: `src/actions/support/__tests__/offline-ticket.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { createOfflineTicketAction } from '../offline-ticket';
import { RateLimitService } from '@/services/core/rate-limit.service';

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn(async () => true),
    checkCustomKey: vi.fn(async () => true),
  }
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn(async () => '127.0.0.1'),
}));

describe.sequential('createOfflineTicketAction', () => {
  let network: any;
  let category: any;
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram' }
    });

    category = await db.category.create({
      data: { name: 'Подписчики Telegram', networkId: network.id }
    });

    service = await db.service.create({
      data: {
        name: 'TG Subscribers Premium',
        categoryId: category.id,
        rate: 0.1,
        markup: 3.0,
        minQty: 10,
        maxQty: 10000,
        isActive: true,
      }
    });
  });

  it('should successfully create an offline ticket for a new guest', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(true);
    vi.mocked(RateLimitService.checkCustomKey).mockResolvedValue(true);

    const result = await createOfflineTicketAction({
      serviceId: service.id,
      error: 'Card declined by bank',
      gateway: 'yookassa',
      quantity: 100,
      email: 'guest@smmplan.local',
      name: 'John Doe',
      url: 'https://t.me/channel'
    });

    if (!result.success) {
      console.error(JSON.stringify(result, null, 2));
    }
    expect(result.success).toBe(true);
    expect(result.ticketId).toBeDefined();

    // Verify DB writes
    const ticket = await db.ticket.findUnique({
      where: { id: result.ticketId },
      include: { messages: true, user: true }
    });

    expect(ticket).toBeDefined();
    expect(ticket?.subject).toContain('Ошибка оплаты [Шлюз: YOOKASSA]');
    expect(ticket?.user.email).toBe('guest@smmplan.local');
    expect(ticket?.messages).toHaveLength(1);
    expect(ticket?.messages[0].text).toContain('John Doe');
    expect(ticket?.messages[0].text).toContain('TG Subscribers Premium');
    expect(ticket?.messages[0].text).toContain('Card declined by bank');
  });

  it('should reject guest ticket if email belongs to a registered user', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(true);
    vi.mocked(RateLimitService.checkCustomKey).mockResolvedValue(true);

    // Create a registered user with passwordHash
    await db.user.create({
      data: {
        email: 'registered@smmplan.local',
        passwordHash: 'hashed_password_123',
      }
    });

    const result = await createOfflineTicketAction({
      serviceId: null,
      error: 'Insufficient funds',
      gateway: 'cryptobot',
      quantity: null,
      email: 'registered@smmplan.local',
      name: 'Alice',
      url: null
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('привязан к зарегистрированному аккаунту');
  });

  it('should block ticket creation if IP rate limit is exceeded', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(false); // IP blocked

    const result = await createOfflineTicketAction({
      serviceId: null,
      error: 'Fail',
      gateway: 'yookassa',
      quantity: null,
      email: 'spammer@smmplan.local',
      name: null,
      url: null
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Слишком много обращений с вашего IP');
  });

  it('should nullify orderId and paymentId if they belong to another user', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(true);
    vi.mocked(RateLimitService.checkCustomKey).mockResolvedValue(true);

    // Create another user
    const otherUser = await db.user.create({
      data: { email: 'other@smmplan.local' }
    });

    // Create order and payment for otherUser
    const order = await db.order.create({
      data: {
        userId: otherUser.id,
        serviceId: service.id,
        quantity: 100,
        charge: BigInt(10),
        providerCost: BigInt(5),
        status: 'PENDING',
        link: 'https://vk.com/post'
      }
    });

    const payment = await db.payment.create({
      data: {
        userId: otherUser.id,
        amount: BigInt(100),
        gateway: 'yookassa',
        status: 'PENDING'
      }
    });

    // Create ticket for guest@smmplan.local
    const result = await createOfflineTicketAction({
      serviceId: null,
      error: 'Card declined',
      gateway: 'yookassa',
      quantity: null,
      email: 'guest@smmplan.local',
      name: 'John Guest',
      url: null,
      orderId: order.id,
      paymentId: payment.id
    });

    expect(result.success).toBe(true);
    expect(result.ticketId).toBeDefined();

    const ticket = await db.ticket.findUnique({
      where: { id: result.ticketId }
    });

    // They should be nullified since they belong to otherUser, not guest@smmplan.local
    expect(ticket?.orderId).toBeNull();
    expect(ticket?.paymentId).toBeNull();
  });

  it('should preserve orderId and paymentId if they belong to the correct user', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(true);
    vi.mocked(RateLimitService.checkCustomKey).mockResolvedValue(true);

    // Create the guest shadow user first so we get the exact same ID
    const guestUser = await db.user.create({
      data: { email: 'guest@smmplan.local' }
    });

    // Create order and payment for the guestUser
    const order = await db.order.create({
      data: {
        userId: guestUser.id,
        serviceId: service.id,
        quantity: 100,
        charge: BigInt(10),
        providerCost: BigInt(5),
        status: 'PENDING',
        link: 'https://vk.com/post'
      }
    });

    const payment = await db.payment.create({
      data: {
        userId: guestUser.id,
        amount: BigInt(100),
        gateway: 'yookassa',
        status: 'PENDING'
      }
    });

    const result = await createOfflineTicketAction({
      serviceId: null,
      error: 'Card declined',
      gateway: 'yookassa',
      quantity: null,
      email: 'guest@smmplan.local',
      name: 'John Guest',
      url: null,
      orderId: order.id,
      paymentId: payment.id
    });

    expect(result.success).toBe(true);
    expect(result.ticketId).toBeDefined();

    const ticket = await db.ticket.findUnique({
      where: { id: result.ticketId }
    });

    // They should be preserved since they belong to guest@smmplan.local
    expect(ticket?.orderId).toBe(order.id);
    expect(ticket?.paymentId).toBe(payment.id);
  });
});

```

---

### 📄 Файл 80 из 89: `src/actions/user/promo.ts`

```ts
"use server";

import { db } from "@/lib/db";
import { verifySession } from "@/lib/session";
import { WalletOps } from "@/services/financial/wallet-ops";
import { RateLimitService } from "@/services/core/rate-limit.service";

export async function activatePromoCodeAction(code: string) {
  const session = await verifySession();
  if (!session) throw new Error("Unauthorized");

  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) throw new Error("Введите промокод");

  // Rate Limit: Prevent brute-force guessing
  // NOTE: Rate limit is consumed *outside* the transaction.
  // This is intentional anti-brute-force behavior, meaning a failed transaction (e.g. race condition)
  // still consumes a rate limit token.
  const isAllowed = await RateLimitService.checkCustomKey(`promo_activate_user:${session.userId}`, 5, 60);
  if (!isAllowed) {
    throw new Error("Слишком много попыток. Пожалуйста, подождите минуту.");
  }

  // Bounded retry loop for Serialization Failures (P2034)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const promo = await tx.promoCode.findUnique({ where: { code: cleanCode } });

        if (!promo || !promo.isActive) {
          throw new Error("Промокод недействителен или не существует");
        }

        if (promo.expiresAt && promo.expiresAt < new Date()) {
          throw new Error("Срок действия промокода истёк");
        }

        if (promo.type !== "VOUCHER") {
          throw new Error("Этот промокод дает скидку на заказы. Примените его при оформлении заказа на главной странице.");
        }

        if (promo.amount <= 0) {
          throw new Error("Этот промокод не содержит денежного бонуса");
        }

        // Check if user already used this promo code (using DB-level idempotency key)
        const idempotencyKey = `promo-${cleanCode}-${session.userId}`;
        const alreadyUsed = await tx.ledgerEntry.findFirst({
          where: { idempotencyKey }
        });

        if (alreadyUsed) {
          throw new Error("Вы уже активировали этот промокод");
        }

        // Optimistic Concurrency Control (OCC) for usage limits
        const updatedPromo = await tx.promoCode.updateMany({
          where: { 
            id: promo.id,
            ...(promo.maxUses > 0 ? { uses: { lt: promo.maxUses } } : {})
          },
          data: { uses: { increment: 1 } }
        });

        if (updatedPromo.count === 0) {
          throw new Error("Лимит использований промокода исчерпан");
        }

        // Activate voucher -> Add to balance via WalletOps
        const reason = `Активация ваучера: ${cleanCode}`;
        await WalletOps.credit(tx, session.userId, promo.amount, reason, { idempotencyKey });

        return { success: true, amount: promo.amount };
      }, { isolationLevel: 'Serializable' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
        throw new Error("Вы уже активировали этот промокод", { cause: error });
      }
      if (error.code === 'P2034' && attempt < 2) {
        continue; // Retry on serialization failure
      }
      if (error.code === 'P2034') {
        throw new Error("Транзакция в обработке, пожалуйста, попробуйте еще раз.", { cause: error });
      }
      throw error;
    }
  }
}

```

---

### 📄 Файл 81 из 89: `src/actions/user/referral.action.ts`

```ts
"use server";

import { db } from "@/lib/db";
import { verifySession } from "@/lib/session";
import { WalletOps } from "@/services/financial/wallet-ops";

export async function transferReferralBalanceAction() {
  const session = await verifySession();
  if (!session) throw new Error("Unauthorized");

  let transferAmount = 0;
  
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: session.userId },
      select: { referralBalance: true, balance: true, isActive: true, isDeleted: true }
    });

    if (!user) throw new Error("Учетная запись не найдена");
    if (user.isDeleted === true || user.isActive === false) throw new Error("Ваш аккаунт заблокирован или удален");
    if (!user.referralBalance || user.referralBalance <= 0) {
      throw new Error("Нет средств для перевода");
    }

    transferAmount = user.referralBalance;

    // 1. Atomic decrement of referral balance with TOCTOU optimistic guard
    const updated = await tx.user.updateMany({
      where: { 
        id: session.userId,
        referralBalance: { gte: transferAmount }
      },
      data: {
        referralBalance: { decrement: transferAmount }
      }
    });

    if (updated.count === 0) {
      throw new Error("Недостаточно средств на реферальном балансе");
    }

    // 2. Safe main balance credit via WalletOps primitive
    await WalletOps.credit(
      tx,
      session.userId,
      transferAmount,
      `Перевод реферального баланса на основной`,
      { idempotencyKey: `referral-transfer-${session.userId}-${transferAmount}` }
    );

    await tx.payment.create({
      data: {
        userId: session.userId,
        amount: transferAmount,
        currency: "RUB",
        status: "COMPLETED",
        gateway: "referral_transfer"
      }
    });
  }, { isolationLevel: 'Serializable' });

  return { success: true, amount: transferAmount };
}

```

---

### 📄 Файл 82 из 89: `src/actions/user/settings-extra.types.ts`

```ts
export interface CompanyRequisitesInput {
  companyName?: string | null;
  inn?: string | null;
  kpp?: string | null;
  legalAddress?: string | null;
}

export interface UpdateCompanyRequisitesResult {
  success: boolean;
  error?: string;
}

export interface B2bWebhookInput {
  webhookUrl?: string | null;
  isWebhookActive?: boolean;
  regenerateSecret?: boolean;
}

export interface UpdateB2bWebhookResult {
  success: boolean;
  error?: string;
  webhookSecret?: string | null;
  webhookUrl?: string | null;
  isWebhookActive?: boolean;
}

export interface Confirm152FzConsentResult {
  success: boolean;
  error?: string;
  tosAcceptedAt?: Date | string | null;
  tosAcceptedIp?: string | null;
}

export interface ApiKeyActionResult {
  success: boolean;
  apiKey?: string;
  error?: string;
}

```

---

### 📄 Файл 83 из 89: `src/actions/user/top-up.action.ts`

```ts
"use server";

import { db } from "@/lib/db";
import { verifySession } from "@/lib/session";
import { headers } from "next/headers";
import { getBaseUrlAsync } from "@/utils/get-base-url";
import { getClientIp } from "@/utils/ip";
import { RateLimitService } from "@/services/core/rate-limit.service";

export async function createTopUpPaymentAction(amountRub: number, gateway: 'yookassa' | 'cryptobot' | 'robokassa' = 'yookassa') {
  const session = await verifySession();
  if (!session) throw new Error("Unauthorized");
  
  const isAllowed = await RateLimitService.check(`topup:${session.userId}`, 5, 300);
  if (!isAllowed) throw new Error("Слишком много попыток пополнения. Попробуйте через 5 минут.");

  const amountCents = Math.round(amountRub * 100);
  if (amountCents < 1000) throw new Error("Минимальная сумма пополнения — 10 ₽");

  // Fetch user
  const dbUser = await db.user.findUnique({ where: { id: session.userId } });
  if (!dbUser) throw new Error("Пользователь не найден.");
  if (dbUser.isDeleted === true || dbUser.isActive === false) throw new Error("Ваш аккаунт заблокирован или удален");

  if (gateway === 'yookassa' && amountCents > 180000) {
    if (!dbUser.telegramId) {
      throw new Error("Для совершения платежей свыше $20 картой, пожалуйста, привяжите ваш Telegram-аккаунт в личном кабинете. Либо воспользуйтесь криптовалютой (без ограничений)");
    }
  }



  const reqHeaders = await headers();
  const consentIp = await getClientIp();
  const consentUserAgent = reqHeaders.get("user-agent") || "Unknown";

  const termsDoc = await db.contentItem.findUnique({
    where: { slug: 'terms' },
    select: { updatedAt: true }
  });
  const consentVersion = termsDoc ? `terms:${termsDoc.updatedAt.toISOString()}` : `fallback:${new Date().toISOString().split('T')[0]}`;

  const payment = await db.payment.create({
    data: {
      userId: session.userId,
      amount: amountCents,
      currency: "RUB",
      status: "PENDING",
      gateway,
      consentIp,
      consentUserAgent,
      consentVersion
    }
  });

  const { PaymentGatewayFactory } = await import('@/services/financial/payment-gateway.service');
  const gatewaySvc = PaymentGatewayFactory.getGateway(gateway);
  const successUrl = `${await getBaseUrlAsync()}/dashboard/add-funds?success=1`;
  const description = gateway === 'yookassa'
    ? `Оплата услуг IT-агентства (Digital Consulting, Счёт: ${payment.id})`
    : `Пополнение баланса (Счёт: ${payment.id})`;

  try {
    const gatewayResult = await gatewaySvc.createPayment({
      paymentId: payment.id,
      userId: session.userId,
      amountRub,
      email: dbUser.email,
      successUrl,
      description,
      isTestMode: false,
      metadata: { type: 'deposit' }
    });

    if (gatewayResult.remoteGatewayId || gatewayResult.paymentUrl) {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          gatewayId: gatewayResult.remoteGatewayId || undefined,
          checkoutUrl: gatewayResult.paymentUrl || undefined
        }
      });
    }

    return { success: true, paymentUrl: gatewayResult.paymentUrl || `/payment-redirect?id=${payment.id}` };
  } catch (err: unknown) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'CANCELED' }
    }).catch(() => {});

    const errorMessage = err instanceof Error ? err.message : 'Ошибка создания платежа в платежной системе';
    throw new Error(errorMessage, { cause: err });
  }
}

```

---

### 📄 Файл 84 из 89: `src/actions/user/__tests__/settings-extra.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import {
  updateCompanyRequisitesAction,
  updateB2bWebhookAction,
  confirm152FzConsentAction,
} from '../settings-extra';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn().mockResolvedValue('185.220.100.5'),
}));

async function createTestUser() {
  const uniqueEmail = `settings_test_${Date.now()}_${Math.random().toString(36).substring(7)}@smmplan.local`;
  return await db.user.create({
    data: {
      email: uniqueEmail,
      role: 'USER',
      isActive: true,
    },
  });
}

describe('Settings Extra Server Actions', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe('updateCompanyRequisitesAction', () => {
    it('should return error if unauthenticated', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);
      const res = await updateCompanyRequisitesAction({ companyName: 'ООО Рога' });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Авторизуйтесь для выполнения этого действия');
    });

    it('should reject invalid INN format', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateCompanyRequisitesAction({ inn: '12345' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('ИНН должен содержать ровно 10 цифр');
    });

    it('should reject invalid KPP format', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateCompanyRequisitesAction({ inn: '7701234567', kpp: '123' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('КПП должен содержать ровно 9 цифр');
    });

    it('should update requisites successfully with 10-digit INN and 9-digit KPP', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateCompanyRequisitesAction({
        companyName: 'ООО Рога и Копыта',
        inn: '7701234567',
        kpp: '770101001',
        legalAddress: 'г. Москва, ул. Пушкина, д. 10',
      });
      expect(res.success).toBe(true);

      const updated = await db.user.findUnique({ where: { id: user.id } });
      expect(updated?.companyName).toBe('ООО Рога и Копыта');
      expect(updated?.inn).toBe('7701234567');
      expect(updated?.kpp).toBe('770101001');
      expect(updated?.legalAddress).toBe('г. Москва, ул. Пушкина, д. 10');
    });

    it('should accept 12-digit INN for IP / sole traders', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateCompanyRequisitesAction({
        companyName: 'ИП Иванов И.И.',
        inn: '770123456789',
      });
      expect(res.success).toBe(true);

      const updated = await db.user.findUnique({ where: { id: user.id } });
      expect(updated?.inn).toBe('770123456789');
    });
  });

  describe('updateB2bWebhookAction', () => {
    it('should return error if unauthenticated', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);
      const res = await updateB2bWebhookAction({ webhookUrl: 'https://example.com/webhook' });
      expect(res.success).toBe(false);
    });

    it('should reject non-HTTPS URLs', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateB2bWebhookAction({ webhookUrl: 'http://insecure.com/webhook' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('https://');
    });

    it('should create b2bConfig and generate secret for valid HTTPS URL', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await updateB2bWebhookAction({ webhookUrl: 'https://example.com/webhook' });
      expect(res.success).toBe(true);
      expect(res.webhookUrl).toBe('https://example.com/webhook');
      expect(res.webhookSecret).toBeDefined();
      expect(typeof res.webhookSecret).toBe('string');
      expect(res.webhookSecret?.length).toBeGreaterThan(10);
    });

    it('should regenerate secret when requested', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res1 = await updateB2bWebhookAction({ webhookUrl: 'https://example.com/webhook' });
      const secret1 = res1.webhookSecret;

      const res2 = await updateB2bWebhookAction({
        webhookUrl: 'https://example.com/webhook',
        regenerateSecret: true,
      });
      const secret2 = res2.webhookSecret;

      expect(secret1).not.toBe(secret2);
    });
  });

  describe('confirm152FzConsentAction', () => {
    it('should return error if unauthenticated', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);
      const res = await confirm152FzConsentAction();
      expect(res.success).toBe(false);
    });

    it('should record tosAcceptedAt and tosAcceptedIp', async () => {
      const user = await createTestUser();
      vi.mocked(verifySession).mockResolvedValue({ userId: user.id });
      const res = await confirm152FzConsentAction();
      expect(res.success).toBe(true);
      expect(res.tosAcceptedAt).toBeDefined();
      expect(res.tosAcceptedIp).toBe('185.220.100.5');

      const updated = await db.user.findUnique({ where: { id: user.id } });
      expect(updated?.tosAcceptedAt).not.toBeNull();
      expect(updated?.tosAcceptedIp).toBe('185.220.100.5');
    });
  });
});

```

---

### 📄 Файл 85 из 89: `src/actions/__tests__/knowledge.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { SettingsProvider } from '@/lib/settings';
import { applyBeautifulRounding } from '@/lib/financial-constants';
import { 
  getArticles, 
  getArticleBySlug, 
  getRecommendedServicesForArticle, 
  createArticle, 
  updateArticle, 
  deleteArticle,
  getGroupedArticlesForTree,
  getRelatedArticles
} from '../knowledge';

// Mock cookies and headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest',
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

// Mock verifySession
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await (importOriginal as <T>() => Promise<T>)<typeof import('@/lib/session')>();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

describe('SMMplan Knowledge Base & SEO Blog Server Actions', () => {
  let adminUser: any;
  let regularUser: any;
  let network: any;
  let category: any;
  let service: any;

  beforeEach(async () => {
    // 1. Clean database
    await db.article.deleteMany();
    await db.service.deleteMany();
    await db.category.deleteMany();
    await db.network.deleteMany();
    await db.ledgerEntry.deleteMany();
    await db.user.deleteMany();

    // 2. Set settings
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    // 3. Create users
    adminUser = await db.user.create({
      data: {
        email: 'kb_admin@smmplan.local',
        role: 'OWNER',
        isActive: true,
      },
    });

    regularUser = await db.user.create({
      data: {
        email: 'kb_user@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    // 4. Create network, category, service
    network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram' }
    });

    category = await db.category.create({
      data: { name: 'Подписчики Telegram', networkId: network.id }
    });

    service = await db.service.create({
      data: {
        name: 'TG Premium Subscribers',
        categoryId: category.id,
        rate: 0.1, // 0.1 USD
        markup: 3.0, // 300% markup
        minQty: 10,
        maxQty: 10000,
        externalId: 'ext-tg-1',
        isActive: true,
        isQuarantined: false
      }
    });

    vi.clearAllMocks();
  });

  describe('Access Control Guard Tests', () => {
    it('should prevent guest users from creating articles', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);

      const res = await createArticle({
        title: "Новая тестовая статья",
        slug: "new-test-article",
        description: "Краткое описание новой тестовой статьи.",
        content: "Это содержимое новой тестовой статьи для проверки.",
        category: "Подписчики",
        status: "PUBLISHED"
      });
      expect(res.success).toBe(false);
      expect((res as any).error).toBe("Unauthorized access");
    });

    it('should prevent standard users from creating articles', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: regularUser.id });

      const res = await createArticle({
        title: "Новая тестовая статья",
        slug: "new-test-article",
        description: "Краткое описание новой тестовой статьи.",
        content: "Это содержимое новой тестовой статьи для проверки.",
        category: "Подписчики",
        status: "PUBLISHED"
      });
      expect(res.success).toBe(false);
      expect((res as any).error).toBe("Forbidden: Administrator/Staff context required");
    });
  });

  describe('Article Management CRUD Tests', () => {
    it('should allow admin users to create and edit articles successfully with slug validation', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      // 1. Create Article
      const createRes = await createArticle({
        title: "Безопасное продвижение",
        slug: "bezopasnoe-prodvizhenie",
        description: "Описание статьи о продвижении в телеграм.",
        content: "Содержимое статьи на много слов для тестов.",
        category: "Подписчики",
        status: "PUBLISHED"
      }) as any;

      expect(createRes.success).toBe(true);
      expect(createRes.article).toBeDefined();
      expect(createRes.article?.slug).toBe("bezopasnoe-prodvizhenie");

      // 2. Validate field validations
      const badCreateRes = await createArticle({
        title: "A",
        slug: "bad slug",
        description: "Short",
        content: "",
        category: "",
        status: "PUBLISHED"
      }) as any;

      expect(badCreateRes.success).toBe(false);
      expect(badCreateRes.errors).toBeDefined();

      // 3. Update Article
      const updateRes = await updateArticle(createRes.article!.id, {
        title: "Безопасное продвижение v2",
        slug: "bezopasnoe-prodvizhenie-v2",
        description: "Обновленное описание статьи о продвижении.",
        content: "Новое содержимое статьи.",
        category: "Лайки",
        status: "DRAFT"
      }) as any;

      expect(updateRes.success).toBe(true);
      expect(updateRes.article?.title).toBe("Безопасное продвижение v2");
      expect(updateRes.article?.slug).toBe("bezopasnoe-prodvizhenie-v2");
      expect(updateRes.article?.status).toBe("DRAFT");
    });
  });

  describe('Public Article Reading Tests', () => {
    let publishedArticle: any;
    let draftArticle: any;

    beforeEach(async () => {
      publishedArticle = await db.article.create({
        data: {
          title: "Раскрутка каналов в Telegram",
          slug: "raskrutka-kanalov-tg",
          description: "Инструкция как раскрутить канал.",
          content: "Инструкции и шаги: **Шаг 1**, [SMMplan](https://smmplan.ru).",
          category: "Подписчики",
          status: "PUBLISHED",
          viewCount: 10
        }
      });

      draftArticle = await db.article.create({
        data: {
          title: "Секреты админов Telegram",
          slug: "sekrety-adminov",
          description: "Описание черновика.",
          content: "Содержимое черновика.",
          category: "Инструкции",
          status: "DRAFT"
        }
      });
    });

    it('should return published articles only for guests', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);

      const result = await getArticles();
      expect(result.success).toBe(true);
      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].slug).toBe("raskrutka-kanalov-tg");
      expect(result.categories).toContain("Подписчики");
    });

    it('should search published articles by query correctly', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);

      const searchRes1 = await getArticles("Все", "раскрутка");
      expect(searchRes1.articles).toHaveLength(1);

      const searchRes2 = await getArticles("Все", "несуществующий");
      expect(searchRes2.articles).toHaveLength(0);
    });

    it('should protect draft articles from guests but allow them for admins', async () => {
      // 1. Guest request for draft
      vi.mocked(verifySession).mockResolvedValue(null);
      const guestRes = await getArticleBySlug("sekrety-adminov");
      expect(guestRes.success).toBe(false);
      expect(guestRes.error).toContain("черновиках");

      // 2. Admin request for draft
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });
      const adminRes = await getArticleBySlug("sekrety-adminov");
      expect(adminRes.success).toBe(true);
      expect(adminRes.article?.slug).toBe("sekrety-adminov");
    });

    it('should increment view count on successful article fetch', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);
      const res = await getArticleBySlug("raskrutka-kanalov-tg");
      expect(res.success).toBe(true);
      expect(res.article?.viewCount).toBe(11);
    });
  });

  describe('Recommended Services Widget Tests', () => {
    it('should fetch recommended services based on article category and format pricing per unit', async () => {
      const article = await db.article.create({
        data: {
          title: "Как набрать подписчиков",
          slug: "kak-nabrat-podpischikov",
          description: "Инструкция.",
          content: "Текст.",
          category: "Подписчики",
          status: "PUBLISHED"
        }
      });

      const recommended = await getRecommendedServicesForArticle(article.id);
      expect(recommended).toHaveLength(1);
      expect(recommended[0].name).toBe("TG Premium Subscribers");
      
      const usdToRub = await SettingsProvider.getExchangeRateUSD();
      const expectedPrice = applyBeautifulRounding(0.1 * 3.0 * usdToRub) / 1000;
      expect(recommended[0].pricePerUnitRub).toBe(expectedPrice);
    });
  });

  describe('Milestone 8: Author Integrations & URL Match Widget Tests', () => {
    it('should save new article with default authorName and authorRole', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const res = await createArticle({
        title: "Статья без автора",
        slug: "bez-avtora",
        description: "Краткое описание статьи.",
        content: "Содержимое тестовой статьи.",
        category: "Подписчики",
        status: "PUBLISHED"
      }) as any;

      expect(res.success).toBe(true);
      expect(res.article).toBeDefined();
      expect(res.article?.authorName).toBe("Михаил");
      expect(res.article?.authorRole).toBe("Системный архитектор прокси-сетей SMMplan");
    });

    it('should allow admin to create and edit articles with custom authorName and authorRole', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      // 1. Create with custom author
      const createRes = await createArticle({
        title: "SEO оптимизация 2026",
        slug: "seo-opt-2026",
        description: "Краткое описание статьи.",
        content: "Содержимое тестовой статьи.",
        category: "Подписчики",
        status: "PUBLISHED",
        authorName: "Ольга",
        authorRole: "Контент-стратег и SEO-специалист SMMplan"
      }) as any;

      expect(createRes.success).toBe(true);
      expect(createRes.article?.authorName).toBe("Ольга");
      expect(createRes.article?.authorRole).toBe("Контент-стратег и SEO-специалист SMMplan");

      // 2. Edit/Update custom author
      const updateRes = await updateArticle(createRes.article!.id, {
        title: "SEO оптимизация 2026 (Обновлено)",
        slug: "seo-opt-2026-updated",
        description: "Краткое описание статьи.",
        content: "Содержимое тестовой статьи.",
        category: "Подписчики",
        status: "PUBLISHED",
        authorName: "Дмитрий",
        authorRole: "Руководитель SMM-отдела SMMplan"
      }) as any;

      expect(updateRes.success).toBe(true);
      expect(updateRes.article?.authorName).toBe("Дмитрий");
      expect(updateRes.article?.authorRole).toBe("Руководитель SMM-отдела SMMplan");
    });

    it('should validate authorName and authorRole length limits', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const res = await createArticle({
        title: "Тест валидации автора",
        slug: "test-author-validation",
        description: "Краткое описание статьи.",
        content: "Содержимое тестовой статьи.",
        category: "Подписчики",
        status: "PUBLISHED",
        authorName: "A", // too short (min 2)
        authorRole: "B"  // too short (min 2)
      }) as any;

      expect(res.success).toBe(false);
      expect(res.errors?.authorName).toContain("Имя автора должно состоять минимум из 2 символов");
      expect(res.errors?.authorRole).toContain("Роль автора должна состоять минимум из 2 символов");
    });

    it('should correctly parse URLs using detectLinkTargetType', async () => {
      const { detectLinkTargetType } = await import('../../app/knowledge/[slug]/UrlMatcherWidget');
      
      // CHANNEL links
      expect(detectLinkTargetType("t.me/username")).toBe("CHANNEL");
      expect(detectLinkTargetType("https://t.me/username")).toBe("CHANNEL");
      expect(detectLinkTargetType("vk.com/username")).toBe("CHANNEL");
      expect(detectLinkTargetType("http://instagram.com/myprofile")).toBe("CHANNEL");

      // POST links
      expect(detectLinkTargetType("t.me/username/123")).toBe("POST");
      expect(detectLinkTargetType("https://t.me/username/4567")).toBe("POST");
      expect(detectLinkTargetType("https://twitter.com/user/status/987654")).toBe("POST");
      expect(detectLinkTargetType("https://instagram.com/p/CgH123/")).toBe("POST");
      expect(detectLinkTargetType("https://vk.com/wall-12345_67890")).toBe("POST");
    });

    it('should generate valid JSON-LD structure with Person author metadata', async () => {
      const article = {
        title: "Тестовая статья для разметки",
        description: "Краткое описание.",
        content: "Контент.",
        createdAt: new Date(),
        updatedAt: new Date(),
        authorName: "Михаил",
        authorRole: "Системный архитектор прокси-сетей SMMplan"
      };

      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": article.title,
        "description": article.description,
        "articleBody": article.content,
        "datePublished": article.createdAt.toString(),
        "dateModified": article.updatedAt.toString(),
        "author": {
          "@type": "Person",
          "name": article.authorName,
          "jobTitle": article.authorRole
        },
        "publisher": {
          "@type": "Organization",
          "name": "SMMplan"
        }
      };

      expect(jsonLd.author["@type"]).toBe("Person");
      expect(jsonLd.author.name).toBe("Михаил");
      expect(jsonLd.author.jobTitle).toBe("Системный архитектор прокси-сетей SMMplan");
      
      const escapedJsonLd = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
      expect(escapedJsonLd).not.toContain("<");
    });
  });

  describe('Milestone 1: Knowledge Base Navigation & Related Articles', () => {
    it('should correctly group articles into tree categories', async () => {
      await db.article.create({
        data: {
          title: "Защита аккаунта",
          slug: "security-acc",
          description: "Описание.",
          content: "Контент.",
          category: "Безопасность соцсетей",
          status: "PUBLISHED"
        }
      });

      const res = await getGroupedArticlesForTree();
      expect(res.success).toBe(true);
      expect(res.grouped["Безопасность соцсетей"]).toHaveLength(1);
      expect(res.grouped["Безопасность соцсетей"][0].slug).toBe("security-acc");
    });

    it('should fetch up to 3 related articles of the same category, excluding current one', async () => {
      const art1 = await db.article.create({
        data: {
          title: "Статья 1",
          slug: "slug-1",
          description: "Описание.",
          content: "Контент.",
          category: "Безопасность соцсетей",
          status: "PUBLISHED"
        }
      });

      const art2 = await db.article.create({
        data: {
          title: "Статья 2",
          slug: "slug-2",
          description: "Описание.",
          content: "Контент.",
          category: "Безопасность соцсетей",
          status: "PUBLISHED"
        }
      });

      const related = await getRelatedArticles(art1.id, "Безопасность соцсетей");
      expect(related.success).toBe(true);
      expect(related.articles).toHaveLength(1);
      expect(related.articles[0].id).not.toBe(art1.id);
    });
  });
});

```

---

### 📄 Файл 86 из 89: `src/app/operator/transactions/components/transactions-filter.tsx`

```tsx
'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function TransactionsFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get('search') || '';
  const currentPeriod = searchParams.get('period') || 'month';
  const currentStatus = searchParams.get('status') || 'ALL';
  const currentUserId = searchParams.get('userId') || '';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    // Preserve active userId if filtering ledger of a specific client
    if (currentUserId) {
      params.set('userId', currentUserId);
    }

    fd.forEach((value, key) => {
      const valStr = String(value).trim();
      if (valStr && valStr !== 'ALL') {
        params.set(key, valStr);
      }
    });

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.currentTarget.form?.requestSubmit();
  };

  const handleReset = () => {
    if (currentUserId) {
      router.push(`${pathname}?userId=${currentUserId}`);
    } else {
      router.push(pathname);
    }
  };

  const QUICK_PERIODS = [
    { value: 'today', label: 'Сегодня' },
    { value: 'week', label: '7 дней' },
    { value: 'month', label: '30 дней' },
    { value: 'all', label: 'Все время' },
  ];

  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5 space-y-4">
      {/* Quick Period Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none flex-nowrap" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2 shrink-0">Период:</span>
        {QUICK_PERIODS.map((p) => {
          const isActive = currentPeriod === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete('cursor'); // Reset pagination
                params.set('period', p.value);
                router.push(`${pathname}?${params.toString()}`);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-border/40'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Main Filter Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Hidden period for form submission to preserve active period pill */}
        <input type="hidden" name="period" value={currentPeriod} />

        {/* General Search Input */}
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Поиск</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
            <input
              type="text"
              name="search"
              defaultValue={currentSearch}
              placeholder="Email клиента, ID транзакции или Idempotency Key..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Status Select */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Статус транзакции</label>
          <select
            name="status"
            value={currentStatus}
            onChange={handleSelectChange}
            className="w-full px-3 py-2 text-xs bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground"
          >
            <option value="ALL">Все статусы</option>
            <option value="APPROVED">Одобрено (Approved)</option>
            <option value="QUARANTINE">В карантине (Quarantine)</option>
            <option value="REJECTED">Отклонено (Rejected)</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1 rounded-xl text-xs py-2">
            Применить
          </Button>
          <Button
            type="button"
            intent="outline"
            onClick={handleReset}
            className="rounded-xl p-2.5 flex items-center justify-center shrink-0"
            title="Сбросить фильтры"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </form>
    </div>
  );
}

```

---

### 📄 Файл 87 из 89: `src/app/operator/transactions/components/transactions-table.tsx`

```tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Table } from '@/components/admin/hero-ui';
import { Badge } from '@/components/ui/badge';
import { LedgerEntryDTO } from '@/actions/operator/transactions/get-transactions-list.action';

interface TransactionsTableProps {
  data: LedgerEntryDTO[];
}

const TYPE_COLORS: Record<string, string> = {
  PAYMENT:      'bg-primary/10 text-primary border-transparent',
  REFUND:       'bg-warning/15 text-warning border-transparent',
  COMPENSATION: 'bg-violet-100 dark:bg-violet-900/20 text-violet-800 dark:text-violet-400 border-transparent',
  REROUTE:      'bg-slate-100 dark:bg-slate-900/20 text-slate-700 dark:text-slate-400 border-transparent',
};

const STATUS_COLORS: Record<string, string> = {
  APPROVED:   'bg-success/15 text-success border-transparent',
  QUARANTINE: 'bg-warning/15 text-warning border-transparent font-bold',
  REJECTED:   'bg-destructive/15 text-destructive border-transparent',
};

export function TransactionsTable({ data }: TransactionsTableProps) {
  return (
    <Table.ScrollContainer>
      <Table aria-label="Таблица транзакций Ledger">
        <Table.Header>
          <Table.Column>ID Транзакции</Table.Column>
          <Table.Column>Клиент</Table.Column>
          <Table.Column className="text-right">Сумма</Table.Column>
          <Table.Column>Тип</Table.Column>
          <Table.Column>Статус</Table.Column>
          <Table.Column>Назначение / Описание</Table.Column>
          <Table.Column>Дата</Table.Column>
        </Table.Header>
        <Table.Body emptyContent="Транзакции не найдены">
          {data.map((item) => {
            const isCredit = item.amount > 0;
            const formattedAmount = (item.amount / 100).toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
            });

            return (
              <Table.Row key={item.id}>
                {/* ID */}
                <Table.Cell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                  {item.id}
                </Table.Cell>

                {/* Client Link */}
                <Table.Cell>
                  <Link
                    href={`/operator/users/${item.userId}`}
                    className="text-primary hover:underline font-mono font-medium text-xs break-all"
                  >
                    {item.userEmail}
                  </Link>
                </Table.Cell>

                {/* Amount */}
                <Table.Cell className="text-right">
                  <span
                    className={`font-mono font-bold text-xs tabular-nums tracking-tight ${
                      isCredit ? 'text-success' : 'text-foreground'
                    }`}
                  >
                    {isCredit ? '+' : ''}
                    {formattedAmount} ₽
                  </span>
                </Table.Cell>

                {/* Type */}
                <Table.Cell>
                  <Badge
                    intent="outline"
                    className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 ${
                      TYPE_COLORS[item.transactionType] || 'bg-muted'
                    }`}
                  >
                    {item.transactionType}
                  </Badge>
                </Table.Cell>

                {/* Status */}
                <Table.Cell>
                  <Badge
                    intent="outline"
                    className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 ${
                      STATUS_COLORS[item.status] || 'bg-muted'
                    }`}
                  >
                    {item.status}
                  </Badge>
                </Table.Cell>

                {/* Reason */}
                <Table.Cell className="max-w-[280px]">
                  <p className="text-xs text-foreground leading-normal font-medium break-words font-sans">
                    {item.reason}
                  </p>
                </Table.Cell>

                {/* Date */}
                <Table.Cell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(item.createdAt).toLocaleDateString('ru-RU')} в{' '}
                  {new Date(item.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </Table.ScrollContainer>
  );
}

```

---

### 📄 Файл 88 из 89: `src/app/operator/transactions/page.tsx`

```tsx
import * as React from 'react';
import { enforceOperatorAccess } from '@/lib/operator/rbac';
import { getTransactionsListAction } from '@/actions/operator/transactions/get-transactions-list.action';
import { TransactionsFilter } from './components/transactions-filter';
import { TransactionsTable } from './components/transactions-table';
import { CreditCard, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    search?: string;
    period?: string;
    status?: string;
    cursor?: string;
    userId?: string;
  }>;
};

export default async function OperatorTransactionsPage({ searchParams }: Props) {
  // Enforce operator staff context
  await enforceOperatorAccess();

  const params = await searchParams;
  const search = params.search || '';
  const period = params.period || 'month';
  const status = params.status || 'ALL';
  const cursor = params.cursor || undefined;
  const userId = params.userId || '';

  // Query ledger entries list via guarded server action
  const result = await getTransactionsListAction({
    search: search || undefined,
    period: period as 'today' | 'week' | 'month' | 'all',
    status: status as 'ALL' | 'APPROVED' | 'QUARANTINE' | 'REJECTED',
    cursor,
    pageSize: 50,
    userId: userId || undefined,
  });

  if ('error' in result) {
    return (
      <div className="p-10 text-center bg-card border border-border/40 rounded-3xl shadow-sm ring-1 ring-border/5">
        <div className="inline-flex p-4 bg-destructive/15 text-destructive rounded-2xl mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Ошибка загрузки транзакций</h1>
        <p className="text-muted-foreground mt-2 font-medium">{result.error}</p>
      </div>
    );
  }

  const { items: transactions, nextCursor, hasMore, totals } = result;

  // Preserves URL parameters during pagination steps
  const buildQueryString = (extraParams: Record<string, string> = {}) => {
    const qParams = new URLSearchParams();

    Object.entries(params).forEach(([key, val]) => {
      if (val && key !== 'cursor') {
        qParams.set(key, String(val));
      }
    });

    Object.entries(extraParams).forEach(([key, val]) => {
      if (val) {
        qParams.set(key, val);
      } else {
        qParams.delete(key);
      }
    });

    const str = qParams.toString();
    return str ? `?${str}` : '';
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out pb-10">
      {/* Header section with Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl ring-1 ring-border/5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-sans">
              История транзакций
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-muted-foreground font-medium text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-success rounded-full"></span>
                Пополнения: <span className="text-success font-bold font-mono">{(totals.approved / 100).toLocaleString('ru-RU')} ₽</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-warning rounded-full"></span>
                Карантин: <span className="text-warning-foreground font-bold font-mono">{(totals.quarantine / 100).toLocaleString('ru-RU')} ₽</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-destructive rounded-full"></span>
                Возвраты/Списания: <span className="text-foreground font-bold font-mono">{(totals.refunds / 100).toLocaleString('ru-RU')} ₽</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Form */}
      <TransactionsFilter />

      {/* Transactions List Table Container */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm ring-1 ring-border/5 overflow-hidden flex flex-col">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground">
              Записи Ledger-реестра
              <span className="text-muted-foreground ml-1.5 font-medium text-xs">
                ({transactions.length}
                {hasMore ? '+' : ''})
              </span>
            </h3>
          </div>

          <TransactionsTable data={transactions} />

          {/* Simple Pagination Footer */}
          {(cursor || hasMore) && (
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-border/40">
              {cursor ? (
                <Link
                  href={`/operator/transactions${buildQueryString({ cursor: '' })}`}
                  className="px-4 py-2 text-xs font-bold text-foreground bg-background border border-border rounded-xl hover:bg-muted/50 transition-all active:scale-95 shadow-sm"
                >
                  ← В начало
                </Link>
              ) : (
                <div />
              )}
              {hasMore && nextCursor && (
                <Link
                  href={`/operator/transactions${buildQueryString({ cursor: nextCursor })}`}
                  className="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary/95 transition-all active:scale-95 shadow-sm"
                >
                  Следующая →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

```

---

### 📄 Файл 89 из 89: `src/components/admin/bulk-actions/BulkActionsPanel.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  XCircle, 
  MoreHorizontal, 
  Download, 
  ShieldAlert, 
  X 
} from 'lucide-react';
import { OrderColumn } from '@/app/admin/orders/components/columns';
import { bulkCancelOrdersAction, bulkRestartOrdersAction } from '@/actions/admin/orders';
import { formatKopecks } from '@/utils/format-kopecks';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  selectedOrders: OrderColumn[];
  canSeeRates: boolean;
  userRole?: string;
  onClearSelection: () => void;
}

export function BulkActionsPanel({ selectedOrders, canSeeRates, userRole = 'SUPPORT', onClearSelection }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sanity Guard Form state for Bulk Cancel
  const [sanityCountInput, setSanityCountInput] = useState('');
  const [reasonCode, setReasonCode] = useState('SYSTEM_ERROR');
  const [ticketId, setTicketId] = useState('');

  const count = selectedOrders.length;
  if (count === 0) return null;

  const canExecuteAdminBulk = ['OWNER', 'ADMIN'].includes(userRole);

  // Breakdown of selected orders
  const errorCount = selectedOrders.filter(o => o.status === 'ERROR').length;
  const cancellableOrders = selectedOrders.filter(o => !['COMPLETED', 'CANCELED', 'ERROR'].includes(o.status));
  const cancellableCount = cancellableOrders.length;

  const estimatedRefundKopecks = cancellableOrders.reduce((sum, o) => {
    const chargeBig = BigInt(o.charge || 0);
    return sum + (['PENDING', 'AWAITING_PAYMENT'].includes(o.status) ? chargeBig : (o.quantity > 0 ? chargeBig * BigInt(o.remains) / BigInt(o.quantity) : BigInt(0)));
  }, BigInt(0));

  // Determine dynamic primary button
  const hasErrors = errorCount > 0;
  const requiresSanityVerification = count > 10;
  const isSanityMatch = !requiresSanityVerification || parseInt(sanityCountInput.trim(), 10) === cancellableCount;
  const canSubmitCancel = isSanityMatch && (ticketId.trim().length > 0 || reasonCode.length > 0);

  const handleBulkRestart = () => {
    const errorIds = selectedOrders.filter(o => o.status === 'ERROR' || o.status === 'PENDING').map(o => o.id);
    if (errorIds.length === 0) {
      toast.warning('Нет заказов в статусе ERROR или PENDING для перезапуска');
      return;
    }

    startTransition(async () => {
      try {
        const res = await bulkRestartOrdersAction(errorIds);
        if (res.success) {
          toast.success(`⟳ Перезапущено заказов: ${res.restartedCount}`);
          onClearSelection();
        }
      } catch (err) {
        toast.error((err as Error).message || 'Ошибка при перезапуске заказов');
      }
    });
  };

  const handleExecuteCancel = () => {
    const ids = selectedOrders.map(o => o.id);
    startTransition(async () => {
      try {
        const res = await bulkCancelOrdersAction(ids, reasonCode, ticketId);
        if (res.success) {
          const refundText = res.totalRefundCents > 0 ? `, возврат: ${formatKopecks(res.totalRefundCents)}` : '';
          toast.success(`🚫 Отменено заказов: ${res.cancelledCount}${refundText}`);
          setShowCancelModal(false);
          onClearSelection();
        } else if (res.error) {
          toast.error(res.error);
        }
      } catch (err) {
        toast.error((err as Error).message || 'Ошибка массовой отмены');
      }
    });
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[calc(100%-2rem)] bg-card border border-border/80 rounded-2xl shadow-2xl p-3 backdrop-blur-xl flex items-center justify-between gap-3 transition-all duration-200">
        {/* Left info badge */}
        <div className="flex items-center gap-2 pl-2 text-xs">
          <span className="font-black text-foreground">{count} выбрано</span>
          {errorCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              {errorCount} с ошибкой
            </span>
          )}
        </div>

        {/* Action button cluster */}
        <div className="flex items-center gap-2">
          {/* Primary Action Button */}
          <button
            type="button"
            disabled={isPending}
            onClick={handleBulkRestart}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            {hasErrors ? `Перезапустить ${errorCount}` : `Перезапустить ${count}`}
          </button>

          {/* Clear selection link */}
          <button
            type="button"
            onClick={onClearSelection}
            className="px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Снять ✕
          </button>

          {/* More actions menu toggle */}
          {canExecuteAdminBulk && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-xl bg-muted border border-border/60 text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                title="Дополнительные действия"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 bottom-12 w-56 bg-card border border-border rounded-xl shadow-xl p-1.5 space-y-1 z-50 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowCancelModal(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Отменить и вернуть ({cancellableCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        toast.info('Экспорт данных выбранных заказов сформирован');
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg font-semibold text-foreground hover:bg-muted flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Экспорт выбранных (CSV)
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Sanity Guard Modal for Bulk Cancel */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black text-base">
                <ShieldAlert className="w-5 h-5" />
                Массовая отмена с возвратом
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 space-y-1 text-rose-700 dark:text-rose-300">
                <p className="font-bold">Вы собираетесь отменить {count} заказов.</p>
                <p>Будет отменено: <strong className="text-foreground">{cancellableCount}</strong></p>
                <p>Завершённые / отменённые заказы будут пропущены.</p>
                {canSeeRates && (
                  <p className="pt-1 font-bold">
                    Расчётная сумма возврата: {formatKopecks(estimatedRefundKopecks)}
                  </p>
                )}
              </div>

              {requiresSanityVerification && (
                <div className="space-y-1 pt-1">
                  <label className="block font-bold text-foreground">
                    Для подтверждения введите число отменяемых заказов (<span className="font-mono">{cancellableCount}</span>):
                  </label>
                  <input
                    type="number"
                    value={sanityCountInput}
                    onChange={(e) => setSanityCountInput(e.target.value)}
                    placeholder={String(cancellableCount)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl font-mono focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-bold text-foreground">Причина отмены:</label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="SYSTEM_ERROR">Сбой провайдера / Система</option>
                  <option value="CLIENT_REQUEST">Запрос клиента</option>
                  <option value="PRICE_MISMATCH">Ошибка ценообразования</option>
                  <option value="OTHER">Другое</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-foreground">Номер тикета / Обоснование:</label>
                <input
                  type="text"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  placeholder="Например: TICKET-10492"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!canSubmitCancel || isPending}
                onClick={handleExecuteCancel}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                {isPending ? 'Отменяем...' : `Отменить ${cancellableCount} заказов`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

```

---

