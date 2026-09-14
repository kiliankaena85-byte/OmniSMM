'use server';
import { Prisma } from '@prisma/client';

import { createSafeAction } from '@/lib/safe-action';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifySession, createSession } from '@/lib/session';
import { marketingService } from '@/services/marketing.service';
import { getBaseUrlSync } from "@/utils/get-base-url";
import { headers } from 'next/headers';
import { getClientIp } from '@/utils/ip';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { SettingsManager, SettingsProvider } from '@/lib/settings';
import { WalletOps, WalletInsufficientFundsError, WalletUserNotFoundError, WalletInvalidAmountError } from '@/services/financial/wallet-ops';
import { runSerializableTransaction } from '@/lib/transactions';
import { unifiedLinkEngine } from '@/services/link-engine/unified-link-engine';
import { inferTargetTypeFromCategory } from '@/utils/target-type';
import { AccountExistsError } from '@/utils/error-handler';

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

const parseMassOrderText = async (text: string, tenantId?: string) => {
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
      errors.push({ line: i + 1, text: line, error: 'Неверный формат. Ожидается: ID_Услуги | Ссылка | Количество' });
      continue;
    }

    const [idStr, link, qtyStr] = parts;
    const numericId = parseInt(idStr, 10);
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
      where: { numericId: { in: numericIds }, isActive: true, ...(tenantId ? { tenantId } : {}) },
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

      // 2. Link Normalization and Validation via UnifiedLinkEngine
      try {
        const valResult = await unifiedLinkEngine.validateForService(order.link, service);
        if (!valResult.isValid) {
          errors.push({
            line: i + 1,
            text: `${order.numericId} | ${order.link} | ${order.quantity}`,
            error: valResult.error || 'Некорректный формат ссылки'
          });
          continue;
        }
        order.link = valResult.canonicalUrl;
      } catch (err: unknown) {
        console.warn(`[MassOrder] Link analyzer error on line ${i + 1}:`, err);
      }

      order.serviceId = service.id;
      order.providerId = service.providerId;
      order.providerServiceId = service.externalId;
    }
  }

  const validOrders = orders.filter(o => o.serviceId !== '');
  return { orders: validOrders, errors };
};

