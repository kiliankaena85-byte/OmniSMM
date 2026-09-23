# 📋 Чек-лист и последовательность проведения аудита для внешнего ИИ (GLM-5.2 / Claude)
# Домен: Auth & RBAC (Часть 1 из 1)

Вы выступаете в роли ведущего эксперта по безопасности (DevSecOps) и архитектора ПО.
Вам передан исходный код веб-приложения SMM-панели (Next.js 16, React 19, Prisma, PostgreSQL).
Ваша задача — провести глубокий внешний аудит предоставленного кода.

Критерии анализа:
1. Безопасность и уязвимости (OWASP Top 10, утечки секретов, права доступа в Server Actions, защита от IDOR).
2. Логическая целостность (целостность транзакций Prisma, защита баланса пользователей, гонки данных / Race Conditions при изменении баланса).
3. Структурная архитектура (соответствие конвенциям Server Component, Next.js 16).
4. Ошибки обработки исключений (пустые блоки catch, отсутствие логирования).
5. Соблюдение правил ценообразования (маржа, маркап, расчеты в центах) и обработки линков (targetType).

---

## 🏗️ Схема базы данных (Релевантные Prisma модели):
```prisma
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String?
  role              String    @default("USER") // USER, SUPPORT, MANAGER, OWNER
  balance           BigInt    @default(0)
  quarantineBalance BigInt    @default(0) // Funds pending Owner approval (Escrow)
  totalSpent        BigInt    @default(0) // Lifetime value in Cents
  personalDiscount  Float     @default(0.0) // Manual discount override in %, max 100
  discountEndsAt    DateTime? // If set — discount expires at this datetime

  // Trust budget (for compensation/refunds by support)
  supportLimitCents      Int      @default(50000) // 500 RUB default trust budget
  supportSpentTodayCents Int      @default(0) // Track daily spending
  supportLastResetAt     DateTime @default(now()) // For auto-reset logic

  apiKeyHash      String? @unique
  referralCode    String? @unique
  referredById    String?
  referralBalance Int     @default(0)
  telegramId      String? // Telegram user ID for omnichannel support routing
  phoneHash       String? @unique // SHA-256 hash of verified Telegram contact
  isKycVerified   Boolean @default(false)
  isEmailVerified Boolean @default(true)
  isActive        Boolean @default(true)
  isDeleted       Boolean @default(false)

  // Operator notes (internal, never visible to client)
  adminNote          String? // Free-form operator note
  adminNoteUpdatedAt DateTime? // When the note was last updated
  adminNoteUpdatedBy String? // Email of operator who wrote the note

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  authTokens      AuthToken[]
  sessions        Session[]
  orders          Order[]
  payments        Payment[]
  tickets         Ticket[]
  auditLogs       AuditLog[]
  ledgerLogs      LedgerEntry[]    @relation("UserLedger")
  invoices        Invoice[]
  smartCampaigns  SmartCampaign[]
  promoCodeUsages PromoCodeUsage[]

  // B2B & Accounting Fields
  companyName  String?
  inn          String?
  kpp          String?
  legalAddress String?

  // Referrals
  referredBy  User?        @relation("ReferralTree", fields: [referredById], references: [id], onDelete: SetNull)
  referrals   User[]       @relation("ReferralTree")
  commissions Commission[] @relation("ReferredCommissions")

  // RBAC
  staffRoleId String?
  staffRole   StaffRole? @relation(fields: [staffRoleId], references: [id], onDelete: SetNull)

  b2bConfig B2bConfig?
  userNotes     UserNote[] @relation("UserNotes")
  authoredNotes UserNote[] @relation("AuthorNotes")
}

model AuthToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  used      Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Session {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt      DateTime
  userAgent      String?
  ipAddress      String?
  impersonatedBy String? // SD-07: Admin ID who initiated Login-As (null = real session)
  createdAt      DateTime @default(now())

  @@index([userId])
}

model StaffRole {
  id          String            @id @default(cuid())
  name        String            @unique // "Senior Support"
  description String            @default("")
  isSystem    Boolean           @default(false) // true = cannot delete (Owner, Admin)
  permissions StaffPermission[]
  users       User[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
}
```

---

