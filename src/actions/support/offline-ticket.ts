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
 * @public Server Action: Submit offline support ticket directly from payment error screen
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
    const { SettingsProvider } = await import('@/lib/settings');
    const tenantId = await SettingsProvider.getTenantId();
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
          tenantId,
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

  } catch (error: unknown) {
    console.error('[createOfflineTicketAction] Unexpected core failure:', error);
    return { 
      success: false, 
      error: "Произошла непредвиденная ошибка на сервере при создании обращения." 
    };
  }
}
