'use server';

import { z } from "zod";
import { db } from "@/lib/db";
import { sendMagicLink, sendWelcomeLetter } from "@/lib/smtp";
import { RateLimitService } from "@/services/core/rate-limit.service";
import { logger } from "@/lib/logger";
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/utils/ip";
import { normalizeTenantId } from "@/lib/tenant-resolver-edge";

import { verifySmartCaptchaToken } from "@/services/security/smartcaptcha.service";

const log = logger.child({ component: 'MagicLink' });

const schema = z.object({
  email: z.string().email("Введите корректный email"),
  redirectTo: z.string().optional(),
  captchaToken: z.string().optional(),
});

/** @public Public magic link request action */
export async function requestMagicLink(prevState: unknown, formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { error: "Некорректные данные формы", success: false };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  const cleanEmail = parsed.data.email.toLowerCase();
  const redirectTo = parsed.data.redirectTo;
  const captchaToken = parsed.data.captchaToken;

  try {
    const clientIp = await getClientIp().catch(() => '127.0.0.1');

    // SmartCaptcha Validation (Fail-closed in production if enabled)
    const captchaResult = await verifySmartCaptchaToken(captchaToken, clientIp);
    if (!captchaResult.success) {
      log.warn('Magic link request blocked by SmartCaptcha', { ip: clientIp, email: cleanEmail });
      return { error: captchaResult.error || "Проверка капчи не пройдена", success: false };
    }
    const headerStore = await headers();
    const userAgent = headerStore.get('user-agent') || 'Unknown';

    // Rate limit by IP (20 per hour)
    const ipLimit = await rateLimit(`ml:ip:${clientIp}`, 20, 3600);
    if (!ipLimit.ok) {
      log.warn('Magic link rate limit exceeded IP', { ip: clientIp, email: cleanEmail });
      return { error: "Слишком много запросов с вашего IP. Пожалуйста, подождите перед новым запросом.", success: false };
    }

    // Rate limit by email (5 per hour)
    const emailLimit = await rateLimit(`ml:email:${cleanEmail}`, 5, 3600);
    if (!emailLimit.ok) {
      log.warn('Magic link rate limit exceeded email', { email: cleanEmail });
      return { error: "Слишком много запросов Magic Link на этот email. Пожалуйста, подождите перед новым запросом.", success: false };
    }

    const reqHeaders = await headers();
    const rawTenantId = reqHeaders.get("x-tenant-id");
    const tenantId = normalizeTenantId(rawTenantId) || "smmplan";

    const cookieStore = await cookies();
    const refCode = cookieStore.get("ref")?.value;
    let referredById = null;

    if (refCode) {
      const cleanRefCode = refCode.trim();
      const referrer = await db.user.findFirst({
        where: { referralCode: cleanRefCode, tenantId },
      });
      if (referrer) {
        const { ReferralValidatorService } = await import('@/services/referral/referral-validator.service');
        const validation = await ReferralValidatorService.validateReferralLink(referrer.id, null, {
          inviteeEmail: cleanEmail,
          tenantId,
        });
        if (validation.valid && validation.riskLevel !== 'CRITICAL') {
          referredById = referrer.id;
        } else {
          log.warn('Referral rejected by Anti-Fraud shield', { refCode: cleanRefCode, email: cleanEmail, reason: validation.reason });
        }
      }
    }

    const txResult = await db.$transaction(async (tx) => {
      let isNewUser = false;
      
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
          tenantId,
          expiresAt,
          ipIssued: clientIp,
          userAgentIssued: userAgent,
        },
      });

      return { type: 'success' as const, user, isNewUser, rawToken, tenantId };
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
      await sendMagicLink(cleanEmail, rawToken, tenantId, redirectTo);
      if (isNewUser) {
        sendWelcomeLetter(cleanEmail, tenantId).catch(console.error);
      }
    } catch (smtpError) {
      log.error('Magic link SMTP error', { error: smtpError });
      console.error("Exact SMTP error:", smtpError);

      // Only soft-delete newly created user in strict production (real SMTP failure).
      // In dev / staging / when ISP blocks port 465 — sendMagicLink already prints the link
      // to console and returns silently, so this catch block is only reached for genuine
      // prod failures. Guard with extra env check to be safe.
      const isTestEnv = process.env.APP_URL?.includes('test.smmplan.pro') ||
        process.env.NODE_ENV !== 'production' ||
        process.env.DEV_MOCK_SMTP === 'true';

      if (isNewUser && !isTestEnv) {
        log.info('Soft-deleting newly created user due to SMTP failure in production', { email: cleanEmail });
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
        return { error: "Не удалось отправить письмо. Проверьте правильность email или попробуйте позже.", success: false };
      }

      // In test/dev: user is created, magic link is in console — return success so UI shows
      // "Ссылка отправлена" and user can copy the link from server logs.
      log.info('[DEV] SMTP unavailable but user created — magic link is in server console', { email: cleanEmail });
      return { success: true, error: null };
    }

    return { success: true, error: null };
  } catch (error) {
    log.error('Magic link request failed', { error: error instanceof Error ? error.message : String(error) });
    return { error: "Произошла ошибка при обработке запроса", success: false };
  }
}
