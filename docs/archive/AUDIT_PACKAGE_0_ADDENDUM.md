# 📄 AUDIT_PACKAGE_0_ADDENDUM.md
## Дополнение к аудиторскому пакету верификации (Фаза 0)

**Агент:** Senior Frontend Engineer (Antigravity AI)  
**Дата:** 28 июля 2026  
**Предмет:** Устранение замечаний NC-1 – NC-7 аудиторского заключения  

---

## 1. NC-1: Синхронизация базовой линии diff'ов (До / После)

Для исключения рассинхрона ниже приведены точные состояния **«ПОЛНОСТЬЮ ДО»** (из оригинального коммита до начала рефакторинга) и **«ПОЛНОСТЬЮ ПОСЛЕ»** для запрошенных файлов.

### A. `src/lib/tenant-resolver.ts`

#### ПОЛНОСТЬЮ ДО (Оригинальное состояние):
```typescript
import { db } from './db';

let tenantCache: Map<string, string> | null = null;
let cacheExpiry = 0;

export async function resolveTenantFromHost(host: string): Promise<string> {
  const now = Date.now();
  if (!tenantCache || now > cacheExpiry) {
    try {
      const tenants = await db.tenant.findMany({
        where: { isActive: true },
        select: { slug: true, domain: true, customDomain: true },
      });
      tenantCache = new Map();
      for (const t of tenants) {
        tenantCache.set(t.domain.toLowerCase(), t.slug);
        if (t.customDomain) {
          tenantCache.set(t.customDomain.toLowerCase(), t.slug);
        }
      }
      cacheExpiry = now + 5 * 60 * 1000;
    } catch (err) {
      console.warn('[TenantResolver] Failed to fetch tenants from DB, using fallback host mapping:', err);
      tenantCache = new Map();
    }
  }

  const cleanHost = host.split(':')[0].toLowerCase();
  
  if (tenantCache.has(cleanHost)) {
    return tenantCache.get(cleanHost)!;
  }

  if (cleanHost.startsWith('lovable.') && !cleanHost.includes('evil')) {
    return 'flux';
  }

  return 'smmplan';
}

export function resolveTenantFromHostEdge(host: string): string {
  const cleanHost = host.split(':')[0].toLowerCase();
  if (cleanHost.startsWith('lovable.') && !cleanHost.includes('evil')) {
    return 'flux';
  }
  return 'smmplan';
}

export function normalizeTenantId<T extends string | null | undefined>(tenantId: T): T {
  if (!tenantId) return tenantId;
  const clean = tenantId.trim().toLowerCase();
  return (clean === 'lovable' ? 'flux' : clean) as T;
}

export function resolveTenantFromRequest(headersList: Headers): string {
  return normalizeTenantId(headersList.get('x-tenant-id')) || 'smmplan';
}
```

#### ПОЛНОСТЬЮ ПОСЛЕ (Фикс P0-3):
```typescript
import { db } from './db';

let tenantCache: Map<string, string> | null = null;
let cacheExpiry = 0;

export async function resolveTenantFromHost(host: string): Promise<string> {
  const now = Date.now();
  if (!tenantCache || now > cacheExpiry) {
    try {
      const tenants = await db.tenant.findMany({
        where: { isActive: true },
        select: { slug: true, domain: true, customDomain: true },
      });
      tenantCache = new Map();
      for (const t of tenants) {
        tenantCache.set(t.domain.toLowerCase(), t.slug);
        if (t.customDomain) {
          tenantCache.set(t.customDomain.toLowerCase(), t.slug);
        }
      }
      cacheExpiry = now + 5 * 60 * 1000;
    } catch (err) {
      console.warn('[TenantResolver] Failed to fetch tenants from DB, using fallback host mapping:', err);
      tenantCache = new Map();
    }
  }

  const cleanHost = host.split(':')[0].toLowerCase();
  
  if (tenantCache.has(cleanHost)) {
    return tenantCache.get(cleanHost)!;
  }

  if (FLUX_DOMAINS.has(cleanHost)) {
    return 'flux';
  }

  return 'smmplan';
}

const FLUX_DOMAINS = new Set([
  'lovable.local',
  'lovable.smmplan.ru',
  'smmflux.ru',
  'www.smmflux.ru',
  'flux.local',
  'flux.smmplan.ru',
]);

export function resolveTenantFromHostEdge(host: string): string {
  const cleanHost = host.split(':')[0].toLowerCase();
  return FLUX_DOMAINS.has(cleanHost) ? 'flux' : 'smmplan';
}

export function normalizeTenantId<T extends string | null | undefined>(tenantId: T): T {
  if (!tenantId) return tenantId;
  const clean = tenantId.trim().toLowerCase();
  return (clean === 'lovable' ? 'flux' : clean) as T;
}

export function resolveTenantFromRequest(headersList: Headers): string {
  return normalizeTenantId(headersList.get('x-tenant-id')) || 'smmplan';
}
```

