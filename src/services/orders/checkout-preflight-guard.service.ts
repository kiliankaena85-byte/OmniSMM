/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Preflight security and parameter validation guard for checkout pipeline.
 */
import { assertDripFeedFloor } from '@/services/orders/drip-feed-floor';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { featureFlagService } from "@/services/system/feature-flag.service";
import { RateLimitService } from '@/services/core/rate-limit.service';
import { validateProhibitedContent } from '@/validators/prohibited-content';
import { verifySession } from '@/lib/session';
import { normalizeTenantId } from "@/lib/tenant-resolver-edge";
import { unifiedLinkEngine } from '@/services/link-engine/unified-link-engine';
import { mutateLink, getLinkValidator } from '@/validators/link-mutators';
import { resolveServiceTargetType } from '@/utils/target-type';
import { isUrlSafeForFetch } from '@/lib/ssrf-guard';
import { safeUrlForLog } from '@/lib/log-safe';

export interface PreflightOrderInput {
  serviceId: string;
  link: string;
  quantity: number;
  email: string;
  promoCodeStr?: string;
  runs?: number;
  interval?: number;
  customData?: string;
  gateway?: string;
  mediaGroupUrl?: string;
  isLinkOverridden?: boolean;
  isSmartDrip?: boolean;
  smartDripDays?: number;
  isRequirementsConfirmed?: boolean;
  tenantId?: string;
}

export type DbServiceWithCategory = NonNullable<Awaited<ReturnType<typeof db.service.findUnique<{
  where: { id: string };
  include: { category: { include: { network: true } } };
}>>>>;

