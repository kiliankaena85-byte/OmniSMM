# 📋 Чек-лист и последовательность проведения аудита для внешнего ИИ (GLM-5.2 / Claude)
# Домен: Payments & Billing (Часть 3 из 3)

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
  email             String
  passwordHash      String?
  role              String    @default("USER") // USER, SUPPORT, MANAGER, OWNER
  preferredDashboard String   @default("CLASSIC") // "CLASSIC" or "LOVABLE"
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

  // 152-FZ Compliance (Terms of Service / Privacy Policy agreement tracking)
  tosAcceptedAt   DateTime?
  tosAcceptedIp   String?

  // Operator notes (internal, never visible to client)
  adminNote          String? // Free-form operator note
  adminNoteUpdatedAt DateTime? // When the note was last updated
  adminNoteUpdatedBy String? // Email of operator who wrote the note

  // Personal AI API Key (Encrypted AES-256) for staff actions
  geminiApiKey       String?

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
  ogrn         String?
  legalAddress String?

  // Telegram Notification Preferences
  telegramNotifyOrders  Boolean @default(true)
  telegramNotifyBalance Boolean @default(true)
  telegramNotifyTickets Boolean @default(true)

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

  targetBalanceAdjustments    ManualBalanceAdjustment[] @relation("targetBalanceAdjustments")
  requestedBalanceAdjustments ManualBalanceAdjustment[] @relation("requestedBalanceAdjustments")
  approvedBalanceAdjustments  ManualBalanceAdjustment[] @relation("approvedBalanceAdjustments")
  rejectedBalanceAdjustments  ManualBalanceAdjustment[] @relation("rejectedBalanceAdjustments")

  employeeConsents           EmployeeResponsibilityConsent[]
  staffFinancialActions      SupportFinancialAction[]        @relation("staffFinancialActions")
  targetFinancialActions     SupportFinancialAction[]        @relation("targetFinancialActions")
  staffShifts                StaffShift[]                    @relation("UserStaffShifts")
  substituteStaffShifts      StaffShift[]                    @relation("ShiftSubstitute")

  tenantId String @default("smmplan")

  @@unique([email, tenantId])
  @@index([tenantId])
  @@index([createdAt(sort: Desc), id(sort: Desc)])
  @@index([tenantId, createdAt(sort: Desc), id(sort: Desc)])
}

model Payment {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Restrict)

  orderId String? @unique // Legacy pointer, no longer used as the active Prisma relation

  orders         Order[]
  smartCampaigns SmartCampaign[]
  tickets        Ticket[]

  amount    BigInt // amount in Cents (BigInt: supports balances up to 90 trillion RUB)
  currency  String  @default("RUB")
  status    String  @default("PENDING") // PENDING, SUCCEEDED, CANCELED
  gatewayId String? @unique // yookassa payment id
  gateway   String  @default("yookassa") // yookassa, cryptobot, test

  // Legal Consent Logging (PB-004 Chargeback Defense)
  consentIp        String?
  consentUserAgent String?
  consentVersion   String?

  checkoutUrl String? // Persistent checkout URL to allow users to resume payment

  // FZ-54 Fiscal Data
  receiptId       String?  @unique // ID of the receipt in YooKassa/Atol
  refundReceiptId String?  @unique // ID of the refund receipt
  invoice         Invoice?

  abVariant String? // A/B test variant tag: A, B, C

  tenantId String @default("smmplan")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([gatewayId])
  @@index([tenantId])
  @@index([tenantId, userId])
  @@index([tenantId, status, createdAt])
  @@index([status])
  @@index([createdAt])
}

model LedgerEntry {
  id              String   @id @default(cuid())
  tenantId        String?  @default("smmplan")
  userId          String // Client whose balance was affected
  user            User     @relation("UserLedger", fields: [userId], references: [id], onDelete: Restrict)
  adminId         String? // Support agent who initiated, null if SYSTEM/auto
  amount          BigInt // Amount in Cents (positive = credit, negative = debit)
  reason          String // Mandatory justification text
  status          String   @default("APPROVED") // APPROVED, QUARANTINE, REJECTED
  idempotencyKey  String?
  transactionType String   @default("PAYMENT") // PAYMENT | REFUND | REROUTE | COMPENSATION
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([idempotencyKey, transactionType])
  @@index([userId])
  @@index([status])
  @@index([adminId])
  @@index([adminId, createdAt])
  @@index([tenantId])
  @@index([tenantId, createdAt(sort: Desc), id(sort: Desc)])
  @@index([createdAt(sort: Desc), id(sort: Desc)])
  @@index([userId, createdAt(sort: Desc), id(sort: Desc)])
}