## 📜 Правила и контракты проекта (AGENTS.md):
```markdown
### Zero-Defect Execution Protocol (TRIPLE-AGENT STRATEGY)
**🔴 ОБЯЗАТЕЛЬНО для всех AI-агентов при обработке любого запроса:**

1. **Phase 1: Analyst (`gsd-prompt-engineer`) & Double-Pass Planner**:
   - ПЕРЕД любой работой задай уточняющие вопросы (3-5 шт).
   - **🔴 ВЕКТОРНЫЙ ПОИСК ПАМЯТИ (GraphRAG):** Прежде чем слепо искать по файлам, всегда обращайся к векторной базе знаний для получения архитектурного контекста. Выполни в терминале: `npx tsx scripts/query-rag.ts "<твой вопрос по архитектуре или логике>"`.
   - Сформируй четкое ТЗ (UI-SPEC/API-SPEC).
   - Не начинай кодить, пока не будет "High-Definition" понимания задачи.
   - **🔴 Двухпроходное планирование (Double-Pass Planning)**: сразу после составления первого черновика плана (`implementation_plan.md`) принудительно перечитай его и переоцени с точки зрения 5 векторов надежности.

2. **Phase 2: Researcher (`gsd-research-autopsy`) & Pre-Mortem Auditor**:
   - Проведи глубокий поиск (EN/RU).
   - Найди 3 подтверждения для каждой гипотезы.
   - **🔴 5 Векторов Надежности**: проанализируй и оцени план по 5 векторам:
     - *Архитектурный стык* (Server/Client границы, hooks, реактивные зависимости, ререндеринг).
     - *Хаос и пустота* (Синдром пустой БД/Cold Start, сбой транзакционности в Prisma, битые входные данные).
     - *Visual & UX Density* (адаптивность от 320px до 4K, отсутствие интерфейсного гигантизма, семантика Tailwind 4).
     - *Доступность WCAG 2.2 AA* (мишени touch targets >= 44px, цветовой контраст >= 4.5:1).
     - *Security & Trust* (Trust Boundary / серверная проверка цен, наличие безопасных платежных логотипов МИР/СБП).
   - **🔴 Премортем-анализ (Failure Simulation)**: заполни в `implementation_plan.md` обязательную таблицу рисков — минимум 3 сценария гипотетического отказа системы в продакшене с конкретными программными механизмами защиты. План без заполненного премортема невалиден!
   - Сформируй Risk Matrix (P×I) и список Edge-Cases.

3. **Phase 3: Surgeon (`gsd-surgeon`)**:
   - Реализуй код строго по ТЗ и данным из исследования.
   - Соблюдай границы Server/Client и защиту от утечек данных.
   - Проверь типы (`npx tsc --noEmit`) перед сдачей.

### Server/Client Boundary
- Server Components по умолчанию. `'use client'` только при необходимости (hooks, browser APIs).
- Server Actions в `src/actions/` с обязательным `requireAdmin()` guard.
- НИКОГДА не ставить `"use server"` в Page Components — это вызывает crash.

### Design System (CRITICAL)
- **НИКОГДА** не используй inline цвета: `text-white`, `bg-black`, `text-blue-500`.
- **ВСЕГДА** используй semantic tokens из `globals.css`: `text-foreground`, `bg-background`, `bg-card`, `text-primary`, `text-muted-foreground`.
- **НИКОГДА** не добавляй `1px solid` borders между строками таблиц. Используй тональный контраст.
- Все цвета определены в `@theme` блоке `src/app/globals.css`.
- Компоненты максимум 150 строк. Декомпозируй на sub-components.
- Все интерактивные элементы: `transition-all duration-200`.

### Code Editing
- **ПРЕДПОЧИТАЙ** `search-replace` (`multi_replace_file_content`) вместо полной перезаписи файлов.
- **НИКОГДА** не переписывай файл целиком, если нужно изменить < 20 строк.
- Batch независимые операции в параллельные tool calls.

### Debugging
- **СНАЧАЛА** читай ошибки build/runtime, **ПОТОМ** правь код.
- Не гадай — проверяй логи и типы.

### Deployment Strategies (Full vs Fast-Patch)
**🔴 У нас есть 2 стандарта деплоя на сервер. Выбирай правильный в зависимости от задачи:**

**1. Full Hybrid Deploy (ПОЛНЫЙ ДЕПЛОЙ)**
- **Скрипт:** `powershell ./scripts/deploy-hybrid.ps1`
- **Когда использовать:** При изменении `schema.prisma` (требует миграций), установке новых npm-пакетов (`package.json`), изменении переменных окружения.
- **Как работает:** Локальная сборка Next.js -> локальное создание Docker-образа -> **архивация gzip (`tar -czf`) для сжатия** -> SCP отправка 70 МБ архива на сервер -> `docker load` на сервере без затрат оперативной памяти.
- **Важно:** Веб-сервер и воркеры (`npm run worker`) обязаны запускаться параллельно (см. `docker-compose.yml`). После апдейта контейнеров скрипт автоматически перезагружает конфигурацию Nginx (`nginx -s reload`).

**2. Hot-Patching (БЫСТРЫЙ ПАТЧ)**
- **Скрипт:** `npx tsx scripts/fast-patch.ts --prod`
- **Когда использовать:** При запросе "Быстрый патч", "Fast patch", "Быстрый деплой". Для быстрых визуальных правок фронтенда или бизнес-логики в `src/`, которые **НЕ** затрагивают БД или NPM.
- **Как работает:** Скрипт локально соберет `next build`, упакует `.next`, `src`, `public` в крошечный `patch.tar.gz`, отправит на сервер и распакует файлы напрямую в запущенные Docker-контейнеры через `docker cp`, после чего мягко их перезапустит (30 секунд).
- **Ограничения:** Скрипт автоматически прервётся, если были изменены критические файлы БД или NPM. В таком случае делай Full Hybrid Deploy.

### Provider Synchronization (Cherry-Pick Architecture)
**🔴 ОБЯЗАТЕЛЬНАЯ архитектура работы с провайдерами (Anti-Mass-Sync):**
1. **Shadow Catalog (Теневой буфер):** КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать сырые каталоги провайдеров (5000+ услуг) в таблицу `Service` PostgreSQL. Все `fetch` к провайдерам должны сохраняться во временный Redis-кэш (`provider:{id}:catalog`).
2. **Cherry-Pick Import:** Админ работает с витриной из Redis. В БД `Service` попадают ТОЛЬКО те услуги, которые админ выбрал вручную (с применением ИИ-маппинга категорий).
3. **Auto-Pricing Engine:** Запрещено вычислять маржу без учета кросс-курса ЦБ РФ (USD/RUB). Margin Worker должен не просто блокировать услугу при подорожании у провайдера, а **пересчитывать розничную цену** для сохранения процента маржи.
4. **Zombie Eraser:** Ночная синхронизация обязана помечать услуги как `isActive = false`, если провайдер удалил их из своего API.

### Pricing Model (CRITICAL)
**🔴 ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ по ценообразованию:**
1. **Провайдеры** хранят `rate` в **USD за 1000 штук** (индустриальный стандарт SMM-панелей).
2. **Каталог** (`src/actions/order/catalog.ts`) вычисляет два поля:
   - `pricePer1kRub` = `rate × markup × usdToRub` — **розничная цена за 1000 шт в рублях** (используется ТОЛЬКО для внутренних расчётов итоговой суммы).
   - `pricePerUnitRub` = `pricePer1kRub / 1000` — **цена за 1 штуку** (используется в UI).
3. **В UI пользователь ВСЕГДА видит цену за 1 штуку** (`pricePerUnitRub`), подпись: `₽ / шт`.
4. ❌ **ЗАПРЕЩЕНО** писать в UI `/ 1000 шт` или показывать `pricePer1kRub` напрямую пользователю.
5. ❌ **ЗАПРЕЩЕНО** вручную делить `pricePer1kRub / 1000` в компонентах — использовать `pricePerUnitRub`.

### Base UI Select (@base-ui/react) — ОБЯЗАТЕЛЬНЫЙ ПАТТЕРН
**🔴 `label` prop на `SelectItem` работает ТОЛЬКО для клавиатурного typeahead, НЕ для отображения текста в триггере.**
Для отображения человекочитаемого текста вместо raw CUID-значений используй **children-функцию** на `SelectValue`:
```tsx
<SelectValue placeholder="-- Выберите --">
  {(value: string) => {
    if (!value) return null;
    return items.find(item => item.id === value)?.name ?? value;
  }}
