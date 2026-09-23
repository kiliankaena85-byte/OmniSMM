import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SignJWT } from 'jose';
import { getEncodedKey, SESSION_COOKIE_NAME } from '@/lib/session-edge';
import { resolveContourFromHost } from '@/lib/tenant-resolver-edge';

export async function GET(request: Request) {
  let host = '';
  try {
    host = request.headers.get('host') || '';
    if (!host) {
      const reqHeaders = await headers();
      host = reqHeaders.get('host') || '';
    }
  } catch {
    host = '';
  }
  const isDev = process.env.NODE_ENV === 'development';
  const isTest = process.env.APP_ENV === 'test' || process.env.PLAYWRIGHT_TEST === 'true';
  const isAllowedHost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('3005');

  // Strict Fail-Closed: Never allow dev-login in production or outside isolated local/stage environments
  if (!isDev && !isTest) {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (!isAllowedHost && !isDev) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const url = new URL(request.url);
  const role = (url.searchParams.get('role') || 'SUPPORT').toUpperCase();
  const redirectTo = url.searchParams.get('redirect') || '/admin/tickets';
  const tenantId = url.searchParams.get('tenant') || 'smmplan';

  const targetEmail = role === 'OWNER' ? 'owner@smmplan.pro' :
                      role === 'ADMIN' ? 'admin@smmplan.pro' :
                      role === 'SUPPORT' ? 'support@smmplan.pro' : 'testclient1@example.com';

  let user = await db.user.findFirst({
    where: { email: targetEmail, tenantId }
  });

  if (!user) {
    user = await db.user.findFirst({
      where: { role: role as any, tenantId }
    });
  }

  if (!user) {
    // Try finding by email first, then create if missing
    user = await db.user.findFirst({ where: { email: targetEmail, tenantId } });
    if (!user) {
      user = await db.user.create({
        data: {
          email: targetEmail,
          passwordHash: 'dummy_hash',
          role: role as any,
          tenantId,
          balance: BigInt(500000),
        }
      });
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: { role: role as any, tenantId },
      });
    }
  }

  const userAgent = request.headers.get('user-agent') || 'stage-browser';
  const contour = resolveContourFromHost(host);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const session = await db.session.create({
    data: {
      userId: user.id,
      expiresAt,
      userAgent,
      ipAddress: '127.0.0.1',
    }
  });

  const isStaff = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT', 'OPERATOR'].includes(user.role);
  const jwtRole = isStaff ? undefined : user.role;

  const sessionToken = await new SignJWT({
    sessionId: session.id,
    userId: user.id,
    canResetPassword: false,
    ...(jwtRole ? { role: jwtRole } : {}),
    tenantId: user.tenantId || 'smmplan',
    contour: 'test',
    sessionVer: 1,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getEncodedKey());

  const hostHeader = host || 'localhost:3005';
  const cleanHost = hostHeader.includes('0.0.0.0') ? hostHeader.replace('0.0.0.0', 'localhost') : hostHeader;
  const redirectTarget = new URL(redirectTo, `http://${cleanHost}`);

  const response = NextResponse.redirect(redirectTarget, 307);

  // Wipe any explicit logout blocker
  response.cookies.set('explicit_logout', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  response.cookies.set('x_tenant', user.tenantId || 'smmplan', {
    path: '/',
    expires: expiresAt,
  });

  return response;
}