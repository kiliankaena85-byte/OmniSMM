import { NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/session";
import crypto from "crypto";
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';
import { sanitizeRedirectUrl } from '@/lib/security/redirect-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const tenant = normalizeTenantId(url.searchParams.get("tenant")) || "smmplan";
  const customRedirect = url.searchParams.get("redirectTo") || url.searchParams.get("redirect") || url.searchParams.get("returnUrl");

  const hostHeader = request.headers.get('host') || url.host || 'localhost:3005';
  const cleanHost = hostHeader.includes('0.0.0.0') ? hostHeader.replace('0.0.0.0', 'localhost') : hostHeader;
  const proto = request.headers.get('x-forwarded-proto') || (url.protocol.startsWith('https') ? 'https' : 'http');
  const baseUrl = `${proto}://${cleanHost}`;

  const loginBase = tenant === "flux" ? "/login?tenant=flux&" : "/login?";

  if (!token) {
    return NextResponse.redirect(new URL(`${loginBase}error=InvalidToken`, baseUrl));
  }

  const ipUsed = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "127.0.0.1";
  const userAgentUsed = request.headers.get("user-agent") || "Unknown";

  // ⛔ Guard: Telegram link preview fetches the URL automatically before the user clicks.
  // If the request is from TelegramBot crawler, return 200 without consuming the token.
  const isTelegramCrawler = /TelegramBot|Telegram\/|facebookexternalhit|Twitterbot|WhatsApp|LinkedInBot|Slackbot|Discordbot/i
    .test(userAgentUsed);
  if (isTelegramCrawler) {
    return new Response('OK', { status: 200 });
  }

  // Rate limiting: 10 req/min per IP (P2-13)
  const rateLimitKey = `rate:auth_verify:${ipUsed}`;
  try {
    const { redis } = await import('@/lib/redis');
    const currentCount = await redis.incr(rateLimitKey);
    if (currentCount === 1) {
      await redis.expire(rateLimitKey, 60);
    }
    if (currentCount > 10) {
      return NextResponse.redirect(new URL(`${loginBase}error=TooManyRequests`, baseUrl));
    }
  } catch {
    // audit-ignore: fail-open on rate limiting if Redis is temporarily offline
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Wrap in Serializable transaction with tight 2s grace window (P2-17)
  const txResult = await db.$transaction(async (tx) => {
    const record = await tx.authToken.findUnique({
      where: {
        token_tenantId: {
          token: hashedToken,
          tenantId: tenant,
        },
      },
    });

    if (!record || record.expiresAt < new Date()) {
      return { status: 'expired' as const };
    }

    if (record.used) {
      const isWithinGraceWindow = record.usedAt && (Date.now() - record.usedAt.getTime() < 2000);
      if (!isWithinGraceWindow) {
        return { status: 'already_used' as const };
      }
    } else {
      await tx.authToken.update({
        where: { id: record.id },
        data: {
          used: true,
          usedAt: new Date(),
          ipUsed,
          userAgentUsed,
        },
      });
    }

    // tenant-isolation-ignore: user resolved by authToken foreign key and verified in serializable tx
    const targetUser = await tx.user.findUnique({ where: { id: record.userId } });
    if (!targetUser || targetUser.isDeleted || !targetUser.isActive) {
      return { status: 'blocked' as const };
    }

    if (!targetUser.isEmailVerified) {
      // tenant-isolation-ignore: updating verified user email status
      await tx.user.update({ where: { id: targetUser.id }, data: { isEmailVerified: true } });
    }

    return { status: 'success' as const, user: targetUser };
  }, { isolationLevel: 'Serializable' });

  if (txResult.status === 'expired') {
    return NextResponse.redirect(new URL(`${loginBase}error=ExpiredToken`, baseUrl));
  }
  if (txResult.status === 'already_used') {
    return NextResponse.redirect(new URL(`${loginBase}error=AlreadyUsed`, baseUrl));
  }
  if (txResult.status === 'blocked') {
    return NextResponse.redirect(new URL(`${loginBase}error=AccountBlocked`, baseUrl));
  }

  const user = txResult.user;
  const { sessionToken, expiresAt } = await createSession(user.id, true);

  let destination = sanitizeRedirectUrl(customRedirect, user.role && ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'].includes(user.role) ? '/admin/dashboard' : '/dashboard');

  const isFlux = user.tenantId === 'flux' || tenant === 'flux';
  if (isFlux && !destination.includes('tenant=flux')) {
    destination += (destination.includes('?') ? '&' : '?') + 'tenant=flux';
  }

  const response = NextResponse.redirect(new URL(destination, baseUrl));

  // Clear any explicit logout blocker
  response.cookies.set('explicit_logout', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });

  // Auto-consent cookie on authenticated session creation (152-FZ compliance via Terms & Privacy acceptance)
  response.cookies.set('cookie_consent', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 31536000,
    sameSite: 'lax',
    path: '/',
  });

  if (['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT', 'OPERATOR'].includes(user.role)) {
    try {
      const { redis } = await import('@/lib/redis');
      await redis.set(`staff:${user.id}:active_tenant`, user.tenantId || 'smmplan', 'EX', 86400 * 30);
    } catch {
      // audit-ignore: redis staff active tenant cache is secondary to DB and cookie persistence
    }
  }

  response.cookies.set('x_tenant', user.tenantId || 'smmplan', {
    path: '/',
    expires: expiresAt,
  });

  response.cookies.set('x_admin_tenant', user.tenantId || 'smmplan', {
    path: '/',
    expires: expiresAt,
  });

  return response;
}