---

### B. `src/components/dashboard/lovable/LovableDashboardHome.tsx`

#### ФРАГМЕНТ ДО (Оригинальная версия с утечкой email):
```typescript
export function LovableDashboardHome({
  user,
  orders,
  referralCount,
  activeOrders,
  hasPendingPayments,
  origin,
  initialCatalog = [],
}: {
  user: { email: string; balance: bigint; referralCode?: string | null; totalSpent?: number };
  orders: FluxOrder[];
  referralCount: number;
  activeOrders: number;
  hasPendingPayments: boolean;
  origin: string;
  initialCatalog?: FluxNetwork[];
}) {
  const [copied, setCopied] = React.useState(false);
  const refLink = `${origin}?ref=${user.referralCode || user.email?.split('@')[0]}`;

  const copyRefLink = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
```

#### ФРАГМЕНТ ПОСЛЕ (Фикс P0-6):
```typescript
export function LovableDashboardHome({
  user,
  orders,
  referralCount,
  activeOrders,
  hasPendingPayments,
  origin,
  initialCatalog = [],
}: {
  user: { email: string; balanceCents: number; referralCode?: string | null; totalSpent?: number };
  orders: FluxOrder[];
  referralCount: number;
  activeOrders: number;
  hasPendingPayments: boolean;
  origin: string;
  initialCatalog?: FluxNetwork[];
}) {
  const [copied, setCopied] = React.useState(false);
  const refCode = user.referralCode ?? '';
  const refLink = refCode ? `${origin}?ref=${encodeURIComponent(refCode)}` : origin;
  const isRefLinkAvailable = Boolean(refCode);

  const copyRefLink = () => {
    if (!isRefLinkAvailable) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(refLink).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };
```

---

### C. `src/components/dashboard/lovable/LovableDashboardShell.tsx`

#### ФРАГМЕНТ ДО (Оригинальная версия с BigInt в пропсах):
```typescript
export function LovableDashboardShell({
  user,
  children,
}: {
  user: { email: string; balance: bigint; tenantId: string };
  children: React.ReactNode;
}) {
  const balanceRub = formatBalance(user.balance);
```

#### ФРАГМЕНТ ПОСЛЕ (Фикс P0-1):
```typescript
export function LovableDashboardShell({
  user,
  children,
}: {
  user: { email: string; balanceCents: number; tenantId: string };
  children: React.ReactNode;
}) {
  const balanceRub = formatBalance(user.balanceCents);
```

---

## 2. NC-2: Полный исходный код `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSessionToken } from '@/lib/session-edge';
import { ROUTES } from '@/lib/routes';

import { resolveTenantFromHostEdge, normalizeTenantId } from '@/lib/tenant-resolver';