</SelectValue>
```
- ❌ **ЗАПРЕЩЕНО**: `<SelectValue />` (self-closing) при CUID-значениях — покажет raw ID.
- ❌ **ЗАПРЕЩЕНО**: полагаться на `label` prop для отображения в триггере.
- ✅ **ОБЯЗАТЕЛЬНО**: children-функция `{(value) => resolveLabel(value)}`.

### Link Analyzer targetType (CRITICAL)
**🔴 ОБЯЗАТЕЛЬНАЯ маппировка `targetType` для услуг:**
1. **`targetType`** определяет, какой тип ссылки ожидается от пользователя (канал, пост, профиль).
2. **Маппинг категория → targetType** (единственный источник правды — `src/utils/target-type.ts`):
   - `Подписчики / Участники / Бусты / Группы / Друзья` → `CHANNEL` (ссылка на канал/профиль)
   - `Лайки / Просмотры / Комментарии / Реакции / Репосты` → `POST` (ссылка на пост)
   - `Stories` → `STORY` (ссылка на профиль)
   - `Звёзды` → `CUSTOM`
3. ❌ **ЗАПРЕЩЕНО** писать `service.targetType || 'POST'` — это вызывает баг, при котором ссылки на каналы отклоняются для услуг Подписчиков.
4. ✅ **ОБЯЗАТЕЛЬНО** использовать `inferTargetTypeFromCategory(categoryName)` из `src/utils/target-type.ts` как fallback.
5. ❌ **ЗАПРЕЩЕНО** создавать услуги (seed, import, admin) без явного `targetType`. Prisma `@default("POST")` — аварийный дефолт, а не рабочий.

### Payment Gateways Rules (CRITICAL)
**🔴 ОБЯЗАТЕЛЬНЫЕ правила интеграции платежных шлюзов:**
1. **API запросы выполняются ВСЕГДА:** Запрещено локально имитировать/заглушать или делать моковые перенаправления на `/api/dev/mock-payment` при пополнении баланса или оплате заказов, если в панели администратора настроены любые реквизиты шлюза (даже если это тестовый магазин и тестовый ключ ЮKassa/Robokassa).
2. **Локальный мок только при пустых реквизитах:** Внутренний симулятор `/api/dev/mock-payment` используется ИСКЛЮЧИТЕЛЬНО как аварийный резерв, если ключи шлюзов отсутствуют или установлены в плейсхолдеры по умолчанию (`test_shop_id` / `test_login`).
3. **Авто-откат на тестовые ключи:** В среде разработки, если боевые ключи содержат плейсхолдеры, но настроены тестовые ключи шлюза (например, `yookassaTestShopId`), система обязана автоматически переключиться на тестовые реквизиты и выполнить реальный API запрос в платежный сервис.

#
```

