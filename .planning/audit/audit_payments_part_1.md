# 📋 Чек-лист и последовательность проведения аудита для внешнего ИИ (GLM-5.2 / Claude)
# Домен: Payments & Billing (Часть 1 из 3)

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

## 💻 Исходный код для анализа (Часть 1):
### FILE: src/actions/finance/settings.ts
```ts
'use server';

import { accountingService } from '@/services/financial/accounting.service';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';

import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';

const financeSettingsSchema = z.object({
  taxRate: z.coerce.number().min(0, "Налоговая ставка не может быть отрицательной").max(100, "Налоговая ставка не может превышать 100%").optional().default(6.0),
  opexMonthly: z.coerce.number().min(0, "OPEX не может быть отрицательным").max(10000000, "Максимальный лимит OPEX - 10,000,000 ₽").optional().default(0)
});

export async function updateSystemSettings(formData: FormData) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const result = await requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = financeSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new Error('Validation error');
    const { taxRate, opexMonthly: opexRubles } = parsed.data;
    const opexMonthly = Math.round(opexRubles * 100);

    const oldSettings = await db.systemSettings.findUnique({
      where: { id: 'global' }
    });

    await accountingService.updateSettings(taxRate, opexMonthly);
  
    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_FINANCE_SETTINGS',
      target: 'global',
      targetType: 'SETTINGS',
      oldValue: oldSettings,
      newValue: { taxRate, opexMonthly },
      ipAddress
    });

    revalidatePath('/admin/finance');
  });
}

```

### FILE: src/actions/user/top-up.action.ts
```ts
'use server';

import { db } from "@/lib/db";
import { verifySession } from "@/lib/session";
import { headers } from "next/headers";
import { getBaseUrlAsync } from "@/utils/get-base-url";
import { getClientIp } from "@/utils/ip";
import { RateLimitService } from "@/services/core/rate-limit.service";

export async function createTopUpPaymentAction(
  amountRub: number,
  gateway: 'yookassa' | 'cryptobot' | 'robokassa' | 'sbp' = 'yookassa'
) {
  const session = await verifySession();
  if (!session) throw new Error("Unauthorized");
  
  const isAllowed = await RateLimitService.check(`topup:${session.userId}`, 5, 300);
  if (!isAllowed) throw new Error("Слишком много попыток пополнения. Попробуйте через 5 минут.");

  const amountCents = Math.round(amountRub * 100);
  if (amountCents < 1000) throw new Error("Минимальная сумма пополнения — 10 ₽");

  // Fetch user
  const dbUser = await db.user.findUnique({ where: { id: session.userId } });
  if (!dbUser) throw new Error("Пользователь не найден.");
  if (dbUser.isDeleted === true || dbUser.isActive === false) throw new Error("Ваш аккаунт заблокирован или удален");

  if ((gateway === 'yookassa' || gateway === 'sbp') && amountCents > 1_500_000) {
    if (!dbUser.telegramId) {
      throw new Error("Для пополнения баланса свыше 15 000 ₽ картой или СБП, пожалуйста, привяжите ваш Telegram-аккаунт в настройках профиля либо воспользуйтесь безналичным расчетом для юрлиц (B2B).");
    }
  }



  const reqHeaders = await headers();
  const consentIp = await getClientIp();
  const consentUserAgent = reqHeaders.get("user-agent") || "Unknown";

  const termsDoc = await db.contentItem.findUnique({
    where: { slug: 'terms' },
    select: { updatedAt: true }
  });
  const consentVersion = termsDoc ? `terms:${termsDoc.updatedAt.toISOString()}` : `fallback:${new Date().toISOString().split('T')[0]}`;

  const payment = await db.payment.create({
    data: {
      userId: session.userId,
      amount: amountCents,
      currency: "RUB",
      status: "PENDING",
      gateway,
      consentIp,
      consentUserAgent,
      consentVersion
    }
  });

  const { PaymentGatewayFactory } = await import('@/services/financial/payment-gateway.service');
  const gatewaySvc = PaymentGatewayFactory.getGateway(gateway);
  const successUrl = `${await getBaseUrlAsync()}/dashboard/add-funds?success=1`;
  const description = gateway === 'yookassa'
    ? `Оплата услуг IT-агентства (Digital Consulting, Счёт: ${payment.id})`
    : `Пополнение баланса (Счёт: ${payment.id})`;

  const { SettingsProvider } = await import('@/lib/settings');
  const isTestMode = await SettingsProvider.isTestMode();

  try {
    const gatewayResult = await gatewaySvc.createPayment({
      paymentId: payment.id,
      userId: session.userId,
      amountRub,
      email: dbUser.email,
      successUrl,
      description,
      isTestMode: isTestMode || dbUser.email === 'e2e-tester@test.com',
      metadata: { type: 'deposit' }
    });

    if (gatewayResult.remoteGatewayId || gatewayResult.paymentUrl) {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          gatewayId: gatewayResult.remoteGatewayId || undefined,
          checkoutUrl: gatewayResult.paymentUrl || undefined
        }
      });
    }

    return { success: true, paymentUrl: gatewayResult.paymentUrl || `/payment-redirect?id=${payment.id}` };
  } catch (err: unknown) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'CANCELED' }
    }).catch(() => {});

    const errorMessage = err instanceof Error ? err.message : 'Ошибка создания платежа в платежной системе';
    throw new Error(errorMessage, { cause: err });
  }
}

```