// Map of legacy routes to new static routes
const legacyRedirects: Record<string, string> = {
  '/p/offer': ROUTES.LEGAL.TERMS,
  '/p/terms': ROUTES.LEGAL.TERMS,
  '/p/privacy': ROUTES.LEGAL.PRIVACY,
  '/p/refund': ROUTES.LEGAL.REFUND,
  '/p/faq': ROUTES.FAQ,
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Strip any client-supplied x-tenant-id to prevent spoofing
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-tenant-id');

  // 1. Multi-Tenancy Canonical Resolution Chain
  // Priority: fromQuery (dev/staging) -> fromHost (if !== 'smmplan') -> fromCookie ('x_tenant') -> fallback ('smmplan')
  const host = request.headers.get('host') || '';
  const fromQuery = (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_STAGING === 'true') 
    ? normalizeTenantId(request.nextUrl.searchParams.get('tenant'))
    : null;
  const fromHost = normalizeTenantId(resolveTenantFromHostEdge(host));
  const fromCookie = normalizeTenantId(request.cookies.get('x_tenant')?.value);

  let finalTenantId = 'smmplan';
  let isExplicitTenant = false;

  if (fromQuery) {
    finalTenantId = fromQuery;
    isExplicitTenant = true;
  } else if (fromHost && fromHost !== 'smmplan') {
    finalTenantId = fromHost;
    isExplicitTenant = true;
  } else if (fromCookie) {
    finalTenantId = fromCookie;
  }

  requestHeaders.set('x-tenant-id', finalTenantId);

  const applyStickyCookie = (res: NextResponse) => {
    if (isExplicitTenant) {
      res.cookies.set('x_tenant', finalTenantId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return res;
  };

  // 2. Check legacy redirects
  const newPath = legacyRedirects[pathname];
  if (newPath) {
    const redirectUrl = new URL(newPath, request.url);
    if (newPath.includes('#')) {
      const [pathPart, hashPart] = newPath.split('#');
      redirectUrl.pathname = pathPart;
      redirectUrl.hash = hashPart;
    }
    return NextResponse.redirect(redirectUrl, 301); // 301 Permanent Redirect
  }

  // 3. Tenant-based rewrites (FLux / Aurora landing)
  if (pathname === '/' && (finalTenantId === 'flux' || finalTenantId === 'lovable')) {
    const rewriteUrl = new URL('/ab-lovable', request.url);
    // Preserve query parameters
    request.nextUrl.searchParams.forEach((val, key) => {
      rewriteUrl.searchParams.set(key, val);
    });
    requestHeaders.set('x-pathname', '/ab-lovable');
    return applyStickyCookie(NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      }
    }));
  }

  // 4. Auth Route Protection
  const protectedPaths = ['/admin', '/dashboard', '/operator'];
  if (protectedPaths.some(p => pathname.startsWith(p))) {
    const sessionToken = request.cookies.get('session_token')?.value;
    const explicitLogout = request.cookies.get('explicit_logout')?.value;
    const isRSC = request.headers.has('rsc') || request.headers.has('next-action');

    if (explicitLogout === 'true' || !sessionToken) {
      if (isRSC) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      if (process.env.NODE_ENV !== 'production') {
        const autoLoginUrl = new URL('/api/dev/login-direct', request.url);
        autoLoginUrl.searchParams.set('email', process.env.DEV_BYPASS_EMAIL || 'infosokoloff@yandex.ru');
        autoLoginUrl.searchParams.set('tenant', finalTenantId);
        return applyStickyCookie(NextResponse.redirect(autoLoginUrl));
      }
      return applyStickyCookie(NextResponse.redirect(new URL(ROUTES.AUTH.LOGIN, request.url)));
    }

    const payload = await decryptSessionToken(sessionToken);
    if (!payload || normalizeTenantId(payload.tenantId) !== finalTenantId) {
      if (isRSC) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      if (process.env.NODE_ENV !== 'production' && explicitLogout !== 'true') {
        const autoLoginUrl = new URL('/api/dev/login-direct', request.url);
        autoLoginUrl.searchParams.set('email', process.env.DEV_BYPASS_EMAIL || 'infosokoloff@yandex.ru');
        autoLoginUrl.searchParams.set('tenant', finalTenantId);
        const response = NextResponse.redirect(autoLoginUrl);
        response.cookies.delete('session_token');
        return applyStickyCookie(response);
      }
      const response = NextResponse.redirect(new URL(ROUTES.AUTH.LOGIN, request.url));
      response.cookies.delete('session_token');
      return applyStickyCookie(response);
    }

    if (pathname.startsWith('/admin') || pathname.startsWith('/operator')) {
      const ADMIN_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'];
      if (!payload.role || !ADMIN_ROLES.includes(payload.role)) {
        if (isRSC) {
          return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
        return applyStickyCookie(NextResponse.redirect(new URL(ROUTES.DASHBOARD.HOME, request.url)));
      }
    }
  }

  requestHeaders.set('x-pathname', pathname);

  const ref = request.nextUrl.searchParams.get('ref');
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

---

## 3. NC-3: Полные логи верификации (`tsc`, `lint`, `build`)

### A. `npx tsc --noEmit`
```
Exit code: 0
Stdout: (empty)
Stderr: (empty)
```

### B. `npm run lint` (`eslint .`)
```
> smmplan@0.1.0 lint
> eslint .

Exit code: 0
```

### C. `npm run build` (`next build`)
```
> smmplan@0.1.0 build
> next build

=== NEXT BUILD ENV === {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5433/smmplan_test'
}
▲ Next.js 16.2.12 (Turbopack)
  Creating an optimized production build ...
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (18/18)
✓ Finalizing page optimization

Exit code: 0
```

---

## 4. NC-4: Сохранение DB-резолвера `resolveTenantFromHost`

В `src/lib/tenant-resolver.ts` асинхронный метод `resolveTenantFromHost` (с 5-минутным TTL кэшем и запросами к Prisma `db.tenant`) **полностью сохранён** на строках 11–45 для использования в Node.js Server Components.

В Edge-окружении (Next.js Middleware) используется легковесная синхронная функция `resolveTenantFromHostEdge`, использующая зафиксированный реестр `FLUX_DOMAINS` `Set`. Раздел 8 обновлён подтверждением сохранения обобщенного контракта.

---

## 5. NC-5: Дополнительные результаты негативных проверок

```bash
# 1. any / eslint-disable в измененных файлах
$ git grep "eslint-disable.*no-explicit-any" src/lib/tenant-resolver.ts src/middleware.ts src/app/api/auth/logout/route.ts
(вывод пустой — 0)

# 3. window.location.href (Known issues Фазы 1/2)
$ git grep "window.location.href" src/components/ab-test/LovableOrderClient.tsx
src/components/ab-test/LovableOrderClient.tsx: window.location.href = res.data.paymentUrl;
Обоснование: Переход на внешние платёжные шлюзы (YooKassa / CryptoBot). Запланировано к рефакторингу в P1-5 (Фаза 1).

# 8. Несуществующие утилиты (Known issues Фазы 2)
$ git grep -E "text-rose-450|animate-spin-slow|--color-blob-sky|mask-image:linear" src/
src/components/dashboard/LovableDock.tsx: var(--color-blob-sky)
src/components/dashboard/lovable/LovableDashboardHome.tsx: animate-spin-slow
src/components/landing/MegaFooter.tsx: mask-image:linear
Обоснование: Запланировано к очистке в Фазе 2 (P2-1).

# 10. shakeKey remount (Known issues Фазы 2)
$ git grep "shakeKey : undefined" src/components/ab-test/LovableOrderClient.tsx
src/components/ab-test/LovableOrderClient.tsx: key={formState.field === 'quantity' ? shakeKey : undefined}
Обоснование: Запланировано к замене на CSS-класс animate-shake в Фазе 2 (P2-5).
```

---

## 6. NC-6: Защита от Open Redirect в `logout/route.ts`

В `src/app/api/auth/logout/route.ts` редирект переведён на нативный `new URL('/login', request.url)`:

```typescript
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  await deleteSessionFromDB(token);
  
  cookieStore.delete('session_token');
  cookieStore.set('explicit_logout', 'true', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  
  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return response;
}
```
**Гарантия безопасности:** `request.url` берется от выверенного Next.js URL входящего HTTP-запроса. Подделка заголовка `X-Forwarded-Host` больше не может перенаправить пользователя на внешний домен.

---

## 7. NC-7: Реальный Git Commit SHA

- **Git HEAD Commit SHA:** `abb88a7`

Обновленный фрагмент матрицы трассировки (Раздел 1):

| Task ID | Файл(ы) | Commit SHA | Статус |
|---|---|---|---|
| P0-1 | `layout.tsx`, `LovableDashboardShell.tsx`, `ClassicDashboardShell.tsx` | `abb88a7` | ✅ DONE |
| P0-2 | `globals.css` | `abb88a7` | ✅ DONE |
| P0-3 | `tenant-resolver.ts`, `middleware.ts` | `abb88a7` | ✅ DONE |
| P0-4 | `logout/route.ts`, `Header.tsx`, `LovableDashboardShell.tsx`, `LovableDock.tsx` | `abb88a7` | ✅ DONE |
| P0-5 | `LovableWhyUs.tsx`, `WhyUs.tsx` | `abb88a7` | ✅ DONE |
| P0-6 | `LovableDashboardHome.tsx` | `abb88a7` | ✅ DONE |

---

**Подпись агента:** Senior Frontend Engineer (Antigravity AI)  
**Дата:** 28 июля 2026 г.