export const massOrderCalculateAction = async (input: { text: string }) => {
  return createSafeAction(z.object({ text: z.string() }), input, async (data: { text: string }) => {
    const session = await verifySession();
    const userId = session?.userId;
    const tenantId = (await SettingsProvider.getTenantId()) || 'smmplan';
    
    const { orders, errors } = await parseMassOrderText(data.text, tenantId);
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
    const services = await db.service.findMany({ where: { id: { in: serviceIds }, tenantId } });
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
       } catch (e: unknown) {
         errors.push({ line: -1, text: order.link, error: (e instanceof Error ? e.message : String(e)) });
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
       // CHK-02: prevent guest orders binding to existing password-protected accounts (same guard as checkout.ts)
       if (user?.passwordHash) {
         throw new AccountExistsError(lowerEmail);
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
        where: { idempotencyKey: `${idempotencyKey}_order_0`, userId: user.id, tenantId: user.tenantId },
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

    const { orders } = await parseMassOrderText(text, user.tenantId);
    if (orders.length === 0) throw new Error("Нет валидных строк для заказа");

    let totalCents = 0;
    const orderCreationData: Prisma.OrderCreateManyInput[] = [];
    
    // W2-3: Generate unique keys for each order in the batch, rather than re-using the checkout request's idempotency key
    const crypto = (await import('crypto')).default;
    const isTestMode = await SettingsManager.isTestMode(); // W4-5 FIX

    // W4-4 FIX: Preload services to avoid N+1 queries in loop
    const serviceIds = orders.map(o => o.serviceId);
    const services = await db.service.findMany({ where: { id: { in: serviceIds }, tenantId: user.tenantId } });
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

    // 54-ФЗ: CryptoBot не пробивает чеки. Лимит для физлиц до решения по облачной ККТ.
    // TODO: интегрировать облачную ККТ (АТОЛ/Эвотор) для снятия лимита.
    if (gateway === 'cryptobot' && paymentAmount > 1_500_000) {
      throw new Error('Криптовалюта доступна для пополнений до 15 000 ₽. Для больших сумм используйте карту.');
    }

    // Create Payment and Orders in Serializable Transaction (TOCTOU & Race Condition Defense)
    const isBalancePayment = gateway === 'balance';

    const result = await runSerializableTransaction(async (tx) => {
      if (isBalancePayment) {
        await WalletOps.charge(
          tx,
          user.id,
          totalCents,
          `Массовый заказ (${orders.length} шт.)`,
          {
            idempotencyKey: idempotencyKey ? `mass-charge-${idempotencyKey}` : undefined,
            tenantId: user.tenantId
          }
        );
      }

      const payment = await tx.payment.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          amount: paymentAmount,
          currency: 'RUB',
          status: isBalancePayment ? 'SUCCEEDED' : 'PENDING',
          gateway,
          consentIp,
          consentUserAgent
        }
      });

      // We assign paymentId directly in the bulk create
      await tx.order.createMany({
        data: orderCreationData.map(o => ({
          ...o,
          paymentId: payment.id,
          status: isBalancePayment ? ('PENDING' as const) : ('AWAITING_PAYMENT' as const)
        }))
      });

      return { paymentId: payment.id };
    });


    const fwdHost = reqHeaders.get("x-forwarded-host");
    const hostHeader = reqHeaders.get("host");
    let host = fwdHost || hostHeader || new URL(getBaseUrlSync()).host;
    if (host.includes("0.0.0.0") || host.includes("host.docker.internal")) {
      host = process.env.NODE_ENV === "production" ? "test.smmplan.pro" : "localhost:3000";
    }
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

    if (isBalancePayment) {
      const { ordersQueue } = await import('@/lib/queue-manager');
      const createdOrders = await db.order.findMany({
        where: { paymentId: result.paymentId, tenantId: user.tenantId },
        select: { id: true, numericId: true }
      });
      for (const ord of createdOrders) {
        await ordersQueue.add('order-dispatch', { orderId: ord.id }, { jobId: `dispatch-${ord.id}`, delay: 3 * 60 * 1000 });
      }

      if (user.email) {
        const { sendOrderBalanceDebitMail } = await import('@/lib/smtp');
        void sendOrderBalanceDebitMail({
          email: user.email,
          orderId: `MASS-${result.paymentId.slice(-6).toUpperCase()}`,
          serviceName: `Массовый заказ (${orders.length} шт.)`,
          chargedCents: totalCents,
          tenantId: user.tenantId
        }).catch((err: unknown) => console.error('[MassCheckout] sendOrderBalanceDebitMail failed', err));
      }

      if (!session && isNewUser) {
        await createSession(user.id);
      }

      return { 
        paymentId: result.paymentId,
        paymentUrl: null,
        redirectUrl: `/dashboard/orders?success=1&mass=1&payment=balance`
      };
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
        isTestMode: isTestMode,
        gateway: (gateway || 'yookassa') as "yookassa" | "cryptobot" | "robokassa",
        metadata: { type: 'checkout' }
      });
      
      paymentUrl = `/payment-redirect?id=${result.paymentId}`;

    } catch (gatewayErr: unknown) {
      console.error('[MassCheckout] Queue push failed', gatewayErr);
      await db.payment.update({
        where: { id: result.paymentId },
        data: { status: 'CANCELED' }
      });
      await db.order.updateMany({
        where: { paymentId: result.paymentId, tenantId: user.tenantId },
        data: { status: 'ERROR', error: (gatewayErr instanceof Error ? gatewayErr.message : String(gatewayErr)) || 'Ошибка генерации платежа' }
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
      throw new Error((gatewayErr instanceof Error ? gatewayErr.message : String(gatewayErr)) || 'Ошибка на стороне платежного шлюза. Попробуйте другой метод', { cause: gatewayErr });
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
       // CHK-02: prevent guest orders binding to existing password-protected accounts (same guard as checkout.ts)
       if (user?.passwordHash) {
         throw new AccountExistsError(lowerEmail);
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
        where: { idempotencyKey: `${idempotencyKey}_order_0`, userId: user.id, tenantId: user.tenantId },
        include: { payment: true }
      });
      if (existingOrder && existingOrder.payment) {
        return {
          paymentId: existingOrder.paymentId,
          paymentUrl: existingOrder.payment.checkoutUrl || ''
        };
      }
    }

    let reqHeaders: { get: (key: string) => string | null };
    try {
      reqHeaders = await headers();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      reqHeaders = {
        get: (key: string) => {
          if (key === 'host') return new URL(getBaseUrlSync()).host;
          if (key === 'x-forwarded-proto') return 'http';
          return null;
        }
      };
    }
    const consentIp = await getClientIp();
    const consentUserAgent = reqHeaders.get("user-agent") || "Unknown";

    let totalCents = 0;
    const orderCreationData: Prisma.OrderCreateManyInput[] = [];
    const isTestMode = await SettingsManager.isTestMode();

    const serviceIds = rawOrders.map(o => o.serviceId);
    const services = await db.service.findMany({ 
      where: { id: { in: serviceIds }, tenantId: user.tenantId },
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

       // Link Normalization and Validation via UnifiedLinkEngine
       const valResult = await unifiedLinkEngine.validateForService(order.link, service);
       if (!valResult.isValid) {
         throw new Error(`Ошибка в ссылке ${order.link}: ${valResult.error || 'неверный формат'}`);
       }
       const normalizedLink = valResult.canonicalUrl;

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

    // 54-ФЗ: CryptoBot не пробивает чеки. Лимит для физлиц до решения по облачной ККТ.
    // TODO: интегрировать облачную ККТ (АТОЛ/Эвотор) для снятия лимита.
    if (gateway === 'cryptobot' && paymentAmount > 1_500_000) {
      throw new Error('Криптовалюта доступна для пополнений до 15 000 ₽. Для больших сумм используйте карту.');
    }

    if (gateway === 'balance' && user.balance < totalCents) {
      throw new Error("Недостаточно средств на балансе");
    }

    const isBalancePayment = gateway === 'balance';

    // C-1 FIX: Use runSerializableTransaction for TOCTOU protection and
    // actually deduct balance when gateway is 'balance', matching the
    // pattern from massOrderCheckoutAction.
    const result = await runSerializableTransaction(async (tx) => {
      if (isBalancePayment) {
        await WalletOps.charge(
          tx,
          user.id,
          totalCents,
          `Структурированный массовый заказ (${rawOrders.length} шт.)`,
          {
            idempotencyKey: idempotencyKey ? `structured-mass-charge-${idempotencyKey}` : undefined,
            tenantId: user.tenantId
          }
        );
      }

      const payment = await tx.payment.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          amount: paymentAmount,
          currency: 'RUB',
          status: isBalancePayment ? 'SUCCEEDED' : 'PENDING',
          gateway,
          consentIp,
          consentUserAgent
        }
      });

      await tx.order.createMany({
        data: orderCreationData.map(o => ({
          ...o,
          paymentId: payment.id,
          status: isBalancePayment ? ('PENDING' as const) : ('AWAITING_PAYMENT' as const)
        }))
      });

      return { paymentId: payment.id };
    });

    let paymentUrl: string | undefined;
    const fwdHost = reqHeaders.get("x-forwarded-host");
    const hostHeader = reqHeaders.get("host");
    let host = fwdHost || hostHeader || new URL(getBaseUrlSync()).host;
    if (host.includes("0.0.0.0") || host.includes("host.docker.internal")) {
      host = process.env.NODE_ENV === "production" ? "test.smmplan.pro" : "localhost:3000";
    }
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

    if (isBalancePayment) {
      const { ordersQueue } = await import('@/lib/queue-manager');
      const createdOrders = await db.order.findMany({
        where: { paymentId: result.paymentId, tenantId: user.tenantId },
        select: { id: true, numericId: true }
      });
      for (const ord of createdOrders) {
        await ordersQueue.add('order-dispatch', { orderId: ord.id }, { jobId: `dispatch-${ord.id}`, delay: 3 * 60 * 1000 });
      }

      if (user.email) {
        const { sendOrderBalanceDebitMail } = await import('@/lib/smtp');
        void sendOrderBalanceDebitMail({
          email: user.email,
          orderId: `MASS-${result.paymentId.slice(-6).toUpperCase()}`,
          serviceName: `Структурированный заказ (${rawOrders.length} шт.)`,
          chargedCents: totalCents,
          tenantId: user.tenantId
        }).catch((err: unknown) => console.error('[MassCheckout] sendOrderBalanceDebitMail failed', err));
      }

      if (!session && isNewUser) {
        await createSession(user.id);
      }

      return { 
        paymentId: result.paymentId,
        paymentUrl: null,
        redirectUrl: `/dashboard/orders?success=1&mass=1&payment=balance`
      };
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
        isTestMode: isTestMode,
        gateway: (gateway || 'yookassa') as "yookassa" | "cryptobot" | "robokassa",
        metadata: { type: 'checkout' }
      });
      
      paymentUrl = `/payment-redirect?id=${result.paymentId}`;

    } catch (gatewayErr: unknown) {
      console.error('[MassCheckout] Gateway failed', gatewayErr);
      await db.payment.update({
        where: { id: result.paymentId },
        data: { status: 'CANCELED' }
      });
      await db.order.updateMany({
        where: { paymentId: result.paymentId, tenantId: user.tenantId },
        data: { status: 'ERROR', error: (gatewayErr instanceof Error ? gatewayErr.message : String(gatewayErr)) || 'Ошибка генерации платежа' }
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
      throw new Error((gatewayErr instanceof Error ? gatewayErr.message : String(gatewayErr)) || 'Ошибка на стороне платежного шлюза. Попробуйте другой метод', { cause: gatewayErr });
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