model Invoice {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  amount    BigInt // in Cents (RUB)
  status    String   @default("PENDING") // PENDING, PAID, CANCELED
  fileUrl   String? // Link to generated PDF invoice
  actUrl    String? // Link to Closing Document (УПД/Акт)
  paymentId String?  @unique
  payment   Payment? @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([status])
}

model PromoCode {
  id              String    @id @default(cuid())
  code            String    @unique
  type            String    @default("DISCOUNT") // DISCOUNT (%), VOUCHER (fixed amount)
  discountPercent Float // 10.0 = 10% (used when type=DISCOUNT)
  amount          Int       @default(0) // Fixed amount in Cents (used when type=VOUCHER)
  maxUses         Int       @default(1)
  uses            Int       @default(0)
  isActive        Boolean   @default(true)
  expiresAt       DateTime?
  createdAt       DateTime  @default(now())

  description  String?
  utmSource    String?
  utmMedium    String?
  utmCampaign  String?
  budgetCents  Int              @default(0)
  isSuspicious Boolean          @default(false)
  usages       PromoCodeUsage[]
  orders       Order[]
}

model PromoCodeUsage {
  id          String    @id @default(cuid())
  promoCodeId String
  promoCode   PromoCode @relation(fields: [promoCodeId], references: [id], onDelete: Cascade)
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  orderId     String?   @unique
  order       Order?    @relation(fields: [orderId], references: [id], onDelete: SetNull)

  discountCents BigInt // Exact discount given in cents
  revenueCents  BigInt // Order payment (order.charge) in cents
  profitCents   BigInt // Margin (order.charge - order.providerCost) in cents

  isSuspicious Boolean  @default(false)
  createdAt    DateTime @default(now())

  @@index([promoCodeId])
  @@index([userId])
}