### FILE: src/actions/admin/finance/payments.ts
```ts
'use server';

/**
 * Admin Payments Server Action — Dispute Pack & Registry
 *
 * Security: Staff permission check ('finance', 'view').
 */

import { db } from '@/lib/db';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';

const paymentsParamsSchema = z.object({
  status:   z.enum(['ALL', 'PENDING', 'SUCCEEDED', 'CANCELED']).default('ALL'),
  period:   z.enum(['today', 'week', 'month', 'all']).default('month'),
  gateway:  z.string().optional(),
  search:   z.string().max(255).optional(),
  cursor:   z.string().optional(),
  pageSize: z.number().int().min(1).max(200).default(50),
  tenantId: z.string().optional(),
});

export type PaymentsParams = z.infer<typeof paymentsParamsSchema>;

export type PaymentDTO = {
  id: string;
  userId: string;
  userEmail: string;
  amount: number; // in Cents at DB layer, passed as number
  currency: string;
  status: string;
  gateway: string;
  gatewayId: string | null;
  consentIp: string | null;
  consentUserAgent: string | null;
  createdAt: string;
  tenantId: string;
};

export type PaymentsPageResult = {
  items: PaymentDTO[];
  nextCursor: string | null;
  hasMore: boolean;
};

function getPeriodStart(period: string): Date | undefined {
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  return undefined;
}

export async function getPaymentsAction(params: Partial<PaymentsParams>): Promise<PaymentsPageResult | { success: false, error: string }> {
  return requireStaffPermission('finance', 'view', async (admin) => {
    const p = paymentsParamsSchema.parse(params);
    const periodStart = getPeriodStart(p.period);

    const searchTrim = p.search?.trim();
    const activeTenantId = resolveAdminTenantContext(admin, p.tenantId);

    const where = {
      ...(p.status !== 'ALL' ? { status: p.status } : {}),
      ...(p.gateway ? { gateway: p.gateway } : {}),
      ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
      ...(activeTenantId && activeTenantId !== 'all' ? { tenantId: activeTenantId } : {}),
      ...(searchTrim ? {
        OR: [
          { user: { is: { email: { contains: searchTrim, mode: 'insensitive' as const } } } },
          { id: { contains: searchTrim, mode: 'insensitive' as const } },
          { gatewayId: { contains: searchTrim, mode: 'insensitive' as const } }
        ]
      } : {}),
    };

    const pageSize = p.pageSize;
    const payments = await db.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize + 1,
      ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    const hasMore = payments.length > pageSize;
    const page = hasMore ? payments.slice(0, pageSize) : payments;

    return {
      items: page.map(e => ({
        id: e.id,
        userId: e.userId,
        userEmail: e.user?.email ?? 'Unknown',
        amount: Number(e.amount),
        currency: e.currency,
        status: e.status,
        gateway: e.gateway,
        gatewayId: e.gatewayId,
        consentIp: e.consentIp,
        consentUserAgent: e.consentUserAgent,
        createdAt: e.createdAt.toISOString(),
        tenantId: e.tenantId,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      hasMore,
    };
  });
}

type DisputePackOrderDTO = {
  id: string;
  numericId: number;
  serviceName: string;
  link: string;
  quantity: number;
  charge: number; // Cents
  status: string;
  remains: number;
  createdAt: string;
};

export type DisputePackLedgerDTO = {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
};

export type PaymentDisputePackDTO = {
  payment: PaymentDTO;
  user: {
    id: string;
    email: string;
    createdAt: string;
    totalSpent: number; // Cents
    balance: number; // Cents
  };
  orders: DisputePackOrderDTO[];
  ledgerEntries: DisputePackLedgerDTO[];
};

export async function getPaymentDisputePackAction(paymentId: string): Promise<PaymentDisputePackDTO | { success: false, error: string }> {
  return requireStaffPermission('finance', 'view', async (admin): Promise<PaymentDisputePackDTO | { success: false; error: string }> => {
    const payment = await db.payment.findFirst({
      where: { id: paymentId, tenantId: admin.tenantId ?? 'smmplan' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            totalSpent: true,
            balance: true,
          },
        },
        orders: {
          include: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return { success: false, error: 'Платеж не найден' };
    }

    if (!payment.user) {
      return { success: false, error: 'Пользователь не связан с платежом' };
    }

    // Capture associated orders (either direct or post-deposit orders)
    let associatedOrders = payment.orders;
    if (associatedOrders.length === 0) {
      // Direct deposit top-up: find orders created by this user right after the payment was initiated (up to 7 days)
      associatedOrders = await db.order.findMany({
        where: {
          userId: payment.userId,
          createdAt: {
            gte: payment.createdAt,
            lte: new Date(payment.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days window
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        include: {
          service: {
            select: {
              name: true,
            },
          },
        },
      });
    }

    const ledgerEntries = await db.ledgerEntry.findMany({
      where: { userId: payment.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      payment: {
        id: payment.id,
        userId: payment.userId,
        userEmail: payment.user.email,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        gateway: payment.gateway,
        gatewayId: payment.gatewayId,
        consentIp: payment.consentIp,
        consentUserAgent: payment.consentUserAgent,
        createdAt: payment.createdAt.toISOString(),
        tenantId: payment.tenantId,
      },
      user: {
        id: payment.user.id,
        email: payment.user.email,
        createdAt: payment.user.createdAt.toISOString(),
        totalSpent: Number(payment.user.totalSpent),
        balance: Number(payment.user.balance),
      },
      orders: associatedOrders.map(o => ({
        id: o.id,
        numericId: o.numericId,
        serviceName: o.service?.name ?? 'Unknown Service',
        link: o.link,
        quantity: o.quantity,
        charge: Number(o.charge),
        status: o.status,
        remains: o.remains,
        createdAt: o.createdAt.toISOString(),
      })),
      ledgerEntries: ledgerEntries.map(l => ({
        id: l.id,
        type: l.transactionType,
        amount: Number(l.amount),
        description: l.reason,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  });
}

```

