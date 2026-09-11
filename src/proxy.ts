import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { 
  decryptSessionToken, 
  readSessionTokenFromCookies, 
  SESSION_COOKIE_NAME, 
  LEGACY_SESSION_COOKIE_NAME 
} from '@/lib/session-edge';
import { ROUTES } from '@/lib/routes';
import { resolveTenantFromHostEdge, normalizeTenantId, resolveContourFromHost, type ContourId } from '@/lib/tenant-resolver-edge';

function clearSessionCookiesOnResponse(response: NextResponse) {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
  };
  response.cookies.set(SESSION_COOKIE_NAME, '', cookieOptions);
  response.cookies.set(LEGACY_SESSION_COOKIE_NAME, '', cookieOptions);
}

// Map of legacy routes to new static routes
const legacyRedirects: Record<string, string> = {
  '/register': '/login?tab=register',
  '/p/offer': ROUTES.LEGAL.TERMS,
  '/p/terms': ROUTES.LEGAL.TERMS,
  '/p/privacy': ROUTES.LEGAL.PRIVACY,
  '/p/refund': ROUTES.LEGAL.REFUND,
  '/p/faq': ROUTES.FAQ,
};

// N-10.3: Strict Trusted Contour Domain Allowlist
const TRUSTED_CONTOUR_MAP: Record<ContourId, Set<string>> = {
  test: new Set([
    'test.smmplan.pro',
    'test-flux.smmplan.pro',
    'flux.smmplan.pro',
    'flux.smmplan.ru',
    'smmflux.ru',
    'www.smmflux.ru',
    'smmplan.pro',
    'www.smmplan.pro',
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'host.docker.internal',
  ]),
  prod: new Set([
    'smmplan.pro',
    'www.smmplan.pro',
    'test.smmplan.pro',
    'flux.smmplan.pro',
    'smmflux.ru',
    'www.smmflux.ru',
  ]),
  flux: new Set([
    'smmflux.ru',
    'www.smmflux.ru',
    'flux.smmplan.pro',
    'flux.smmplan.ru',
    'test-flux.smmplan.pro',
    'smmflux.local',
    'flux.local',
  ]),
};

// Base Known Root Domains
const KNOWN_ROOT_DOMAINS = [
  'smmplan.pro',
  'smmflux.ru',
  'smmplan.ru',
  'lovable.pro',
];

// Dynamic Tunnel & Testing Suffixes
const ALLOWED_TUNNEL_SUFFIXES = [
  '.ts.net',
  '.trycloudflare.com',
  '.loca.lt',
  '.ngrok-free.app',
  '.ngrok.app',
  '.ngrok.io',
];

const ALLOWED_CONTOUR_DOMAINS = new Set([
  'smmplan.pro',
  'www.smmplan.pro',
  'test.smmplan.pro',
  'test-flux.smmplan.pro',
  'smmflux.ru',
  'www.smmflux.ru',
  'flux.smmplan.pro',
  'flux.smmplan.ru',
  'smmflux.local',
  'flux.local',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'host.docker.internal'
]);

export const INTERNAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'host.docker.internal',
  'web',
  'smmplan_web',
  'tunnel',
  'smmplan_tunnel'
]);

export function isInternalHost(h: string | null | undefined): boolean {
  if (!h) return false;
  let clean = h.split(',')[0].trim().toLowerCase();
  if (clean.startsWith('[') && clean.includes(']')) {
    clean = clean.slice(1, clean.indexOf(']'));
  }
  clean = clean.split(':')[0];

  if (INTERNAL_HOSTS.has(clean)) return true;
  if (clean.endsWith('.ts.net') || clean.includes('tailscale')) return true;
  if (ALLOWED_TUNNEL_SUFFIXES.some(suffix => clean.endsWith(suffix))) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(clean)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(clean)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(clean)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d+\.\d+$/.test(clean)) return true;
  return false;
}

/**
 * Validates whether an incoming host is authorized (via root domain wildcard, tunnel suffix, internal network, or ENV).
 */