export class CheckoutPreflightGuard {
  static async validate(data: PreflightOrderInput) {
    const {
      serviceId, link, quantity, email, promoCodeStr, runs, interval,
      customData, gateway, mediaGroupUrl, isLinkOverridden, isSmartDrip,
      smartDripDays, isRequirementsConfirmed, tenantId: inputTenantId
    } = data;

    const normalizedPromo = promoCodeStr ? promoCodeStr.trim().toUpperCase() : undefined;
    const effectiveRuns = isSmartDrip ? undefined : runs;
    const effectiveInterval = isSmartDrip ? undefined : interval;
    const hasMediaGroup = !!(mediaGroupUrl && mediaGroupUrl.trim().length > 5);

    // 1. Feature Flags
    if (normalizedPromo) {
      const isPromoEnabled = await featureFlagService.isEnabled('promo_codes');
      if (!isPromoEnabled) throw new Error("Использование промокодов временно отключено");
    }

    if (isSmartDrip || effectiveRuns || effectiveInterval) {
      const isDripEnabled = await featureFlagService.isEnabled('drip_feed');
      if (!isDripEnabled) throw new Error("Функция Drip-feed временно отключена");
    }

    if (isSmartDrip && (!smartDripDays || smartDripDays < 1 || smartDripDays > 30)) {
      throw new Error("Необходимо указать количество дней (1-30) для Умного Dripfeed");
    }

    // 2. Gateway Whitelist
    const ALLOWED_GATEWAYS = ['yookassa', 'cryptobot', 'robokassa', 'balance'];
    if (gateway && !ALLOWED_GATEWAYS.includes(gateway.toLowerCase())) {
      throw new Error("Неподдерживаемый способ оплаты");
    }

    // 3. Rate Limit
    const isAllowed = await RateLimitService.check("checkoutCore", 15, 60, true);
    if (!isAllowed) throw new Error("Слишком много запросов. Попробуйте через минуту.");

    // 4. Content Guard & Legal Compliance
    const contentCheck = validateProhibitedContent(link, customData);
    if (!contentCheck.isAllowed) {
      throw new Error(contentCheck.error || "Продвижение государственных служб и политических ресурсов строго запрещено");
    }

    // 5. Balance IDOR Prevention
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

    // 6. Email validation
    if (!email || !email.includes('@')) {
      throw new Error("Введите корректный email");
    }

    // 7. Service resolution & validation
    const service = await db.service.findUnique({
      where: { id: serviceId },
      include: { category: { include: { network: true } } }
    });
    if (!service || !service.isActive) {
      throw new Error("Услуга не найдена или неактивна");
    }

    // 8. Multi-Tenant isolation
    let rawTenantId: string | null = null;
    try {
      const reqHeaders = await headers();
      rawTenantId = reqHeaders.get("x-tenant-id");
    } catch {
      // CLI / fallback
    }
    const currentTenantId = (inputTenantId && inputTenantId.trim())
      ? (normalizeTenantId(inputTenantId.trim()) === 'flux' ? 'flux' : inputTenantId.trim())
      : (normalizeTenantId(rawTenantId) || "smmplan");

    const isInvestorTenant = currentTenantId !== 'smmplan' && currentTenantId !== 'flux';
    const isServiceTenantAllowed =
      !service.tenantId ||
      service.tenantId === 'all' ||
      service.tenantId === currentTenantId ||
      (isInvestorTenant && service.tenantId === 'smmplan');

    if (!isServiceTenantAllowed) {
      throw new Error("Услуга недоступна для текущей площадки");
    }

    if (service.clientRequirement && !isRequirementsConfirmed) {
      throw new Error("Необходимо подтвердить выполнение условий для старта услуги");
    }

    if (service.cooldownUntil && new Date(service.cooldownUntil) > new Date()) {
      throw new Error(`Временно приостановлено для контроля качества. Ожидание: 1-12 часов. Выберите аналог.`);
    }

    if (!service.externalId) {
      throw new Error("Услуга не привязана к провайдеру");
    }

    if (effectiveRuns && !service.isDripFeedEnabled) {
      throw new Error("Эта услуга не поддерживает Drip-feed (постепенную подачу)");
    }

    if (quantity < service.minQty || quantity > service.maxQty) {
      throw new Error(`Количество должно быть от ${service.minQty} до ${service.maxQty}`);
    }

    // Drip-Feed Floor Invariant (must match CheckoutTransactionService exactly)
    if (effectiveRuns && effectiveRuns > 0) {
      assertDripFeedFloor(quantity, effectiveRuns, service.minQty, 'runs');
    } else if (isSmartDrip && smartDripDays && smartDripDays > 0) {
      assertDripFeedFloor(quantity, smartDripDays, service.minQty, 'smart');
    }

    if (customData && customData.length > 2000) {
      throw new Error('Слишком длинные пользовательские данные (макс. 2000 символов)');
    }

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

    // 9. Link validation & SSRF security
    let normalizedLink = link.trim();
    const platformSlug = service.category?.network?.slug?.toUpperCase() || '';

    if (isLinkOverridden) {
      if (!/^https?:\/\//i.test(normalizedLink) && normalizedLink.includes('.')) {
        normalizedLink = 'https://' + normalizedLink;
      }
      if (!/^https?:\/\//i.test(normalizedLink)) {
        throw new Error("Ссылка в обход валидации должна быть корректным URL (начинаться с http:// или https://)");
      }
      try {
        const u = new URL(normalizedLink);
        const host = u.hostname.toLowerCase();
        if (!host.includes('.') && host !== 't.me' && host !== 'vk.cc') {
          throw new Error("Указан некорректный домен ссылки.");
        }
        if (!isUrlSafeForFetch(normalizedLink)) {
          throw new Error("Указанный адрес заблокирован политикой безопасности.");
        }
      } catch (e: unknown) {
        if (e instanceof Error && (e.message.includes("домен") || e.message.includes("безопасности"))) {
          throw e;
        }
        console.error(`[Checkout] Link mutation failed for ${safeUrlForLog(link)}:`, e);
        throw new Error("Неверный формат ссылки.", { cause: e });
      }
    } else {
      const valResult = await unifiedLinkEngine.validateForService(link, service, customData);
      if (!valResult.isValid) {
        throw new Error(valResult.error || "Неверный формат ссылки.");
      }
      normalizedLink = valResult.canonicalUrl;
    }

    // 10. Media group URL validation
    let normalizedMediaGroupLink: string | undefined;
    if (hasMediaGroup) {
      const mgTrimmed = mediaGroupUrl!.trim();
      if (isLinkOverridden) {
        normalizedMediaGroupLink = mgTrimmed;
        if (!/^https?:\/\//i.test(normalizedMediaGroupLink) && normalizedMediaGroupLink.includes('.')) {
          normalizedMediaGroupLink = 'https://' + normalizedMediaGroupLink;
        }
      } else {
        const targetType = resolveServiceTargetType(service);
        normalizedMediaGroupLink = mutateLink(mgTrimmed, platformSlug, targetType);
        const validator = getLinkValidator(platformSlug, targetType);
        const mgLinkResult = validator.safeParse(normalizedMediaGroupLink);
        if (!mgLinkResult.success) {
          throw new Error(`Некорректная ссылка на последнее медиа: ${mgLinkResult.error.errors[0].message}`);
        }
      }
    }

    return {
      service,
      normalizedPromo,
      effectiveRuns,
      effectiveInterval,
      hasMediaGroup,
      normalizedLink,
      normalizedMediaGroupLink,
      tenantId: currentTenantId
    };
  }
}