### FILE: src/services/financial/payment.service.ts
```ts
import { db } from '@/lib/db';
import { runSerializableTransaction } from '@/lib/transactions';
import { WalletOps } from './wallet-ops';
import { revalidatePath } from 'next/cache';
import { sendOrderPaidMail } from '@/lib/smtp';
import { logPromoCodeUsageIfNeeded } from '@/services/marketing-utils';

function safeRevalidatePath(path: string, type?: 'layout' | 'page') {
  try {
    revalidatePath(path, type);
  } catch (err) {
    const msg = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err);
    console.warn(`[Cache] revalidatePath failed for ${path}:`, msg);
  }
}

export class PaymentService {
  /**
   * Confirms a payment and activates the linked order.
   * Called by webhook handlers (YooKassa, CryptoBot).
   * 
   * Flow: Payment PENDING → SUCCEEDED → Order AWAITING_PAYMENT → PENDING
   */
  async confirmPayment(
    gatewayId: string, 
    amount: number | bigint, 
    userId: string, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isDevSandbox = false,
    gatewayType: 'yookassa' | 'cryptobot' | 'robokassa' = 'yookassa',
    internalPaymentId?: string,
    metadataType?: string,
    receiptId?: string
  ): Promise<boolean> {
    const activatedOrders: { id: string; isDripFeed: boolean; userId: string; amount: number; userEmail?: string | null; serviceName?: string | null; numericId?: number }[] = [];

    try {
      // 1. Double-check against real gateway API in production
      if (process.env.NODE_ENV === 'production' && gatewayType === 'yookassa') {
        const { SettingsManager } = await import('@/lib/settings');
        const secrets = await SettingsManager.getPaymentSecrets();
        
        // We attempt to verify with YooKassa if secrets are configured
        if (secrets.yookassaShopId && secrets.yookassaSecretKey) {
            const authHeader = 'Basic ' + Buffer.from(`${secrets.yookassaShopId}:${secrets.yookassaSecretKey}`).toString('base64');
            try {
                const response = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
                    headers: { 'Authorization': authHeader },
                    signal: AbortSignal.timeout(15000)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.status !== 'succeeded') {
                        throw new Error(`PAYMENT_NOT_SUCCEEDED: Real gateway status is ${data.status}`);
                    }
                    const realAmount = Math.round(parseFloat(data.amount.value) * 100);
                    if (realAmount < amount) {
                        throw new Error(`PAYMENT_AMOUNT_MISMATCH: Webhook amount ${amount} exceeds Real amount ${realAmount}`);
                    }
                    console.info(`[Payment] Safely verified YooKassa payment ${gatewayId}`);
                } else {
                    throw new Error(`GATEWAY_ERROR: Failed to contact YooKassa API or Payment Not Found (${response.status})`);
                }
            } catch (e: unknown) {
                console.error(`[Payment] Verification Exploit Blocked: ${(e instanceof Error ? e.message : String(e))}`);
                return false; // Reject payment
            }
        } else {
             console.error(`[Payment] YooKassa verification failed for ${gatewayId} due to missing secrets in admin panel! Rejecting for safety.`);
             return false;
        }
      }

      // 2. Atomic transaction: confirm payment + activate order
      await runSerializableTransaction(async (tx) => {
        // Find payment by internal ID (preferred) or gateway ID
        let payment = null;
        if (internalPaymentId) {
          payment = await tx.payment.findUnique({ where: { id: internalPaymentId } });
        }
        if (!payment) {
          payment = await tx.payment.findUnique({ where: { gatewayId } });
        }

        const receivedAmountBigInt = BigInt(amount);

        // 1. Process or Create Payment atomically via Upsert to prevent orphaned double-creation
        const currentPayment = payment
          ? await tx.payment.findUnique({ where: { id: payment.id } })
          : await tx.payment.findUnique({ where: { gatewayId } });

        if (currentPayment && currentPayment.status === 'SUCCEEDED') {
          console.info(`[Payment] ${gatewayId} already processed (atomic idempotency hit)`);
          return;
        }

        // [SECURITY CR-4 FIX] Gateway ID Consistency Guard
        if (currentPayment && currentPayment.gatewayId && currentPayment.gatewayId !== gatewayId) {
          console.error(`[Payment] Gateway ID mismatch for payment ${currentPayment.id}: expected ${currentPayment.gatewayId}, got ${gatewayId}`);
          throw new Error('PAYMENT_GATEWAY_ID_MISMATCH: Gateway ID mismatch detected.');
        }

        // [SECURITY CR-4 FIX] Currency Consistency Guard
        if (currentPayment && currentPayment.currency && currentPayment.currency !== 'RUB') {
          console.error(`[Payment] Currency mismatch for payment ${currentPayment.id}: expected RUB, got ${currentPayment.currency}`);
          throw new Error('PAYMENT_CURRENCY_MISMATCH: Unsupported payment currency.');
        }

        // [SECURITY CR-4 FIX] Exact Amount Verification: Reject both underpayment and overpayment exploits
        if (currentPayment && currentPayment.amount !== receivedAmountBigInt) {
          console.error(`[Payment] Amount mismatch exploit attempt for ${gatewayId}: expected ${currentPayment.amount}, got ${receivedAmountBigInt}`);
          throw new Error('PAYMENT_AMOUNT_MISMATCH: Amount received from gateway does not match expected payment amount.');
        }

        let processedPaymentId: string;
        let isOrderPayment: boolean;
        let linkedOrderId: string;
        let targetUserId: string;

        if (currentPayment) {
          // [SECURITY CR-4 FIX] Do NOT overwrite currentPayment.amount with webhook amount. Use expected payment.userId
          targetUserId = currentPayment.userId;
          if (userId && currentPayment.userId !== userId) {
            console.warn(`[Payment] User mismatch: caller passed ${userId}, payment bound to ${currentPayment.userId}. Using payment.userId.`);
          }

          const updated = await tx.payment.updateMany({
            where: { id: currentPayment.id, status: 'PENDING' },
            data: { status: 'SUCCEEDED', gatewayId, receiptId: receiptId || undefined }
          });
          if (updated.count === 0) {
            const fresh = await tx.payment.findUnique({
              where: { id: currentPayment.id },
              select: { status: true }
            });
            console.warn(
              `[Payment] No transition for ${currentPayment.id}. Current status: ${fresh?.status}`
            );
            return true;
          }
          processedPaymentId = currentPayment.id;
          isOrderPayment = !!currentPayment.orderId;
          linkedOrderId = currentPayment.orderId || '';
        } else {
          // [SECURITY] Orphan webhook rejected
          console.error(`[SECURITY] Orphan webhook rejected for gatewayId: ${gatewayId}. No PENDING payment found.`);
          throw new Error('ORPHAN_WEBHOOK: Stray webhooks are no longer allowed to credit accounts. All payments must be initiated by the system.');
        }

        const creditAmount = currentPayment ? currentPayment.amount : receivedAmountBigInt;

        // [FIN-009] Removed awardCommission from payment.service.ts. 
        // Referral commissions are now awarded in order.service.ts based on order margin.

        // Assign funds locally
        if (isOrderPayment && linkedOrderId) {
          // Activate linked order
          const order = await tx.order.findUnique({ 
            where: { id: linkedOrderId },
            include: { user: { select: { email: true } }, service: { select: { name: true } } }
          });
          if (order && order.status === 'AWAITING_PAYMENT') {
            await tx.order.update({
              where: { id: linkedOrderId },
              data: { status: 'PENDING' }
            });
            await logPromoCodeUsageIfNeeded(tx, linkedOrderId, targetUserId);
            activatedOrders.push({ 
              id: order.id, 
              isDripFeed: order.isDripFeed, 
              userId: targetUserId, 
              amount: Number(creditAmount),
              userEmail: order.user?.email ?? null,
              serviceName: order.service?.name ?? null,
              numericId: order.numericId 
            });
            await WalletOps.credit(tx, targetUserId, Number(creditAmount),
              `Оплата заказа #${order.numericId} через шлюз`,
              { idempotencyKey: `gateway-credit-${processedPaymentId}` }
            );
            await WalletOps.charge(tx, targetUserId, Number(order.charge),
              `Списание за заказ #${order.numericId}`,
              { idempotencyKey: `gateway-charge-${order.id}` }
            );
          }
        }

        // --- NEW BASKET LOGIC (Deposit-Driven 1:N Orders) ---
        const basketOrders = await tx.order.findMany({ 
          where: { paymentId: processedPaymentId, status: 'AWAITING_PAYMENT' },
          include: { user: { select: { email: true } }, service: { select: { name: true } } }
        });
        if (basketOrders.length > 0) {
           await tx.order.updateMany({
              where: { paymentId: processedPaymentId, status: 'AWAITING_PAYMENT' },
              data: { status: 'PENDING' }
           });
           
           for (const order of basketOrders) {
              activatedOrders.push({ 
                id: order.id, 
                isDripFeed: order.isDripFeed, 
                userId: targetUserId, 
                amount: Number(order.charge),
                userEmail: order.user?.email ?? null,
                serviceName: order.service?.name ?? null,
                numericId: order.numericId 
              });
              await logPromoCodeUsageIfNeeded(tx, order.id, targetUserId);
           }

            // Credit full expected paid amount first to currentPayment.userId
            await WalletOps.credit(tx, targetUserId, Number(creditAmount),
              `Оплата корзины заказов через шлюз`,
              { idempotencyKey: `gateway-credit-${processedPaymentId}` }
            );

            // Batch deduct total charge and log ledger entries
            const totalChargeCents = basketOrders.reduce((sum, order) => sum + Number(order.charge), 0);
            
            await WalletOps.charge(
              tx,
              targetUserId,
              totalChargeCents,
              `Списание за оплату корзины заказов (${basketOrders.length} шт.)`,
              { idempotencyKey: `gateway-basket-charge-${processedPaymentId}` }
            );

        }

        if (!isOrderPayment && basketOrders.length === 0) {
          // Direct top-up (Deposit) - Increment User Balance securely via targetUserId and expected creditAmount!
          await WalletOps.credit(tx, targetUserId, Number(creditAmount),
            `Пополнение баланса через ${gatewayType}`,
            { idempotencyKey: `deposit-${processedPaymentId}` }
          );
        }
      });

      // Invalidate user dashboard cache so they see the new order & spending immediately
      safeRevalidatePath('/dashboard', 'layout');
      
      // Dispatch paid orders to processing queue
      if (activatedOrders.length > 0) {
        const { ordersQueue } = await import('@/workers/queues');
        for (const activated of activatedOrders) {
          await ordersQueue.add('order-dispatch', { orderId: activated.id }, { jobId: `dispatch-${activated.id}`, delay: 3 * 60 * 1000 }); // 3 min cooling-off
          
          if (activated.userEmail && activated.serviceName) {
            void sendOrderPaidMail(
              activated.userEmail,
              activated.numericId?.toString() ?? activated.id,
              activated.serviceName
            ).catch(err => console.error('[H1] sendOrderPaidMail failed', err));
          }
        }
      }

      // Check and issue promotional loyalty rewards based on new total spent
      import('@/services/users/promo-automation.service').then(mod => {
        mod.PromoAutomationService.checkAndIssueLoyalty(userId).catch(console.error);
      });

      return true;
    } catch (e: unknown) {
      console.error('[PaymentService] Error confirming payment:', (e instanceof Error ? e.message : String(e)));
      return false;
    }
  }

  /**
   * Confirms a payment directly by paymentId (for mock/test flows).
   */
  async confirmPaymentById(paymentId: string): Promise<boolean> {
    try {
      let capturedUserId: string | null = null;
      const activatedOrders: { id: string; isDripFeed: boolean; userEmail?: string | null; serviceName?: string | null; numericId?: number }[] = [];

      await db.$transaction(async (tx) => {
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId }
        });

        const updatedPayment = await tx.payment.updateMany({
          where: { 
            id: paymentId,
            status: 'PENDING'
          },
          data: { 
            status: 'SUCCEEDED',
            gatewayId: `test_${Date.now()}`
          }
        });

        // If count is 0, another concurrent call already activated it
        if (updatedPayment.count === 0) return;

        capturedUserId = payment.userId;

        // [FIN-009] Removed awardCommission from payment.service.ts.
        // Referral commissions are now awarded in order.service.ts based on order margin.

        // Activate linked order
        if (payment.orderId) {
          const order = await tx.order.findUnique({
            where: { id: payment.orderId },
            include: { user: { select: { email: true } }, service: { select: { name: true } } }
          });

          if (order && order.status === 'AWAITING_PAYMENT') {
            await tx.order.update({
              where: { id: payment.orderId },
              data: { status: 'PENDING' }
            });
            await logPromoCodeUsageIfNeeded(tx, payment.orderId, payment.userId);
            activatedOrders.push({ 
              id: order.id, 
              isDripFeed: order.isDripFeed,
              userEmail: order.user?.email ?? null,
              serviceName: order.service?.name ?? null,
              numericId: order.numericId
            });
            
            await WalletOps.credit(tx, payment.userId, Number(payment.amount),
              `Оплата заказа #${order.numericId} через шлюз`,
              { idempotencyKey: `gateway-credit-${paymentId}` }
            );
            await WalletOps.charge(tx, payment.userId, Number(order.charge),
              `Списание за заказ #${order.numericId}`,
              { idempotencyKey: `gateway-charge-${order.id}` }
            );
          }
        }

        // --- NEW BASKET LOGIC (TEST MODE) ---
        const basketOrders = await tx.order.findMany({ 
          where: { paymentId: paymentId, status: 'AWAITING_PAYMENT' },
          include: { user: { select: { email: true } }, service: { select: { name: true } } }
        });
        if (basketOrders.length > 0) {
           await tx.order.updateMany({
              where: { paymentId: paymentId, status: 'AWAITING_PAYMENT' },
              data: { status: 'PENDING' }
           });
           
           for (const order of basketOrders) {
              activatedOrders.push({ 
                id: order.id, 
                isDripFeed: order.isDripFeed,
                userEmail: order.user?.email ?? null,
                serviceName: order.service?.name ?? null,
                numericId: order.numericId
              });
              await logPromoCodeUsageIfNeeded(tx, order.id, payment.userId);
           }

            // Credit full paid amount first
            await WalletOps.credit(tx, payment.userId, Number(payment.amount),
              `Оплата корзины заказов через шлюз`,
              { idempotencyKey: `gateway-credit-${paymentId}` }
            );

            // Batch deduct total charge and log ledger entries
            const totalChargeCents = basketOrders.reduce((sum, order) => sum + Number(order.charge), 0);
            
            await WalletOps.charge(
              tx,
              payment.userId,
              totalChargeCents,
              `Списание за оплату корзины заказов (${basketOrders.length} шт.)`,
              { idempotencyKey: `gateway-basket-charge-${paymentId}` }
            );

        }

        if (!payment.orderId && basketOrders.length === 0) {
          // Direct top-up (Deposit) - Increment User Balance securely!
          await WalletOps.credit(tx, payment.userId, Number(payment.amount),
            `Пополнение баланса через yookassa`,
            { idempotencyKey: `deposit-${paymentId}` }
          );
        }
      }, { isolationLevel: 'Serializable', timeout: 15000 });

      safeRevalidatePath('/dashboard', 'layout');

      // Dispatch paid orders to processing queue
      if (activatedOrders.length > 0) {
        const { ordersQueue } = await import('@/workers/queues');
        for (const activated of activatedOrders) {
          await ordersQueue.add('order-dispatch', { orderId: activated.id }, { jobId: `dispatch-${activated.id}`, delay: 3 * 60 * 1000 }); // 3 min cooling-off
          
          if (activated.userEmail && activated.serviceName) {
            void sendOrderPaidMail(
              activated.userEmail,
              activated.numericId?.toString() ?? activated.id,
              activated.serviceName
            ).catch(err => console.error('[H1] sendOrderPaidMail failed', err));
          }
        }
      }

      if (capturedUserId) {
        import('@/services/users/promo-automation.service').then(mod => {
          mod.PromoAutomationService.checkAndIssueLoyalty(capturedUserId!).catch(console.error);
        });
      }

      return true;
    } catch (e: unknown) {
      console.error('[PaymentService] Error:', (e instanceof Error ? e.message : String(e)));
      return false;
    }
  }
}