export function isKnownOrAllowedHost(h: string | null | undefined): boolean {
  if (!h) return false;
  let clean = h.split(',')[0].trim().toLowerCase();
  if (clean.startsWith('[') && clean.includes(']')) {
    clean = clean.slice(1, clean.indexOf(']'));
  }
  clean = clean.split(':')[0];
  
  if (isInternalHost(clean)) return true;

  // 1. Check root domains and all their subdomains (*.smmplan.pro, *.smmflux.ru, etc.)
  for (const root of KNOWN_ROOT_DOMAINS) {
    if (clean === root || clean.endsWith('.' + root)) {
      return true;
    }
  }

  // 2. Check tunnel suffixes (*.ts.net, *.trycloudflare.com, etc.)
  for (const suffix of ALLOWED_TUNNEL_SUFFIXES) {
    if (clean.endsWith(suffix)) {
      return true;
    }
  }

  // 3. Check explicit list
  if (ALLOWED_CONTOUR_DOMAINS.has(clean)) return true;

  // 4. Check dynamic environment variables
  const envList = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BASE_URL,
    process.env.TUNNEL_DOMAIN,
    process.env.ALLOWED_ORIGINS,
  ].filter(Boolean).join(',');

  if (envList) {
    const customHosts = envList.split(',').map(s => {
      try {
        return s.includes('://') ? new URL(s.trim()).host.split(':')[0].toLowerCase() : s.trim().split(':')[0].toLowerCase();
      } catch {
        return s.trim().split(':')[0].toLowerCase();
      }
    });
    if (customHosts.includes(clean)) return true;
  }

  return false;
}