---

## 💻 Исходный код для анализа (Часть 1):
### FILE: src/middleware.ts
```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSessionToken } from '@/lib/session-edge';
import { ROUTES } from '@/lib/routes';

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

  // 1. Check legacy redirects
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

  // 2. Auth Route Protection
  const protectedPaths = ['/admin', '/dashboard', '/operator'];
  if (protectedPaths.some(p => pathname.startsWith(p))) {
    const sessionToken = request.cookies.get('session_token')?.value;
    const explicitLogout = request.cookies.get('explicit_logout')?.value;
    const isRSC = request.headers.has('rsc') || request.headers.has('next-action');

    if (explicitLogout === 'true' || !sessionToken) {
      if (isRSC) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      return NextResponse.redirect(new URL(ROUTES.AUTH.LOGIN, request.url));
    }

    const payload = await decryptSessionToken(sessionToken);
    if (!payload) {
      if (isRSC) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      return NextResponse.redirect(new URL(ROUTES.AUTH.LOGIN, request.url));
    }

    // Role verification for /admin and /operator
    if (pathname.startsWith('/admin') || pathname.startsWith('/operator')) {
      const ADMIN_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'];
      if (!payload.role || !ADMIN_ROLES.includes(payload.role)) {
        if (isRSC) {
          return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
        return NextResponse.redirect(new URL(ROUTES.DASHBOARD.HOME, request.url));
      }
    }
  }

  // Set x-pathname header for layout detection
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  // Handle ref cookie if present in URL query
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

  return response;
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

```