model B2bConfig {
  id               String  @id @default(cuid())
  userId           String  @unique
  user             User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  isB2b            Boolean @default(true)
  prioritySupport  Boolean @default(true) // Выделение и приоритетная поддержка
  webhookUrl       String? // Webhook URL для синхронизации тикетов
  webhookSecret    String? // Секретный ключ подписи вебхуков B2B
  isWebhookActive  Boolean @default(false) // Toggle for webhook status
  customLimitCents Int? // Кастомный лимит компенсаций (если null — лимит не применяется!)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 📜 Правила и контракты проекта (AGENTS.md):
```markdown
# AGENTS.md — Smmplan AI Developer Contract (v4.1)
# Этот файл — единый источник правды для ЛЮБОГО AI-ассистента (Cursor, Claude Code, Gemini, Antigravity).
# Все генерируемые изменения ОБЯЗАНЫ строго соблюдать эти правила.

## 0. ⛔ SESSION INIT — ОБЯЗАТЕЛЬНЫЙ ПЕРВЫЙ ШАГ (BLOCKING)

> ❌ **ЗАПРЕЩЕНО** начинать любую работу без выполнения этого раздела.
> Это не рекомендация — это блокирующее требование контракта.

### При каждом старте сессии в этом проекте:

1. **Прочитай файл-якорь** → `d:\SMM_plan_2\CURRENT_STATE.md`
   - Убедись, что знаешь текущую активную вкладку и список завершённых экранов
   - Выведи 1-строчное резюме: "Активная задача: X. Завершено: A, B, C."

2. **Запроси RAG-память** (для нетривиальных задач) → `http://localhost:8100/api/search`
   ```bash
   npx tsx scripts/memory-client.ts searchContext "<тема задачи>"
   ```
   Или через curl: `POST http://localhost:8100/api/search` с `{"query": "...", "collections": ["architecture_decisions","business_rules"], "top_k": 5}`

3. **После завершения задачи — немедленно обнови:**
   - `d:\SMM_plan_2\CURRENT_STATE.md` — статус текущего экрана
   - `d:\SMM_plan_2\MEMORY.md` — раздел 2, если задача существенная
   - GraphRAG: `POST http://localhost:8100/api/decision` — если принято архитектурное решение

---


## 1. Стек и окружение
- **Framework**: Next.js 16.x (App Router, Turbopack)
- **UI**: React 19.x
- **Styling**: Tailwind CSS 4.0.0 (`@theme` в `src/app/globals.css`, CSS-first config)
- **Component Library**: HeroUI v3 (dot notation API: `<Table.Header>`, `<Table.Column>`)
- **ORM**: Prisma 5 (PostgreSQL)
- **Language**: TypeScript 5.7+ (strict mode)
- **AI Models**: `gemini-3-flash` или `gemini-3-flash-preview`
- **Linting & Testing**: ESLint 10 (Flat Config — `eslint.config.mjs`) | Vitest 4

---

## 2. Архитектурные границы и безопасность (CRITICAL)

### Server/Client Boundary
- **Server Components** по умолчанию. `'use client'` только при наличии React hooks или Browser APIs.
- **Server Actions** строго в `src/actions/` с обязательным guard `requireAdmin()` или `requireStaffPermission()`.
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** ставить `"use server"` в Page Components (`page.tsx`) — вызывает краш приложения.

### Multi-Tenant Rules & SMMpanel 1.0
- Проект обслуживает СТРОГО 2 бренда: **SMMplan** (`smmplan.pro`) и **SMMflux** (`smmflux.ru`).
- ❌ **Брендов Lovable и SMMboost НЕ существует.** Запрещено добавлять фантомные бренды в код, конфиги или макеты. Алиас `normalizeTenantId('lovable')` -> `'flux'` сохранен для обратной совместимости.
- ✅ **Админ-панель называется строго SMMpanel 1.0** (в сайдбаре, заголовках и шапке).
- ✅ **Глобальный переключатель сайтов в Header:** Переключение между сайтами (`SMMplan` / `SMMflux`) осуществляется **ГЛОБАЛЬНО в верхней панели (Header/Navbar)** через `<GlobalSiteSwitcher />` с сохранением в куке `x_admin_tenant` и параметре `?tenant=...`.
- ❌ **ЗАПРЕЩЕНО** хардкодить хосты (`smmplan.pro`, `smmflux.ru`) в коде. Использовать `getTenantHost(tenantId)`.
- ✅ **Canonical URLs** обязаны быть абсолютными через `absoluteCanonical(tenantId, path)`.
- ✅ Кэш-ключи в `unstable_cache` обязаны включать `tenantId` (например, `catalog-${tenantId}`).

### Cloudflare Tunnel & Network Binding Invariants
- ❌ **ЗАПРЕЩЕНО** использовать сторонние туннели (SSH reverse tunnels, ngrok, localtunnel).
- ✅ **ВСЕГДА** использовать официальный Cloudflare Tunnel (`cloudflared.exe tunnel`) через скрипт `scripts/start-tunnel.ps1` для домена `test.smmplan.pro`.
- ✅ **Сетевой биндинг:** Сервер Next.js обязан запускаться с `HOSTNAME="0.0.0.0"` и `PORT="3000"`, обеспечивая доступ для Docker-коннектора с `host.docker.internal:3000` без ошибки 502 Bad Gateway.

### Финансовая безопасность (Trust Boundary)
- ❌ **ЗАПРЕЩЕНО** менять `User.balance` напрямую или доверять ценам из клиентского UI.
- ✅ Все операции с балансом — ТОЛЬКО через `WalletOps.credit()`, `WalletOps.debit()`, `WalletOps.refund()`.
- ✅ Все денежные суммы — строго в `BigInt` (копейки). Все финансовые логи — через `await auditAdminAwaitable()`.
- ✅ Каждая финансовая транзакция обязана содержать уникальный `idempotencyKey`.

### Каталог и провайдеры (Shadow Catalog)
- ❌ **ЗАПРЕЩЕНО** импортировать сырые каталоги провайдеров (5000+ позиций) напрямую в PostgreSQL `Service`.
- ✅ Все каталоги провайдеров буферизуются в Redis (`provider:{id}:catalog`). В БД попадают только одобренные админом услуги (Cherry-Pick).
- ✅ **Ценообразование в UI:** пользователь ВСЕГДА видит розничную цену за 1 штуку (`pricePerUnitRub`), подпись строго: `₽ / шт`. Запрещено писать `/ 1000 шт` или умножать цену на 1000 на клиенте.

---

## 3. Стандарты верстки, UX и Дизайн-Системы (CRITICAL)

### Dual-Brand Design System Tokens & UI Forge Harness
- ❌ **НИКОГДА** не используй inline-цвета и сырые стили: `text-white`, `bg-black`, `text-blue-500`, `border-[1px]`, `rounded-[17px]`.
- ❌ **ЗАПРЕЩЕНО** писать сырые `<button>` и `<input>` в пользовательском UI.
- ✅ **ВСЕГДА** используй компоненты UI Арсенала из `@/components/ui
... (truncated)
```

---

## 💻 Исходный код для анализа (Часть 3):
### FILE: src/app/api/webhooks/yookassa/route.ts
```ts
interface YooKassaWebhookPayload {
  type?: string;
  event?: string;
  created_at?: string;
  object?: {
    id?: string;
    status?: string;
    paid?: boolean;
    amount?: {
      value?: string;
      currency?: string;
    };
    created_at?: string;
    metadata?: {
      paymentId?: string;
      userId?: string;
      orderId?: string;
      source?: string;
      [key: string]: unknown;
    };
    receipt_registration?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { paymentService } from '@/services/financial/payment.service';
import { db } from '@/lib/db';
import { MutexManager } from '@/lib/redis-lock';

const MAX_BODY_SIZE = 1024 * 64; // 64KB

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function rubToKopecks(value: unknown): bigint {
  if (typeof value !== 'string') {
    throw new Error('INVALID_AMOUNT_FORMAT');
  }

  const normalized = value.trim();

  const decimalMatch = /^(\d+)\.(\d{2})$/.exec(normalized);
  if (decimalMatch) {
    return BigInt(decimalMatch[1]) * BigInt(100) + BigInt(decimalMatch[2]);
  }

  const integerMatch = /^(\d+)$/.exec(normalized);
  if (integerMatch) {
    return BigInt(integerMatch[1]) * BigInt(100);
  }

  throw new Error('INVALID_AMOUNT_FORMAT');
}

export async function POST(req: NextRequest) {
  try {
    const { getClientIp } = await import('@/utils/ip');
    const rawIp = await getClientIp();
    const ip = rawIp.replace(/^::ffff:/, '');

    const { SettingsProvider } = await import('@/lib/settings');
    const isTestMode = await SettingsProvider.isTestMode();

    const isDev = process.env.NODE_ENV === 'development';

    // VULN-025 Mitigation: Check webhook secret if explicitly configured
    const secret = req.nextUrl.searchParams.get('secret');
    const expectedSecret = process.env.YOOKASSA_WEBHOOK_SECRET;

    if (expectedSecret && secret && !safeCompare(secret, expectedSecret)) {
      console.error(`[YooKassa Webhook] BLOCKED: Invalid secret parameter from IP ${ip}`);
      await db.securityEvent.create({ data: { event: 'INVALID_WEBHOOK_SECRET', severity: 'CRITICAL', ip, details: { gateway: 'yookassa' } } });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // --- SECURITY GUARD: Yookassa Official IP Range Validation ---
    const isLocalhost = ip === '::1' || ip === '127.0.0.1' || ip.startsWith('127.0.0.');
    const hostHeader = req.headers.get('host') || '';
    const isTestDomain = hostHeader.includes('test.') || hostHeader.includes('stage.') || hostHeader.includes('localhost');

    const allowedPrefixes = ['185.75.120.', '185.75.121.', '185.75.122.', '185.75.123.', '185.75.124.', '185.75.125.', '185.75.126.', '185.75.127.', '37.110.12.', '37.110.13.', '37.110.14.', '37.110.15.', '37.110.16.', '37.110.17.', '37.110.18.', '37.110.19.'];
    const isAllowedIp = isDev || isTestMode || isTestDomain || isLocalhost || allowedPrefixes.some(prefix => ip.startsWith(prefix));
    
    if (!isAllowedIp) {
      console.error(`[YooKassa Webhook] BLOCKED: IP spoofing attempt from ${ip}`);
      await db.securityEvent.create({ data: { event: 'SPOOFED_IP_WEBHOOK', severity: 'CRITICAL', ip, details: { gateway: 'yookassa' } } });
      return NextResponse.json({ error: 'Unauthorized IP' }, { status: 403 });
    }

    const providedSignature = req.headers.get('x-sha256-signature') || req.headers.get('digest');
        let rawBody: YooKassaWebhookPayload;

    if (providedSignature && expectedSecret) {
      const rawText = await req.text();
      if (rawText.length > MAX_BODY_SIZE) {
        console.warn('[Webhook] Oversized payload rejected');
        await db.securityEvent.create({ data: { event: 'OVERSIZED_PAYLOAD', severity: 'WARNING', ip, details: { gateway: 'yookassa', size: rawText.length } } });
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
      }

      const crypto = (await import('crypto')).default;
      const expectedSig = crypto
        .createHmac('sha256', expectedSecret)
        .update(rawText, 'utf8')
        .digest('hex');

      const signatureHex = providedSignature.replace(/^sha256=/i, '');
      const HEX_REGEX = /^[0-9a-f]{64}$/i;
      
      if (!HEX_REGEX.test(signatureHex)) {
        await db.securityEvent.create({ data: { event: 'INVALID_SIGNATURE_FORMAT', severity: 'CRITICAL', ip, details: { gateway: 'yookassa', signature: providedSignature } } });
        return NextResponse.json({ error: 'Invalid signature format' }, { status: 403 });
      }

      if (!safeCompare(expectedSig, signatureHex)) {
        console.error('[YooKassa] HMAC signature mismatch — possible webhook forgery attempt');
        await db.securityEvent.create({ data: { event: 'SIGNATURE_FAILED', severity: 'CRITICAL', ip, details: { gateway: 'yookassa' } } });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }

      rawBody = JSON.parse(rawText);
    } else {
      rawBody = await req.json();
    }
    
    const webhookCreatedAt = rawBody.object?.created_at || rawBody.created_at;
    if (webhookCreatedAt) {
      const webhookTime = new Date(webhookCreatedAt).getTime();
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      if (webhookTime < thirtyMinutesAgo) {
         await db.securityEvent.create({ data: { event: 'REPLAY_ATTEMPT', severity: 'CRITICAL', ip, details: { gateway: 'yookassa', webhookTime, gatewayId: rawBody.object?.id } } });
         return NextResponse.json({ error: 'Stale webhook rejected' }, { status: 400 });
      }
    }

    if (rawBody.event === 'payment.succeeded' && rawBody.object) {
      const gatewayId = rawBody.object.id;
      if (typeof gatewayId !== 'string' || gatewayId.trim().length === 0) {
        console.error('[YooKassa Webhook] Missing or invalid gatewayId');
        return NextResponse.json({ error: 'Invalid gatewayId' }, { status: 400 });
      }

      const currency = String(rawBody.object.amount?.currency || '').toUpperCase();
      if (currency !== 'RUB') {
        console.error(`[YooKassa Webhook] Invalid currency: ${currency}`);
        return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
      }

      let amountCents: bigint;
      try {
        amountCents = rubToKopecks(rawBody.object.amount?.value);
      } catch {
        console.error('[YooKassa Webhook] Failed to parse amount via rubToKopecks');
        return NextResponse.json({ error: 'Invalid amount format' }, { status: 400 });
      }
      
      const userId = rawBody.object.metadata?.userId;
      const internalPaymentId = rawBody.object.metadata?.paymentId;
      const metadataType = typeof rawBody.object.metadata?.type === "string" ? rawBody.object.metadata.type : undefined;

      const receiptId = rawBody.object.receipt_registration === 'succeeded' 
        ? `yookassa_receipt_${gatewayId}` 
        : undefined;

      if (!userId) {
        return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
      }

      try {
        const result = await MutexManager.withLock(`webhook_payment_${gatewayId}`, 15000, 10000, async () => {
          let existingPayment = null;
          if (internalPaymentId) {
            existingPayment = await db.payment.findUnique({ where: { id: internalPaymentId } });
          }
          if (!existingPayment && gatewayId) {
            existingPayment = await db.payment.findUnique({ where: { gatewayId } });
          }
          if (existingPayment && existingPayment.status === 'SUCCEEDED') {
            console.info(`[YooKassa Webhook] Payment ${existingPayment.id} already processed (idempotency hit)`);
            return NextResponse.json({ success: true, status: 'Payment processed strictly (idempotent)' }, { status: 200 });
          }

          const success = await paymentService.confirmPayment(
            gatewayId, amountCents, userId, isTestMode, 'yookassa', internalPaymentId, metadataType, receiptId
          );

          if (success) {
            const LARGE_PAYMENT_THRESHOLD = BigInt(50_000_00);
            if (amountCents >= LARGE_PAYMENT_THRESHOLD) {
              import('@/lib/notifications').then(async ({ sendAdminAlert }) => {
                const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
                const email = user?.email || userId;
                const formattedRub = (Number(amountCents) / 100).toLocaleString('ru-RU');
                sendAdminAlert(
                  `💰 Large payment: ${formattedRub} ₽ from ${email}`,
                  'INFO'
                );
              }).catch(err => console.error('[YooKassa Webhook] Large payment alert failed', err));
            }
            return NextResponse.json({ success: true, status: 'Payment processed strictly' }, { status: 200 });
          } else {
            return NextResponse.json({ error: 'Payment double-check validation failed' }, { status: 400 });
          }
        });
        
        return result;
      } catch (lockError) {
        console.error(`[YooKassa Webhook] Failed to acquire lock for payment ${gatewayId}:`, lockError);
        return NextResponse.json({ error: 'Concurrent processing lock timeout' }, { status: 429 });
      }
    }

    return NextResponse.json({ status: 'Ignored unsupported event' }, { status: 200 });
  } catch (error: unknown) {
    console.error('Webhook error:', (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}


```

### FILE: src/app/api/order-status/route.ts
```ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { SettingsManager } from '@/lib/settings';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { getClientIp } from '@/utils/ip';

/**
 * GET /api/order-status?orderId=xxx
 * Returns the current status of an order for the authenticated user.
 * Used by the success page to poll for webhook confirmation.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = await getClientIp(req);
    const isAllowed = await RateLimitService.check(`order_status:${ip}`, 30, 60);
    if (!isAllowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const session = await verifySession();
    const orderId = req.nextUrl.searchParams.get('orderId');
    const paymentId = req.nextUrl.searchParams.get('paymentId');
    const token = req.nextUrl.searchParams.get('token');

    if (!orderId && !paymentId) {
      return NextResponse.json({ error: 'Missing orderId or paymentId' }, { status: 400 });
    }

    // [Phase 3 Surgeon] Validate capability token to handle sessionless payment redirects
    let isTokenValid = false;
    if (token) {
      try {
        const { jwtVerify } = await import('jose');
        const { getEncodedKey } = await import('@/lib/session');
        const { payload } = await jwtVerify(token, getEncodedKey());
        if (payload.purpose === 'payment_return' && (payload.orderId === orderId || payload.paymentId === paymentId)) {
          isTokenValid = true;
        }
      } catch {
        // Token verification failed, proceed without token authorization
      }
    }

    if (orderId) {
      let order = await db.order.findUnique({
        where: session ? { id: orderId, userId: session.userId } : { id: orderId },
        include: {
          payment: true,
          service: { select: { name: true } },
        },
      });

      if (!order) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      if (!session && !isTokenValid) {
        const isAwaiting = order.status === 'AWAITING_PAYMENT';
        const isRecentlyUpdated = order.updatedAt && (Date.now() - new Date(order.updatedAt).getTime() < 15 * 60 * 1000);
        if (!isAwaiting && !isRecentlyUpdated) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }

      // Synchronous status check fallback
      if (order.status === 'AWAITING_PAYMENT' && order.payment && order.payment.gatewayId) {
        const gateway = order.payment.gateway;
        const gatewayId = order.payment.gatewayId;
        const pId = order.payment.id;
        
        let isActuallyPaid = false;
        let checkAmount = Number(order.payment.amount);

        if (gateway === 'yookassa') {
          const secrets = await SettingsManager.getPaymentSecrets();
          if (secrets.yookassaShopId && secrets.yookassaSecretKey) {
            const authHeader = 'Basic ' + Buffer.from(`${secrets.yookassaShopId}:${secrets.yookassaSecretKey}`).toString('base64');
            try {
              const response = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
                headers: { 'Authorization': authHeader }
              });
              if (response.ok) {
                const data = await response.json();
                if (data.status === 'succeeded' || data.status === 'waiting_for_capture') {
                  isActuallyPaid = true;
                  checkAmount = Math.round(parseFloat(data.amount.value) * 100);
                }
              }
            } catch (e: unknown) {
              console.error('[order-status] YooKassa sync fallback failed:', (e instanceof Error ? e.message : String(e)));
            }
          }
        } else if (gateway === 'cryptobot' || gateway === 'robokassa') {
          try {
            const { PaymentGatewayFactory } = await import('@/services/financial/payment-gateway.service');
            const gatewaySvc = PaymentGatewayFactory.getGateway(gateway);
            if (gatewaySvc.checkStatusSync) {
              isActuallyPaid = await gatewaySvc.checkStatusSync(gatewayId);
            }
          } catch (e: unknown) {
            console.error(`[order-status] ${gateway} sync fallback failed:`, (e instanceof Error ? e.message : String(e)));
          }
        }

        if (isActuallyPaid) {
          const isTestMode = await SettingsManager.isTestMode();
          const { paymentService } = await import('@/services/financial/payment.service');
          await paymentService.confirmPayment(
            gatewayId,
            checkAmount,
            order.userId,
            isTestMode,
            gateway as 'yookassa' | 'cryptobot' | 'robokassa',
            pId,
            'order'
          );

          const updatedOrder = await db.order.findUnique({
            where: session ? { id: orderId, userId: session.userId } : { id: orderId },
            include: {
              payment: true,
              service: { select: { name: true } },
            },
          });
          if (updatedOrder) order = updatedOrder;
        }
      }

      if (!session && !isTokenValid) {
        return NextResponse.json({
          orderId: order.id,
          numericId: order.numericId,
          status: order.status,
        });
      }

      return NextResponse.json({
        orderId: order.id,
        numericId: order.numericId,
        status: order.status,
        charge: Number(order.charge),
        quantity: order.quantity,
        serviceName: order.service.name,
      });

    } else if (paymentId) {
      let payment = await db.payment.findUnique({
        where: session ? { id: paymentId, userId: session.userId } : { id: paymentId },
      });

      if (!payment) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      if (!session && !isTokenValid) {
        const isAwaiting = payment.status === 'PENDING';
        const isRecentlyUpdated = payment.updatedAt && (Date.now() - new Date(payment.updatedAt).getTime() < 15 * 60 * 1000);
        if (!isAwaiting && !isRecentlyUpdated) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }

      // Synchronous status check fallback
      if (payment.status === 'PENDING' && payment.gatewayId) {
        const gateway = payment.gateway;
        const gatewayId = payment.gatewayId;
        
        let isActuallyPaid = false;
        let checkAmount = Number(payment.amount);

        if (gateway === 'yookassa') {
          const secrets = await SettingsManager.getPaymentSecrets();
          if (secrets.yookassaShopId && secrets.yookassaSecretKey) {
            const authHeader = 'Basic ' + Buffer.from(`${secrets.yookassaShopId}:${secrets.yookassaSecretKey}`).toString('base64');
            try {
              const response = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
                headers: { 'Authorization': authHeader }
              });
              if (response.ok) {
                const data = await response.json();
                if (data.status === 'succeeded' || data.status === 'waiting_for_capture') {
                  isActuallyPaid = true;
                  checkAmount = Math.round(parseFloat(data.amount.value) * 100);
                }
              }
            } catch (e: unknown) {
              console.error('[order-status] YooKassa sync fallback failed:', (e instanceof Error ? e.message : String(e)));
            }
          }
        } else if (gateway === 'cryptobot' || gateway === 'robokassa') {
          try {
            const { PaymentGatewayFactory } = await import('@/services/financial/payment-gateway.service');
            const gatewaySvc = PaymentGatewayFactory.getGateway(gateway);
            if (gatewaySvc.checkStatusSync) {
              isActuallyPaid = await gatewaySvc.checkStatusSync(gatewayId);
            }
          } catch (e: unknown) {
            console.error(`[order-status] ${gateway} sync fallback failed:`, (e instanceof Error ? e.message : String(e)));
          }
        }

        if (isActuallyPaid) {
          const isTestMode = await SettingsManager.isTestMode();
          const { paymentService } = await import('@/services/financial/payment.service');
          await paymentService.confirmPayment(
            gatewayId,
            checkAmount,
            payment.userId,
            isTestMode,
            gateway as 'yookassa' | 'cryptobot' | 'robokassa',
            paymentId,
            'order'
          );

          const updatedPayment = await db.payment.findUnique({
            where: session ? { id: paymentId, userId: session.userId } : { id: paymentId },
          });
          if (updatedPayment) payment = updatedPayment;
        }
      }

      return NextResponse.json({
        orderId: payment.id,
        numericId: 0,
        status: payment.status === 'COMPLETED' ? 'COMPLETED' : (payment.status === 'PENDING' ? 'AWAITING_PAYMENT' : payment.status),
        charge: Number(payment.amount),
        quantity: 0,
        serviceName: 'Массовый заказ',
      });
    }

    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[order-status] Error:', (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

```

### FILE: src/workers/processors/payment-sync.ts
```ts
import { Job } from 'bullmq';
import { db } from '../../lib/db';
import { SyncJobPayload } from '../../lib/queue-manager';
import { SettingsManager } from '../../lib/settings';
import { paymentService } from '../../services/financial/payment.service';
import { logger } from '../../lib/logger';

const log = logger.child({ component: 'PaymentSyncProcessor' });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default async function paymentSyncProcessor(job: Job<SyncJobPayload>) {
  log.info('Starting pending payments synchronization...');

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1. Auto-cancel stale non-YooKassa payments older than 24 hours
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const stalePayments = await db.payment.findMany({
      where: {
        status: 'PENDING',
        gateway: { notIn: ['yookassa'] },
        createdAt: { lt: staleThreshold }
      },
      select: { id: true, orderId: true },
      take: 50
    });

    for (const payment of stalePayments) {
      try {
        await db.$transaction(async (tx) => {
          const updated = await tx.payment.updateMany({
            where: { id: payment.id, status: 'PENDING' },
            data: { status: 'CANCELED' }
          });
          if (updated.count === 0) return;

          if (payment.orderId) {
            await tx.order.updateMany({
              where: { id: payment.orderId, status: 'AWAITING_PAYMENT' },
              data: { status: 'CANCELED', error: 'Оплата не поступила в течение 24ч (auto-expire)' }
            });
          }
        });
        log.info(`Stale non-YooKassa payment ${payment.id} expired successfully.`);
      } catch (err) {
        const errMsg = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err);
        log.error(`Failed to expire stale payment ${payment.id}: ${errMsg}`);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err);
    log.error(`Error during stale payments cleanup: ${errMsg}`);
  }

  // 2. Fetch pending YooKassa payments
  const pendingPayments = await db.payment.findMany({
    where: {
      status: 'PENDING',
      gateway: 'yookassa',
      createdAt: {
        lt: tenMinutesAgo,
        gt: twentyFourHoursAgo
      }
    },
    take: 50,
    orderBy: { createdAt: 'asc' }
  });

  if (pendingPayments.length === 0) {
    log.info('No pending YooKassa payments found for synchronization.');
    return;
  }

  log.info(`Found ${pendingPayments.length} pending YooKassa payments to check.`);

  const isTestMode = await SettingsManager.isTestMode();
  if (isTestMode) {
    log.info('System is in Sandbox/Test mode. Skipping real YooKassa API status checks.');
    return;
  }

  const secrets = await SettingsManager.getPaymentSecrets();
  const shopId = secrets.yookassaShopId;
  const secretKey = secrets.yookassaSecretKey;

  if (!shopId || !secretKey) {
    log.error('YooKassa shopId or secretKey is not configured. Aborting payments synchronization.');
    return;
  }

  const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');

  for (const payment of pendingPayments) {
    if (!payment.gatewayId) {
      log.warn(`Pending payment ${payment.id} has no remote gatewayId. Skipping.`);
      continue;
    }

    try {
      log.info(`Checking remote status for payment ${payment.id} (YooKassa ID: ${payment.gatewayId})...`);

      const response = await fetch(`https://api.yookassa.ru/v3/payments/${payment.gatewayId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        log.error(`Failed to fetch YooKassa payment ${payment.gatewayId}. Status code: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const remoteStatus = data.status; // succeeded, canceled, pending, waiting_for_capture

      log.info(`Payment ${payment.id} remote status is: ${remoteStatus}`);

      if (remoteStatus === 'succeeded') {
        const realAmountCents = Math.round(parseFloat(data.amount.value) * 100);
        log.info(`Payment ${payment.id} succeeded remotely with amount: ${realAmountCents} cents. Confirming locally...`);
        
        const success = await paymentService.confirmPayment(
          payment.gatewayId,
          realAmountCents,
          payment.userId,
          false,
          'yookassa',
          payment.id
        );

        if (success) {
          log.info(`Successfully synced and confirmed payment ${payment.id}.`);
        } else {
          log.error(`Failed to confirm payment ${payment.id} locally during synchronization.`);
        }
      } else if (remoteStatus === 'canceled') {
        log.info(`Payment ${payment.id} has been canceled remotely. Updating local database...`);
        await db.payment.update({
          where: { id: payment.id },
          data: { status: 'CANCELED' }
        });
        log.info(`Successfully marked payment ${payment.id} as CANCELED.`);
      }
    } catch (err: unknown) {
      log.error(`Exception while syncing payment ${payment.id}: ${(err instanceof Error ? err.message : String(err))}`, { cause: err });
    }
  }

  log.info('Finished pending payments synchronization.');
}

```