export const paymentService = new PaymentService();


```

### FILE: src/services/financial/unified-payment.service.ts
```ts
import { db } from '@/lib/db';
import { getBaseUrlAsync } from '@/utils/get-base-url';
import { SettingsManager } from '@/lib/settings';
import {  } from '@/services/financial/payment-gateway.service';

type PaymentMetadata = {
  source?: string;
  serviceId?: string;
  promoId?: string;
  [key: string]: unknown;
};

export class UnifiedPaymentService {
  /**
   * Universal method to generate payment URLs for the Bot (Deposits & Top-ups).
   * Reused central PaymentGatewayFactory to support Robokassa, YooKassa, and CryptoBot without duplication.
   */
  static async createPayment(
    projectId: string | undefined, 
    userId: string, 
    amountRub: number, 
    description: string, 
    metadata: PaymentMetadata,
    gateway: 'yookassa' | 'cryptobot' | 'robokassa' = 'yookassa'
  ): Promise<{ success: boolean; confirmationUrl?: string; paymentId?: string; error?: string }> {
    try {
      const amountCents = Math.round(amountRub * 100);

      // 1. Create a PENDING payment record
      const payment = await db.payment.create({
        data: {
          userId,
          amount: amountCents,
          currency: 'RUB',
          status: 'PENDING',
          gateway
        }
      });
      const { SettingsProvider } = await import('@/lib/settings');
      const supportDomain = await SettingsProvider.getSupportEmailDomain();
      const successUrl = `${await getBaseUrlAsync(supportDomain)}/dashboard`;

      // 2. Generate Payment Link synchronously
      const { PaymentGatewayFactory } = await import('@/services/financial/payment-gateway.service');
      const gatewaySvc = PaymentGatewayFactory.getGateway(gateway);
      
      const gatewayResult = await gatewaySvc.createPayment({
        paymentId: payment.id,
        userId,
        amountRub,
        email: null,
        successUrl,
        description,
        metadata,
        isTestMode: await SettingsManager.isTestMode()
      });

      if (gatewayResult.remoteGatewayId || gatewayResult.paymentUrl) {
        await db.payment.update({
          where: { id: payment.id },
          data: {
            gatewayId: gatewayResult.remoteGatewayId || undefined,
            checkoutUrl: gatewayResult.paymentUrl || undefined
          }
        });
      }

      return {
        success: true,
        paymentId: payment.id,
        confirmationUrl: gatewayResult.paymentUrl || `/payment-redirect?id=${payment.id}`
      };

    } catch (e: unknown) {
      console.error('[UnifiedPayment] System error:', (e instanceof Error ? e.message : String(e)));
      return { success: false, error: 'Internal logic exception' };
    }
  }
}

```

