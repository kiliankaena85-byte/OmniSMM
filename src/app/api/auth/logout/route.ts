import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  decryptSessionToken, 
  readSessionTokenFromCookies, 
  SESSION_COOKIE_NAME, 
  LEGACY_SESSION_COOKIE_NAME 
} from '@/lib/session-edge';

async function deleteSessionFromDB(token?: string) {
  if (token) {
    try {
      const payload = await decryptSessionToken(token);
      if (payload && payload.sessionId) {
        await db.session.deleteMany({ where: { id: String(payload.sessionId) } }).catch(() => {});
        try {
          const { redis } = await import('@/lib/redis');
          await redis.set(`blacklist:session:${payload.sessionId}`, '1', 'EX', 86400);
        } catch {
          // audit-ignore: redis session blacklisting is secondary to DB session deletion
        }
      }
    } catch {
      // audit-ignore: ignore validation errors on logout
    }
  }
}

export async function GET(request: Request) {
  // Fail-Closed: GET logout is rejected unless Sec-Fetch-Site is same-origin or same-site (P2-18)
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (!secFetchSite || (secFetchSite !== 'same-origin' && secFetchSite !== 'same-site')) {
    return NextResponse.json({ error: 'GET logout rejected. Use POST method.' }, { status: 405 });
  }
  return POST(request);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = readSessionTokenFromCookies(cookieStore);
  await deleteSessionFromDB(token);
  
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);

  const reqHeaders = await headers();
  const hostHeader = reqHeaders.get('host');
  const fwdHost = reqHeaders.get('x-forwarded-host');
  const fwdProto = reqHeaders.get('x-forwarded-proto');

  let host = hostHeader || fwdHost || '';
  const ALLOWED_HOSTS = new Set([
    'smmplan.pro',
    'test.smmplan.pro',
    'smmflux.ru',
    'flux.smmplan.pro',
    'localhost',
    '127.0.0.1'
  ]);
  const cleanHost = host.split(':')[0].toLowerCase();
  if (!ALLOWED_HOSTS.has(cleanHost) || host.includes('0.0.0.0') || host.includes('host.docker.internal')) {
    host = process.env.NODE_ENV === 'production' 
      ? (process.env.APP_URL ? new URL(process.env.APP_URL).host : 'test.smmplan.pro') 
      : 'localhost:3000';
  }
  const proto = fwdProto || (process.env.NODE_ENV === 'production' && !host.includes('localhost') ? 'https' : 'http');
  const targetUrl = `${proto}://${host}/login`;

  const isFetch = request.headers.get('sec-fetch-mode') === 'cors' || 
                  request.headers.get('accept')?.includes('application/json') ||
                  request.headers.get('x-requested-with') === 'XMLHttpRequest';

  const response = isFetch 
    ? NextResponse.json({ success: true, redirect: targetUrl }) 
    : NextResponse.redirect(targetUrl, 303);

  response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return response;
}