### FILE: D:/SMM_plan_2/src/actions/auth/api-key.ts
```ts
'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import crypto from 'crypto';
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
  const hashedKey = crypto.createHash('sha256').update(newKey).digest('hex');

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

### FILE: D:/SMM_plan_2/src/actions/auth/delete-account.ts
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

### FILE: D:/SMM_plan_2/src/actions/auth/password-login.ts
```ts
'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/session';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { logger } from '@/lib/logger';

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
    const isIpAllowed = await RateLimitService.check('auth:password:ip', 20, 3600);
    if (!isIpAllowed) {
      log.warn('Password login IP rate limit exceeded', { email: cleanEmail });
      return { error: "Слишком много попыток входа с этого IP-адреса. Пожалуйста, подождите 1 час.", success: false };
    }

    // 2. Email-level Rate Limit (Max 5 attempts per 15 minutes to prevent brute-forcing)
    const isEmailAllowed = await RateLimitService.checkCustomKey(`password-attempts:${cleanEmail}`, 5, 900);
    if (!isEmailAllowed) {
      log.warn('Password login email rate limit exceeded', { email: cleanEmail });
      return { error: "Аккаунт временно заблокирован из-за большого числа неверных попыток. Попробуйте через 15 минут.", success: false };
    }

    // 3. Find User
    const user = await db.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, passwordHash: true, role: true, isActive: true, isDeleted: true, isEmailVerified: true }
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
      log.info('Password login: User has no password set', { email: cleanEmail });
      
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

### FILE: D:/SMM_plan_2/src/actions/auth/password-register.ts
```ts
'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { sendMagicLink } from '@/lib/smtp';

const log = logger.child({ component: 'PasswordRegister' });

const schema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(8, "Пароль должен быть не менее 8 символов"),
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
      // Check if user already exists
      const existingUser = await tx.user.findUnique({
        where: { email: cleanEmail },
        select: { id: true, isDeleted: true, isActive: true }
      });

      if (existingUser) {
        return { type: 'exists' as const };
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Handle referral code if present in cookies
      const cookieStore = await cookies();
      const refCode = cookieStore.get("ref")?.value;
      let referredById = null;

      if (refCode) {
        const referrer = await tx.user.findUnique({ where: { referralCode: refCode } });
        if (referrer) referredById = referrer.id;
      }

      // Auto-bootstrap: First user is OWNER
      const ownerCount = await tx.user.count({ where: { role: "OWNER" } });
      const role = ownerCount === 0 ? "OWNER" : "USER";

      const newUser = await tx.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          role,
          referredById,
          isActive: true,
          isEmailVerified: false,
        }
      });

      return { type: 'success' as const, user: newUser };
    }, { isolationLevel: 'Serializable' });

    if (result.type === 'exists') {
      return { error: "Пользователь с таким email уже зарегистрирован. Пожалуйста, войдите.", success: false };
    }

    const { user } = result;

    // 3. Generate verification token and send email
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    await db.authToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
      }
    });

    await sendMagicLink(cleanEmail, rawToken);

    log.info('Password registration verification email sent', { email: cleanEmail, userId: user.id });

    return { success: true, error: null, message: "Пожалуйста, проверьте вашу почту для подтверждения регистрации." };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Password registration action failed', { error: errorMessage, email: cleanEmail });
    return { error: "Ошибка сервера при регистрации. Попробуйте позже.", success: false };
  }
}

```

### FILE: D:/SMM_plan_2/src/actions/auth/password-settings.ts
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

### FILE: D:/SMM_plan_2/src/actions/auth/refresh-balance.ts
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

### FILE: D:/SMM_plan_2/src/actions/auth/request-magic-link.ts
```ts
"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { sendMagicLink, sendWelcomeLetter } from "@/lib/smtp";
import { RateLimitService } from "@/services/core/rate-limit.service";
import { logger } from "@/lib/logger";
import crypto from "crypto";
import { cookies } from "next/headers";

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
    const isIpAllowed = await RateLimitService.check('auth:magic-link:ip', 15, 3600);
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
      let user = await tx.user.findUnique({ where: { email: cleanEmail } });

      if (user && (user.isDeleted || !user.isActive)) {
        return { type: 'blocked' as const };
      }

      if (!user) {
        isNewUser = true;
        const isIpAllowedForReg = await RateLimitService.check('auth:register:ip', 3, 86400);
        if (!isIpAllowedForReg) {
          return { type: 'rate_limit_reg' as const };
        }

        const ownerCount = await tx.user.count({ where: { role: "OWNER" } });
        const role = ownerCount === 0 ? "OWNER" : "USER";
        user = await tx.user.create({ data: { email: cleanEmail, role, referredById } });
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
        log.info('Deleting newly created user due to SMTP failure', { email: cleanEmail });
        try {
          await db.user.delete({ where: { id: user.id } });
        } catch (e) {
          log.error('Failed to delete newly created user', { error: e });
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