function getActiveServerContour(): ContourId {
  if (process.env.CONTOUR === 'test' || process.env.CONTOUR === 'prod' || process.env.CONTOUR === 'flux') {
    return process.env.CONTOUR;
  }
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || '';
  if (appUrl) {
    try {
      return resolveContourFromHost(new URL(appUrl).host);
    } catch {
      // Ignore malformed appUrl fallback
    }
  }
  if (process.env.NODE_ENV === 'development') {
    return 'test';
  }
  return 'prod';
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Strip any client-supplied x-tenant-id to prevent spoofing
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-tenant-id');

  const hostHeader = request.headers.get('host');
  // Take ONLY the first value to defeat duplicate-header concat attacks
  const fwdHostRaw = request.headers.get('x-forwarded-host');
  const fwdHost = fwdHostRaw?.split(',')[0]?.trim() || null;
  const fwdProtoRaw = request.headers.get('x-forwarded-proto');
  const fwdProto = fwdProtoRaw?.split(',')[0]?.trim() || null;

  const rawHostClean = (hostHeader || '').split(',')[0].split(':')[0].toLowerCase().trim();
  const rawFwdClean = (fwdHost || '').split(':')[0].toLowerCase().trim();
  const isSecurityTxt = pathname === '/.well-known/security.txt' || pathname === '/security.txt';

  // CORS Whitelist for API routes
  const origin = request.headers.get('origin');
  let isAllowedOrigin = false;
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (isKnownOrAllowedHost(originHost)) {
        isAllowedOrigin = true;
      }
    } catch {
      isAllowedOrigin = false;
    }
  }

  // Handle CORS preflight requests for API routes
  if (pathname.startsWith('/api') && request.method === 'OPTIONS') {
    const preflightHeaders = new Headers();
    if (isAllowedOrigin && origin) {
      preflightHeaders.set('Access-Control-Allow-Origin', origin);
      preflightHeaders.set('Access-Control-Allow-Credentials', 'true');
      preflightHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      preflightHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id, idempotency-key');
      preflightHeaders.set('Access-Control-Max-Age', '86400');
      return new NextResponse(null, { status: 204, headers: preflightHeaders });
    }
    return new NextResponse(null, { status: 204 });
  }

  // EARLY REJECTION — before any host is used for redirects/cookies
  if (rawHostClean && !isKnownOrAllowedHost(rawHostClean) && !isSecurityTxt) {
    return NextResponse.json({ error: 'Forbidden: Invalid Host header' }, { status: 403 });
  }
  if (rawFwdClean && !isKnownOrAllowedHost(rawFwdClean) && !isSecurityTxt) {
    return NextResponse.json({ error: 'Forbidden: Invalid X-Forwarded-Host header' }, { status: 403 });
  }

  // 0.5. Echelon DDoS Shield & Anomaly Inspection (SPEC-2026-09-11)
  const isExcludedFromShield = 
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/api/v1/internal-sync' || // honeypot itself
    pathname === '/api/security/challenge';

  if (!isExcludedFromShield && process.env.DDOS_SHIELD_ENABLED !== 'false') {
    const hasSession = Boolean(readSessionTokenFromCookies(request.cookies));

    // Authorized users with valid session bypass DDoS challenge
    if (!hasSession) {
      const { computeHeaderFingerprint, checkClientHintsAnomaly, isWhitelistedGoodBot } = await import('@/lib/security/ddos-shield/fingerprint');
      const isBotWhitelisted = isWhitelistedGoodBot(request.headers);

      if (!isBotWhitelisted) {
        const fingerprint = computeHeaderFingerprint(request.headers);
        const { isBlacklistedDdosTarget } = await import('@/lib/security/ddos-shield/honeypot-service');
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

        // 1. Blacklist check (Honeypot trap hit)
        const isBlocked = await isBlacklistedDdosTarget(clientIp, fingerprint);
        if (isBlocked) {
          return new NextResponse('Access Blocked by Anti-DDoS Perimeter', { status: 403, headers: { 'Retry-After': '86400' } });
        }

        // 2. Gatekeeper token check
        const gatekeeperCookie = request.cookies.get('__Host-gatekeeper')?.value || request.cookies.get('gatekeeper')?.value;
        let hasValidGatekeeper = false;
        if (gatekeeperCookie) {
          const { verifyGatekeeperToken } = await import('@/lib/security/ddos-shield/pow-engine');
          const shieldSecret = process.env.JWT_SIGNING_KEY || process.env.JWT_SECRET || 'omnismm-ddos-shield-fallback-secret-2026';
          const payload = verifyGatekeeperToken(gatekeeperCookie, shieldSecret);
          if (payload) {
            hasValidGatekeeper = true;
          }
        }

        if (!hasValidGatekeeper) {
          const anomaly = checkClientHintsAnomaly(request.headers);
          const { checkFingerprintPoolLimit } = await import('@/lib/security/ddos-shield/token-bucket-pool');
          const poolStatus = await checkFingerprintPoolLimit(fingerprint, 'smmplan', 120, 60);

          if (anomaly.isAnomalous || !poolStatus.isAllowed) {
            const acceptHeader = request.headers.get('accept') || '';
            const isHtmlRequest = acceptHeader.includes('text/html') && request.method === 'GET';

            if (isHtmlRequest) {
              const { renderPowChallengeHtml } = await import('@/lib/security/ddos-shield/challenge-page');
              return new NextResponse(renderPowChallengeHtml(), {
                status: 429,
                headers: {
                  'Content-Type': 'text/html; charset=utf-8',
                  'Retry-After': '5',
                },
              });
            }

            return NextResponse.json(
              { error: 'Too Many Requests - Security verification required' },
              { status: 429, headers: { 'Retry-After': '60' } }
            );
          }
        }
      }
    }
  }

  const initialIncomingHost = (hostHeader?.split(',')[0]?.trim() || fwdHost || '');
  const isLocalhost = isInternalHost(initialIncomingHost) || initialIncomingHost.includes('localhost') || initialIncomingHost.includes('127.0.0.1') || initialIncomingHost.includes('0.0.0.0');

  let host = (fwdHost && !isInternalHost(fwdHost))
    ? fwdHost
    : (hostHeader?.split(',')[0]?.trim() || '');

  if (isInternalHost(host) || !host) {
    host = process.env.APP_URL ? new URL(process.env.APP_URL).host : 'test.smmplan.pro';
  }
  if (host.includes('0.0.0.0')) {
    host = host.replace('0.0.0.0', 'localhost');
  }

  const proto = fwdProto || (process.env.NODE_ENV === 'production' && !isInternalHost(host) ? 'https' : 'http');
  const originBase = `${proto}://${host}`;

  const resolveRedirectUrl = (target: string | URL): URL => {
    if (target instanceof URL) {
      if (isInternalHost(target.hostname)) {
        return new URL(`${target.pathname}${target.search}${target.hash}`, originBase);
      }
      return target;
    }
    return new URL(target, originBase);
  };

  const LOVABLE_HOSTS = new Set(['lovable.pro', 'www.lovable.pro', 'flux.lovable.pro']);
  const cleanHost = host.split(':')[0].toLowerCase();
  if (LOVABLE_HOSTS.has(cleanHost)) {
    const targetUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, 'https://smmflux.ru');
    return NextResponse.redirect(targetUrl, 302);
  }

  const fromQuery = normalizeTenantId(request.nextUrl.searchParams.get('tenant'));
  const fromCookie = normalizeTenantId(request.cookies.get('x_tenant')?.value);
  const fromAdminCookie = normalizeTenantId(request.cookies.get('x_admin_tenant')?.value);
  const fromHost = normalizeTenantId(resolveTenantFromHostEdge(host));

  let finalTenantId = 'smmplan';
  let isExplicitTenant = false;

  const activeContour = getActiveServerContour();

  const isTailscaleHost = cleanHost.endsWith('.ts.net') || cleanHost.includes('tailscale');
  let isAllowedQueryTenant = true;
  if (fromQuery && activeContour !== 'test' && process.env.NODE_ENV === 'production' && !isLocalhost && !isTailscaleHost) {
    const sessionToken = readSessionTokenFromCookies(request.cookies);
    if (!sessionToken) {
      isAllowedQueryTenant = false;
    } else {
      const payload = await decryptSessionToken(sessionToken);
      if (!payload || payload.role === 'USER') {
        isAllowedQueryTenant = false;
      }
    }
  }

  // 1. Explicit query parameter override (permitted for staff on prod, or unrestricted on test/localhost)
  if (fromQuery && isAllowedQueryTenant) {
    finalTenantId = fromQuery;
    isExplicitTenant = true;
  }
  // 2. Global Site Switcher for Admin/Operator panels
  else if (fromAdminCookie && (pathname.startsWith('/admin') || pathname.startsWith('/operator')) && Boolean(readSessionTokenFromCookies(request.cookies))) {
    finalTenantId = fromAdminCookie;
  }
  // 3. Dedicated Domain Resolution (test.smmplan.pro -> smmplan, flux.smmplan.pro -> flux) - ABSOLUTE PRIORITY OVER STALE COOKIES
  else if (fromHost && !isLocalhost) {
    finalTenantId = fromHost;
  }
  // 4. Local Development Cookie Fallback (only on localhost:3000 / 127.0.0.1)
  else if (isLocalhost && fromCookie) {
    finalTenantId = fromCookie;
    isExplicitTenant = true;
  }
  // 5. Default Fallback
  else {
    finalTenantId = fromHost || 'smmplan';
  }

  requestHeaders.set('x-tenant-id', finalTenantId);

  // SEC: Authoritative site-mode signal based on proven-valid incoming host
  const originalIncomingHost = host.split(':')[0].toLowerCase();
  const isHoldingDomain = originalIncomingHost === 'smmplan.pro' || originalIncomingHost === 'www.smmplan.pro';
  requestHeaders.set('x-site-mode', isHoldingDomain ? 'holding' : 'live');

  const applyStickyCookie = (res: NextResponse) => {
    res.headers.set('x-tenant-id', finalTenantId);
    if (isExplicitTenant) {
      res.cookies.set('x_tenant', finalTenantId, {
        path: '/',
        httpOnly: false, // Allow client-side QA Dock to switch brands
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }
    return res;
  };

  // Strict validation against current active server contour (TRUSTED_CONTOUR_MAP)
  const allowedForContour = TRUSTED_CONTOUR_MAP[activeContour];
  const effectiveHost = (rawFwdClean && !isInternalHost(rawFwdClean)) ? rawFwdClean : rawHostClean;

  if (effectiveHost && allowedForContour && !isInternalHost(effectiveHost) && !allowedForContour.has(effectiveHost) && !isSecurityTxt) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Forbidden: Host not permitted for active server contour' },
        { status: 403 }
      );
    }
  }

  // 1. Instant UI Logout Interception (/logout or /api/auth/logout)
  if (pathname === '/logout' || pathname === '/api/auth/logout') {
    const isApi = pathname.startsWith('/api/');
    const isFetch = request.headers.get('sec-fetch-mode') === 'cors' || 
                    request.headers.get('accept')?.includes('application/json') ||
                    request.headers.get('content-type')?.includes('application/json') ||
                    request.method === 'POST';

    if (!isApi || !isFetch) {
      const res = NextResponse.redirect(resolveRedirectUrl(ROUTES.AUTH.LOGIN), 307);
      res.cookies.set('explicit_logout', 'true', {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 5, // 5 minutes
      });
      clearSessionCookiesOnResponse(res);
      return applyStickyCookie(res);
    }
  }

  // 1.5 Production Maintenance Gate
  // Activated strictly only if MAINTENANCE_MODE is explicitly set to 'true' in env
  const isMaintenanceActive = process.env.MAINTENANCE_MODE === 'true';

  if (isMaintenanceActive) {
    const isAllowedMaintenancePath = 
      pathname === '/' ||
      pathname === '/prelaunch' ||
      pathname === '/robots.txt' ||
      pathname === '/sitemap.xml' ||
      pathname === '/security.txt' ||
      pathname.startsWith('/.well-known/') ||
      pathname === '/api/health' ||
      pathname === '/api/maintenance-status' ||
      pathname === '/api/prelaunch/subscribe' ||
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/images/') ||
      pathname === '/favicon.ico';

    if (!isAllowedMaintenancePath) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Service Unavailable - Platform under maintenance' },
          { status: 503, headers: { 'Retry-After': '3600' } }
        );
      }
      return applyStickyCookie(NextResponse.redirect(resolveRedirectUrl('/')));
    }
  }

  // 2. Check legacy redirects
  const newPath = legacyRedirects[pathname];
  if (newPath) {
    const redirectUrl = resolveRedirectUrl(newPath);
    if (newPath.includes('#')) {
      const [pathPart, hashPart] = newPath.split('#');
      redirectUrl.pathname = pathPart;
      redirectUrl.hash = hashPart;
    }
    return NextResponse.redirect(redirectUrl, 301); // 301 Permanent Redirect
  }

  // 4. Auth Route Protection & N-10.5 Strict Redirection
  const protectedPaths = ['/admin', '/dashboard', '/operator'];
  if (protectedPaths.some(p => pathname.startsWith(p))) {
    const sessionToken = readSessionTokenFromCookies(request.cookies);
    const isRSC = request.headers.has('rsc') || request.headers.has('next-action');
    if (!sessionToken) {
      if (isRSC) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const res = NextResponse.redirect(resolveRedirectUrl(ROUTES.AUTH.LOGIN), 307);
      clearSessionCookiesOnResponse(res);
      return applyStickyCookie(res);
    }

    const payload = await decryptSessionToken(sessionToken);
    const isCustomer = payload?.role === 'USER';
    const isStaffRole = !isCustomer && Boolean(payload?.userId);
    const isAdminPath = pathname.startsWith('/admin');
    const isOperatorPath = pathname.startsWith('/operator');

    // Enforce tenant isolation for regular users (Staff roles have global multi-tenant access)
    const isTenantMismatch = isCustomer && !isStaffRole && !isAdminPath && !isOperatorPath && (!payload || normalizeTenantId(payload.tenantId) !== finalTenantId);

    // Enforce contour matching in JWT (tokens issued in test contour cannot be used in prod contour)
    const currentContour = resolveContourFromHost(host);
    const tokenContour = (payload?.contour as ContourId) || (normalizeTenantId(payload?.tenantId) === 'flux' ? 'flux' : 'test');
    const isContourMismatch = !isLocalhost && tokenContour !== currentContour && (tokenContour === 'prod' || currentContour === 'prod' || tokenContour === 'flux' || currentContour === 'flux');

    if (!payload || isTenantMismatch || isContourMismatch) {
      if (isRSC) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const response = NextResponse.redirect(resolveRedirectUrl(ROUTES.AUTH.LOGIN), 307);
      clearSessionCookiesOnResponse(response);
      return applyStickyCookie(response);
    }

    // Role verification for /admin and /operator:
    // Fast-reject explicit customers at edge; staff (role: undefined per P2-10) passes to Server Component for DB-backed RBAC
    if (isAdminPath) {
      if (isCustomer) {
        if (isRSC) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return applyStickyCookie(NextResponse.redirect(resolveRedirectUrl(ROUTES.DASHBOARD.HOME), 307));
      }
    }

    if (isOperatorPath) {
      if (isCustomer) {
        if (isRSC) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return applyStickyCookie(NextResponse.redirect(resolveRedirectUrl(ROUTES.DASHBOARD.HOME), 307));
      }
    }
  }

  // Set headers for layout detection and tenant isolation
  const rawIncomingHost = fwdHost || hostHeader || cleanHost;
  requestHeaders.set('x-pathname', pathname);
  requestHeaders.set('x-host', rawIncomingHost);
  requestHeaders.set('x-forwarded-host', rawIncomingHost);

  // Generate cryptographic Nonce for strict-dynamic CSP (V-05)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  requestHeaders.set('x-nonce', nonce);

  // Content Security Policy (PCI DSS 4.0 / OWASP ASVS 4.0.3)
  const scriptSrcDirective = `'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://yookassa.ru https://auth.robokassa.ru`;
  const styleSrcDirective = `'self' 'unsafe-inline' https://fonts.googleapis.com`;

  const incomingProto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol || '';
  const isHttps = incomingProto.includes('https');
  const isDirectIpOrLocal = /^(localhost|127\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|26\.\d+\.\d+\.\d+|0\.0\.0\.0)(:\d+)?$/i.test(rawIncomingHost);
  const shouldUpgradeInsecure = isHttps && !isDirectIpOrLocal;

  const cspHeader = `
    default-src 'self';
    script-src ${scriptSrcDirective};
    style-src ${styleSrcDirective};
    img-src 'self' blob: data: https:;
    font-src 'self' data: https://fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self' https://yookassa.ru https://auth.robokassa.ru;
    frame-ancestors 'self';
    frame-src 'self' https://challenges.cloudflare.com https://yookassa.ru https://auth.robokassa.ru https://pay.crypt.bot;
    connect-src 'self' https://challenges.cloudflare.com https://yookassa.ru https://auth.robokassa.ru https://api.cryptobot.org https://api.telegram.org https://pay.crypt.bot;
    report-uri /api/telemetry/csp-report;
    ${shouldUpgradeInsecure ? 'upgrade-insecure-requests;' : ''}
  `.replace(/\s{2,}/g, ' ').trim();

  requestHeaders.set('Content-Security-Policy', cspHeader);

  // Handle ref cookie if present in URL query
  const ref = request.nextUrl.searchParams.get('ref');
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Inject CORS headers for API routes when requested with an allowed origin
  if (pathname.startsWith('/api') && isAllowedOrigin && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id, idempotency-key');
  }

  response.headers.set('x-tenant-id', finalTenantId);
  response.headers.set('x-nonce', nonce);
  response.headers.set('Content-Security-Policy', cspHeader);
  if (shouldUpgradeInsecure) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  // Inject X-Robots-Tag for sensitive routes to prevent indexing
  if (['/admin', '/dashboard', '/operator', '/api'].some(p => pathname.startsWith(p))) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  if (ref) {
    response.cookies.set('ref', ref, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  return applyStickyCookie(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
