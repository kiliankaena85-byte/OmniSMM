# 📋 Чек-лист и последовательность проведения аудита для внешнего ИИ (GLM-5.2 / Claude)
# Домен: Payments & Billing (Часть 2 из 3)

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

## 💻 Исходный код для анализа (Часть 2):
### FILE: src/services/financial/payment-gateway.service.ts
```ts
import { db } from '@/lib/db';
import { getBaseUrlAsync } from '@/utils/get-base-url';
import { SettingsManager } from '@/lib/settings';
import { WalletOps } from './wallet-ops';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MutexManager } from '@/lib/redis-lock';
import crypto from 'crypto';


export interface PaymentGatewayResult {
  paymentUrl: string;
  remoteGatewayId: string;
}

export interface PaymentGatewayParams {
  paymentId: string;
  orderId?: string;
  userId: string;
  amountRub: number;
  email: string | null;
  successUrl: string;
  description: string;
  metadata?: Record<string, unknown>;
  isTestMode?: boolean;
}

export abstract class BasePaymentGateway {
  abstract createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult>;
  
  // Optional method for synchronous status checking
  async checkStatusSync?(gatewayId: string): Promise<boolean>;
}

class YooKassaGateway extends BasePaymentGateway {
  async createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult> {
    if (params.amountRub <= 0 || Math.round(params.amountRub * 100) <= 0) {
      throw new Error('Сумма платежа должна быть больше 0');
    }

    const secrets = await SettingsManager.getPaymentSecrets();
    const shopId = secrets.yookassaShopId;
    const secretKey = secrets.yookassaSecretKey;

    const isDummyKeys = !shopId || !secretKey || shopId === 'test_shop_id' || shopId === 'test_shop_id_test' || secretKey === 'test_secret' || secretKey === 'test_secret_key';

    if (isDummyKeys) {
      return {
        paymentUrl: `${await getBaseUrlAsync()}/api/dev/mock-payment?paymentId=${params.paymentId}${params.orderId ? `&orderId=${params.orderId}` : ''}`,
        remoteGatewayId: `mock_${Date.now()}`
      };
    }

    const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
    
    const { SettingsProvider } = await import('@/lib/settings');
    const supportDomain = await SettingsProvider.getSupportEmailDomain();

    const payload: {
      amount: { value: string; currency: string };
      capture: boolean;
      confirmation: { type: string; return_url: string };
      description: string;
      metadata: Record<string, unknown>;
      receipt?: {
        customer: { email: string };
        items: Array<{
          description: string;
          quantity: string;
          amount: { value: string; currency: string };
          vat_code: number;
          payment_mode: string;
          payment_subject: string;
        }>;
      };
    } = {
      amount: { value: params.amountRub.toFixed(2), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: params.successUrl },
      description: params.description,
      metadata: { paymentId: params.paymentId, userId: params.userId, orderId: params.orderId, ...params.metadata }
    };

    // 54-ФЗ Fiscalization Receipt (Included in both live & test mode for universal YooKassa compatibility)
    const currentYear = new Date().getFullYear();
    const annualRevenue = await db.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: new Date(currentYear, 0, 1) }
      }
    }).then(res => Number(res._sum.amount || 0));

    const isVatThresholdExceeded = annualRevenue >= 2000000000; // 20 млн рублей (Порог освобождения от НДС на УСН ст. 145 НК РФ)
    const vatCode = isVatThresholdExceeded ? 10 : 1; // 10 = НДС 22% (п. 3 ст. 164 НК РФ), 1 = Без НДС

    payload.receipt = {
      customer: { email: params.email || `no-reply@${supportDomain}` },
      items: [{
        description: (params.description || "Информационные услуги").slice(0, 128),
        quantity: "1.00",
        amount: { value: params.amountRub.toFixed(2), currency: 'RUB' },
        vat_code: vatCode,
        payment_mode: "full_prepayment",
        payment_subject: "service"
      }]
    };

    const idempString = `yookassa_${params.userId}_${params.paymentId}_${Math.floor(Date.now() / 60000)}`;
    const idempKey = crypto.createHash('sha256').update(idempString).digest('hex').substring(0, 36);

    const resp = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'Idempotence-Key': idempKey
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[YooKassaGateway] API Error:', resp.status, errBody);
      let descriptiveError = 'Ошибка шлюза YooKassa';
      try {
        const parsed = JSON.parse(errBody);
        if (parsed.description) {
          descriptiveError = `YooKassa: ${parsed.description}`;
        } else if (parsed.code) {
          descriptiveError = `YooKassa (${parsed.code})`;
        }
      } catch {
        descriptiveError = `YooKassa HTTP ${resp.status}`;
      }
      throw new Error(descriptiveError);
    }

    const data = await resp.json();
    return {
      paymentUrl: data.confirmation.confirmation_url,
      remoteGatewayId: data.id
    };
  }

  async checkStatusSync(gatewayId: string): Promise<boolean> {
    try {
      const secrets = await SettingsManager.getPaymentSecrets();
      const shopId = secrets.yookassaShopId;
      const secretKey = secrets.yookassaSecretKey;
      if (!shopId || !secretKey) return false;

      const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
      const resp = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader },
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) return false;
      const data = await resp.json();
      return data.status === 'succeeded' || data.status === 'waiting_for_capture';
    } catch (e) {
      console.error('[YooKassaGateway] Error checking status', e);
      return false;
    }
  }
}

class CryptoBotGateway extends BasePaymentGateway {
  async createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult> {
    if (params.amountRub <= 0 || Math.round(params.amountRub * 100) <= 0) {
      throw new Error('Сумма платежа должна быть больше 0');
    }

    const secrets = await SettingsManager.getPaymentSecrets();
    const cryptoToken = secrets.cryptoBotToken;

    const isDummyKeys = params.isTestMode || !cryptoToken || cryptoToken === 'test_token' || cryptoToken === 'test_shop_id' || cryptoToken === 'test_login' || cryptoToken.startsWith('test_') || process.env.NODE_ENV === 'development';

    if (isDummyKeys) {
      return {
        paymentUrl: `${await getBaseUrlAsync()}/api/dev/mock-payment?paymentId=${params.paymentId}${params.orderId ? `&orderId=${params.orderId}` : ''}`,
        remoteGatewayId: `mock_${Date.now()}`
      };
    }

    const { SettingsProvider } = await import('@/lib/settings');
    const legalSettings = await SettingsProvider.getContactAndLegalSettings();
    const brandName = legalSettings.COMPANY_NAME || 'SMMplan';
    const cleanDesc = params.description.startsWith('Test ') 
      ? params.description.substring(5) 
      : params.description;
    const hiddenMessage = `${brandName} ${cleanDesc}`;

    const resp = await fetch('https://pay.crypt.bot/api/createInvoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Crypto-Pay-API-Token': cryptoToken
      },
      body: JSON.stringify({
        currency_type: 'fiat', // Allow paying in TON but amount specified in RUB
        fiat: 'RUB',
        amount: params.amountRub.toFixed(2),
        description: params.description,
        hidden_message: hiddenMessage,
        payload: params.paymentId
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!resp.ok) {
      console.error('[CryptoBotGateway] API Error:', await resp.text());
      throw new Error('Ошибка шлюза CryptoBot');
    }

    const data = await resp.json();
    if (!data.ok) throw new Error('CryptoBot returned error: ' + JSON.stringify(data.error));
    
    return {
      paymentUrl: data.result.pay_url,
      remoteGatewayId: data.result.invoice_id.toString()
    };
  }

  async checkStatusSync(gatewayId: string): Promise<boolean> {
    try {
      const secrets = await SettingsManager.getPaymentSecrets();
      const cryptoToken = secrets.cryptoBotToken;
      if (!cryptoToken) return false;

      const resp = await fetch(`https://pay.crypt.bot/api/getInvoices?invoice_ids=${gatewayId}`, {
        method: 'GET',
        headers: {
          'Crypto-Pay-API-Token': cryptoToken
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) return false;
      const data = await resp.json();
      if (!data.ok || !data.result || !data.result.items) return false;

      const item = data.result.items[0];
      return item && item.status === 'paid';
    } catch (e) {
      console.error('[CryptoBotGateway] Error checking status:', e);
      return false;
    }
  }
}

class BalanceGateway extends BasePaymentGateway {
  async createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult> {
    const amountCents = Math.round(params.amountRub * 100);
    const remoteId = `internal_${Date.now()}`;
    const { ordersQueue } = await import('@/workers/queues');

    // Perform atomic deduction inside the transaction to prevent race condition double-spending
    const updatedOrderIds: string[] = await db.$transaction(async (tx) => {
      // Atomic WalletOps deduction (already handles totalSpent increment securely)
      await WalletOps.charge(tx, params.userId, amountCents, params.description);

      await tx.payment.update({
          where: { id: params.paymentId },
          data: { status: 'SUCCEEDED', gatewayId: remoteId }
        });

        // Update any specific order if passed
        const ids = [];
        if (params.orderId) {
          const order = await tx.order.findUnique({
            where: { id: params.orderId }
          });
          if (order) {
            await tx.order.update({
              where: { id: params.orderId },
              data: { status: 'PENDING' }
            });
            if (order.promoCodeId) {
              const promo = await tx.promoCode.findUnique({
                where: { id: order.promoCodeId },
                select: { isSuspicious: true }
              });
              const isSuspicious = promo?.isSuspicious ?? false;
              
              const existingUsage = await tx.promoCodeUsage.findUnique({
                where: { orderId: order.id }
              });
              
              if (!existingUsage) {
                await tx.promoCodeUsage.create({
                  data: {
                    promoCodeId: order.promoCodeId,
                    userId: params.userId,
                    orderId: order.id,
                    discountCents: order.discountCents,
                    revenueCents: BigInt(Number(order.charge)),
                    profitCents: BigInt(Number(order.charge - order.providerCost)),
                    isSuspicious,
                  }
                });
              }
            }
            ids.push(params.orderId);
          }
        }

        // Also update any orders linked to this paymentId (Mass Orders / Basket)
        const basketOrders = await tx.order.findMany({ 
          where: { paymentId: params.paymentId, status: 'AWAITING_PAYMENT' } 
        });
        if (basketOrders.length > 0) {
          await tx.order.updateMany({
            where: { paymentId: params.paymentId, status: 'AWAITING_PAYMENT' },
            data: { status: 'PENDING' }
          });
          for (const order of basketOrders) {
            if (order.promoCodeId) {
              const promo = await tx.promoCode.findUnique({
                where: { id: order.promoCodeId },
                select: { isSuspicious: true }
              });
              const isSuspicious = promo?.isSuspicious ?? false;
              
              const existingUsage = await tx.promoCodeUsage.findUnique({
                where: { orderId: order.id }
              });
              
              if (!existingUsage) {
                await tx.promoCodeUsage.create({
                  data: {
                    promoCodeId: order.promoCodeId,
                    userId: params.userId,
                    orderId: order.id,
                    discountCents: order.discountCents,
                    revenueCents: BigInt(Number(order.charge)),
                    profitCents: BigInt(Number(order.charge - order.providerCost)),
                    isSuspicious,
                  }
                });
              }
            }
          }
          ids.push(...basketOrders.map(o => o.id));
        }
        
        return ids;
    }, { isolationLevel: 'Serializable', timeout: 15000 });

    for (const id of updatedOrderIds) {
      await ordersQueue.add('order-dispatch', { orderId: id }, { jobId: `dispatch-${id}`, delay: 3 * 60 * 1000 });
    }

    return {
      paymentUrl: params.successUrl,
      remoteGatewayId: remoteId
    };
  }
}

class RobokassaGateway extends BasePaymentGateway {
  async createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult> {
    if (params.amountRub <= 0 || Math.round(params.amountRub * 100) <= 0) {
      throw new Error('Сумма платежа должна быть больше 0');
    }

    const secrets = await SettingsManager.getPaymentSecrets();
    const login = secrets.robokassaLogin;
    const password = secrets.robokassaPassword;

    const isDummyKeys = params.isTestMode || !login || !password || login === 'test_login';

    if (isDummyKeys) {
      return {
        paymentUrl: `${await getBaseUrlAsync()}/api/dev/mock-payment?paymentId=${params.paymentId}${params.orderId ? `&orderId=${params.orderId}` : ''}`,
        remoteGatewayId: `mock_${Date.now()}`
      };
    }

    const outSum = params.amountRub.toFixed(2);
    const invId = 0; // Passed CUID in shp_paymentId

    // Robokassa signature formula: MerchantLogin:OutSum:InvId:MerchantPassword1:shp_paymentId=paymentId
    const sigStr = `${login}:${outSum}:${invId}:${password}:shp_paymentId=${params.paymentId}`;
    const signature = crypto.createHash('sha256').update(sigStr).digest('hex');

    // Подсчитываем оборот за год для переключения НДС 22% (ФЗ № 425-ФЗ, ФЗ № 176-ФЗ, ст. 145, 164 НК РФ)
    const currentYear = new Date().getFullYear();
    const annualRevenue = await db.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: new Date(currentYear, 0, 1) }
      }
    }).then(res => Number(res._sum.amount || 0));

    const isVatThresholdExceeded = annualRevenue >= 2000000000; // 20 млн рублей (Порог освобождения от НДС на УСН ст. 145 НК РФ)
    const taxRate = isVatThresholdExceeded ? "vat22" : "none"; // vat22 = 22% (п. 3 ст. 164 НК РФ), none = без НДС

    const receipt = {
      items: [{
        name: "Информационные услуги",
        quantity: 1,
        sum: params.amountRub.toFixed(2),
        tax: taxRate,
        payment_method: "full_prepayment",
        payment_subject: "service"
      }]
    };

    const queryParams = new URLSearchParams({
      MerchantLogin: login,
      OutSum: outSum,
      InvId: invId.toString(),
      Description: params.description,
      SignatureValue: signature,
      shp_paymentId: params.paymentId,
      Receipt: JSON.stringify(receipt)
    });

    const robokassaUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?${queryParams.toString()}`;

    return {
      paymentUrl: robokassaUrl,
      remoteGatewayId: `robo_${params.paymentId}`
    };
  }

  async checkStatusSync(gatewayId: string): Promise<boolean> {
    try {
      const paymentId = gatewayId.replace(/^robo_/i, '');
      const payment = await db.payment.findUnique({
        where: { id: paymentId }
      });
      return payment?.status === 'SUCCEEDED';
    } catch (e) {
      console.error('[RobokassaGateway] Error checking status:', e);
      return false;
    }
  }
}

class MockGateway extends BasePaymentGateway {
  async createPayment(params: PaymentGatewayParams): Promise<PaymentGatewayResult> {
    return {
      paymentUrl: `${await getBaseUrlAsync()}/api/dev/mock-payment?paymentId=${params.paymentId}${params.orderId ? `&orderId=${params.orderId}` : ''}`,
      remoteGatewayId: `mock_${Date.now()}`
    };
  }
}

export class PaymentGatewayFactory {
  static getGateway(gatewayName: string): BasePaymentGateway {
    switch (gatewayName.toLowerCase()) {
      case 'yookassa':
      case 'sbp':
      case 'card':
      case 'mir':
      case 'yoomoney':
        return new YooKassaGateway();
      case 'robokassa':
      case 'robo':
        return new RobokassaGateway();
      case 'cryptobot':
      case 'crypto':
      case 'usdt':
      case 'ton':
        return new CryptoBotGateway();
      case 'balance':
        return new BalanceGateway();
      case 'mock':
        return new MockGateway();
      default:
        // Fallback to YooKassa if unknown card/payment method passed
        return new YooKassaGateway();
    }
  }
}

```

### FILE: src/services/financial/wallet.service.ts
```ts
import { db } from '../../lib/db';
import { WalletOps } from './wallet-ops';

export class WalletService {
  /**
   * Safe charge mechanism with Serializable isolation & Idempotency.
   * Modifying balances using this guarantees no double-spending.
   */
  static async charge(
    userId: string,
    amountCents: number,
    reason: string,
    idempotencyKey?: string,
    adminId?: string
  ) {
    try {
      return await db.$transaction(
        async (tx) => WalletOps.charge(tx, userId, amountCents, reason, { idempotencyKey, adminId }),
        // Maximum isolation to prevent concurrent writes stealing balance
        { isolationLevel: 'Serializable' }
      );
    } catch (e: unknown) {
      return { success: false, error: (e instanceof Error ? e.message : String(e)) || 'Transaction failed', balance: null, cached: false };
    }
  }

  /**
   * Refill user balance (e.g., from Yookassa top-up)
   */
  static async credit(
    userId: string,
    amountCents: number,
    reason: string,
    idempotencyKey?: string,
    adminId?: string
  ) {
    try {
      return await db.$transaction(
        async (tx) => WalletOps.credit(tx, userId, amountCents, reason, { idempotencyKey, adminId }),
        { isolationLevel: 'Serializable' }
      );
    } catch (e: unknown) {
      return { success: false, error: (e instanceof Error ? e.message : String(e)) || 'Transaction failed', balance: null, cached: false };
    }
  }

  /**
   * Refund user balance: increments balance, decrements totalSpent, creates ledger entry.
   * 
   * ARCHITECTURE CONTRACT: Единственный способ оформить возврат клиенту.
   * Гарантирует: идемпотентность, Serializable isolation, ledger audit trail.
   * 
   * ВАЖНО: В отличие от credit(), этот метод УМЕНЬШАЕТ totalSpent,
   * что необходимо для корректной бухгалтерии (P&L).
   */
  static async refund(
    userId: string,
    amountCents: number,
    reason: string,
    idempotencyKey?: string,
    adminId?: string
  ) {
    try {
      return await db.$transaction(
        async (tx) => WalletOps.refund(tx, userId, amountCents, reason, { idempotencyKey, adminId }),
        { isolationLevel: 'Serializable' }
      );
    } catch (e: unknown) {
      return { success: false, error: (e instanceof Error ? e.message : String(e)) || 'Refund transaction failed', balance: null, cached: false };
    }
  }
}

```

### FILE: src/services/financial/wallet-ops.ts
```ts
import { Prisma } from '@prisma/client';

type PrismaTx = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export class WalletInsufficientFundsError extends Error {
  readonly code = 'INSUFFICIENT_FUNDS';
  constructor(needed: number | bigint, got: number | bigint) {
    super(`Insufficient funds: needed ${needed.toString()}, got ${got.toString()}`);
    this.name = 'WalletInsufficientFundsError';
  }
}

export class WalletUserNotFoundError extends Error {
  readonly code = 'USER_NOT_FOUND';
  constructor(userId: string) {
    super(`User ${userId} not found.`);
    this.name = 'WalletUserNotFoundError';
  }
}

export class WalletInvalidAmountError extends Error {
  readonly code = 'INVALID_AMOUNT';
  constructor(action: 'Charge' | 'Credit' | 'Adjustment' | 'Refund') {
    super(`${action} amount must be a strictly positive finite number.`);
    this.name = 'WalletInvalidAmountError';
  }
}

export const WalletOps = {
  /**
   * Safe charge mechanism without creating a new transaction.
   * Modifying balances using this guarantees no double-spending.
   */
  async charge(
    tx: PrismaTx,
    userId: string,
    amountCents: number | bigint,
    reason: string,
    opts?: { idempotencyKey?: string; adminId?: string }
  ) {
    const rawCents = typeof amountCents === 'bigint' ? amountCents : BigInt(amountCents);
    const MAX_SINGLE_CHARGE_CENTS = BigInt(100_000_000); // 1M RUB safety cap
    if (rawCents <= BigInt(0) || rawCents > MAX_SINGLE_CHARGE_CENTS) {
      throw new WalletInvalidAmountError('Charge');
    }

    const { idempotencyKey, adminId } = opts || {};

    if (idempotencyKey) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey },
      });
      
      if (existing) {
        return { success: true, balance: null, cached: true, entry: existing };
      }
    }

    const updatedUserBatch = await tx.user.updateMany({
      where: { 
        id: userId,
        balance: { gte: rawCents }
      },
      data: {
        balance: { decrement: rawCents },
        totalSpent: { increment: rawCents }
      }
    });

    if (updatedUserBatch.count === 0) {
      const checkUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, balance: true },
      });
      if (!checkUser) {
        throw new WalletUserNotFoundError(userId);
      }
      throw new WalletInsufficientFundsError(rawCents, checkUser.balance);
    }

    const finalUser = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { balance: true }
    });

    const entry = await tx.ledgerEntry.create({
      data: {
        userId,
        adminId,
        amount: -rawCents,
        reason,
        status: 'APPROVED',
        idempotencyKey,
      }
    });

    return { success: true, balance: finalUser.balance, cached: false, entry };
  },

  /**
   * Refill user balance (e.g., from Yookassa top-up) without creating a new transaction.
   */
  async credit(
    tx: PrismaTx,
    userId: string,
    amountCents: number | bigint,
    reason: string,
    opts?: { idempotencyKey?: string; adminId?: string }
  ) {
    const rawCents = typeof amountCents === 'bigint' ? amountCents : BigInt(amountCents);
    const MAX_SINGLE_CREDIT_CENTS = BigInt(100_000_000); // 1M RUB safety cap
    if (rawCents <= BigInt(0) || rawCents > MAX_SINGLE_CREDIT_CENTS) {
      throw new WalletInvalidAmountError('Credit');
    }

    const { idempotencyKey, adminId } = opts || {};

    if (idempotencyKey) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey },
      });
      if (existing) {
        return { success: true, balance: null, cached: true, entry: existing };
      }
    }

    try {
      const entry = await tx.ledgerEntry.create({
        data: {
          userId,
          adminId,
          amount: rawCents,
          reason,
          status: 'APPROVED',
          idempotencyKey,
        }
      });

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: rawCents } },
        select: { balance: true }
      });

      return { success: true, balance: updatedUser.balance, cached: false, entry };
    } catch (error: unknown) {
      if (
        idempotencyKey && 
        typeof error === 'object' && 
        error !== null && 
        'code' in error && 
        (error as { code: string }).code === 'P2002' && 
        'meta' in error && 
        typeof (error as { meta?: { target?: string[] } }).meta?.target === 'object'
      ) {
        // In a Serializable transaction, the transaction is already aborted here.
        // We throw the error so the caller can handle it gracefully.
        throw error;
      }
      throw error;
    }
  },

  /**
   * Universal adjustment for admin operations (can be positive or negative)
   * Does NOT affect totalSpent.
   */
  async adminAdjust(
    tx: PrismaTx,
    userId: string,
    amountCents: number,
    reason: string,
    opts?: { idempotencyKey?: string; adminId?: string }
  ) {
    if (!Number.isFinite(amountCents) || amountCents === 0) {
      throw new WalletInvalidAmountError('Adjustment');
    }

    const { idempotencyKey, adminId } = opts || {};

    if (idempotencyKey) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey },
      });
      if (existing) {
        return { success: true, balance: null, cached: true, entry: existing };
      }
    }

    const rawCents = BigInt(amountCents);
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: rawCents } },
      select: { balance: true }
    });

    const entry = await tx.ledgerEntry.create({
      data: {
        userId,
        adminId,
        amount: rawCents, 
        reason,
        status: 'APPROVED',
        idempotencyKey,
      }
    });

    return { success: true, balance: updatedUser.balance, cached: false, entry };
  },

  /**
   * Refund user balance: increments balance, decrements totalSpent, creates ledger entry.
   * 
   * ARCHITECTURE CONTRACT: Единственный способ оформить возврат клиенту.
   * Гарантирует: идемпотентность, Serializable isolation, ledger audit trail.
   * 
   * ВАЖНО: В отличие от credit(), этот метод УМЕНЬШАЕТ totalSpent,
   * что необходимо для корректной бухгалтерии (P&L).
   */
  async refund(
    tx: PrismaTx,
    userId: string,
    amountCents: number,
    reason: string,
    opts?: { idempotencyKey?: string; adminId?: string }
  ) {
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new WalletInvalidAmountError('Refund');
    }

    const { idempotencyKey, adminId } = opts || {};

    if (idempotencyKey) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey },
      });
      if (existing) {
        return { success: true, balance: null, cached: true, entry: existing };
      }
    }

    // Execute atomic balance increment and totalSpent decrement in single Prisma update step
    const rawCents = BigInt(amountCents);
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        balance: { increment: rawCents },
        // Atomic totalSpent decrement: ensure totalSpent does not go negative
        totalSpent: { decrement: rawCents }
      },
      select: { balance: true, totalSpent: true }
    });

    // Safety guard: if totalSpent became negative due to race or edge cases, auto-clamp to 0
    if (updatedUser.totalSpent < BigInt(0)) {
      await tx.user.update({
        where: { id: userId },
        data: { totalSpent: BigInt(0) }
      });
    }

    const entry = await tx.ledgerEntry.create({
      data: {
        userId,
        adminId,
        amount: rawCents,
        reason,
        status: 'APPROVED',
        idempotencyKey,
        transactionType: 'REFUND',
      }
    });

    return { success: true, balance: updatedUser.balance, cached: false, entry };
  },

  /**
   * Add funds to user quarantine balance bubble instead of main balance.
   */
  async quarantineAdd(
    tx: PrismaTx,
    userId: string,
    amountCents: number,
    reason: string,
    opts?: { idempotencyKey?: string; adminId?: string }
  ) {
    const { idempotencyKey, adminId } = opts || {};
    const absAmount = BigInt(Math.abs(amountCents));
    const rawCents = BigInt(amountCents);

    await tx.user.update({
      where: { id: userId },
      data: { quarantineBalance: { increment: absAmount } }
    });

    return await tx.ledgerEntry.create({
      data: {
        userId,
        adminId,
        amount: rawCents,
        reason,
        status: 'QUARANTINE',
        idempotencyKey
      }
    });
  },

  /**
   * Release or clear quarantine balance for a user.
   */
  async quarantineRelease(
    tx: PrismaTx,
    userId: string,
    amountCents: number
  ) {
    const absAmount = BigInt(Math.abs(amountCents));
    const updated = await tx.user.updateMany({
      where: { id: userId, quarantineBalance: { gte: absAmount } },
      data: { quarantineBalance: { decrement: absAmount } }
    });

    if (updated.count === 0) {
      await tx.user.update({
        where: { id: userId },
        data: { quarantineBalance: BigInt(0) }
      });
    }
  }
};

```

### FILE: src/services/financial/accounting.service.ts
```ts
import { db } from '@/lib/db';
import { Prisma, UsnScheme } from '@prisma/client';

interface FinancialMetrics {
  revenueGross: number; // Изначально принесенные деньги
  refunds: number; // Отмененные деньги, возвращенные балансами
  cogs: number; // Оплачено провайдерам (COGS)
  gatewayFees: number; // Комиссии шлюзов (ЮKassa, CryptoBot)
  revenueNet: number; // Выручка минус возвраты и комиссии шлюзов
  marginGross: number; // Net Revenue - COGS
  taxes: number;
  opex: number;
  profitNet: number; // Margin - Taxes - OPEX
  marginPercentage: number;
  annualRevenue: number; // Выручка за текущий календарный год
  effectiveTaxRate: number; // Итоговая расчетная ставка налога (%)
  isVatThresholdExceeded: boolean; // Превышен ли порог НДС 20 млн рублей
  usnScheme: UsnScheme;
}

class AccountingService {
  async getMetrics(startDate?: Date, endDate?: Date, tenantId?: string): Promise<FinancialMetrics> {
    const isSingleTenant = tenantId && tenantId !== 'all';
    
    const dateFilter = startDate && endDate ? { createdAt: { gte: startDate, lte: endDate } } : {};

    // 1. Calculate Revenue and Gateway Fees (All payments SUCCEEDED)
    const paymentGroups = await db.payment.groupBy({
      by: ['gateway'],
      _sum: { amount: true },
      where: {
        ...dateFilter,
        status: 'SUCCEEDED',
        ...(isSingleTenant ? { tenantId } : {})
      }
    });
    
    let revenueGross = 0;
    let gatewayFees = 0;

    for (const group of paymentGroups) {
      const amount = Number(group._sum.amount || 0);
      revenueGross += amount;
      
      if (group.gateway === 'yookassa') {
        gatewayFees += amount * 0.035; // ЮKassa берет ~3.5%
      } else if (group.gateway === 'cryptobot') {
        gatewayFees += amount * 0.01; // CryptoBot берет ~1%
      }
    }
    
    gatewayFees = Math.round(gatewayFees);

    // 2. Calculate Refunds (For canceled/partial orders)
    const refundedOrders = await db.order.findMany({
      where: {
        ...dateFilter,
        status: { in: ['PARTIAL', 'CANCELED'] },
        ...(isSingleTenant ? { tenantId } : {})
      }
    });

    let refunds = 0;
    for (const order of refundedOrders) {
      if (order.quantity > 0 && order.remains > 0) {
        const { calculatePartialRefund } = await import('@/utils/refund');
        refunds += calculatePartialRefund(order);
      } else if (order.status === 'CANCELED') {
        refunds += Number(order.charge);
      }
    }

    // 3. Calculate COGS (Provider Costs for confirmed part)
    let cogs: number;
    if (startDate && endDate) {
      const cogsResult = isSingleTenant
        ? await db.$queryRaw<[{ total: bigint | null }]>`
            SELECT SUM(
              CASE
                WHEN "quantity" > 0
                THEN ROUND(CAST("quantity" - "remains" AS NUMERIC) / "quantity" * "providerCost")
                ELSE 0
              END
            ) as total
            FROM "Order"
            WHERE status NOT IN ('AWAITING_PAYMENT', 'PENDING', 'ERROR')
              AND "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
              AND "tenantId" = ${tenantId}
          `
        : await db.$queryRaw<[{ total: bigint | null }]>`
            SELECT SUM(
              CASE
                WHEN "quantity" > 0
                THEN ROUND(CAST("quantity" - "remains" AS NUMERIC) / "quantity" * "providerCost")
                ELSE 0
              END
            ) as total
            FROM "Order"
            WHERE status NOT IN ('AWAITING_PAYMENT', 'PENDING', 'ERROR')
              AND "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
          `;
      cogs = Number(cogsResult[0]?.total ?? 0);
    } else {
      const cogsResult = isSingleTenant
        ? await db.$queryRaw<[{ total: bigint | null }]>`
            SELECT SUM(
              CASE
                WHEN "quantity" > 0
                THEN ROUND(CAST("quantity" - "remains" AS NUMERIC) / "quantity" * "providerCost")
                ELSE 0
              END
            ) as total
            FROM "Order"
            WHERE status NOT IN ('AWAITING_PAYMENT', 'PENDING', 'ERROR')
              AND "tenantId" = ${tenantId}
          `
        : await db.$queryRaw<[{ total: bigint | null }]>`
            SELECT SUM(
              CASE
                WHEN "quantity" > 0
                THEN ROUND(CAST("quantity" - "remains" AS NUMERIC) / "quantity" * "providerCost")
                ELSE 0
              END
            ) as total
            FROM "Order"
            WHERE status NOT IN ('AWAITING_PAYMENT', 'PENDING', 'ERROR')
          `;
      cogs = Number(cogsResult[0]?.total ?? 0);
    }

    const revenueNet = revenueGross - refunds - gatewayFees;
    const marginGross = revenueNet - cogs;

    // 4. Calculate Taxes and OPEX
    const activeSettingsId = isSingleTenant ? tenantId : 'smmplan';
    const settings = await db.systemSettings.findUnique({ where: { id: activeSettingsId } });
    const baseTaxRate = settings?.taxRate ?? 6.0;
    const opex = settings?.opexMonthly || 0.0;
    const usnScheme = settings?.usnScheme ?? 'INCOME_EXPENSES';

    // Calculate dynamic tax rate based on annual revenue of current calendar year
    const currentYear = new Date().getFullYear();
    const annualRevenue = await db.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'SUCCEEDED',
        ...(isSingleTenant ? { tenantId } : {}),
        createdAt: {
          gte: new Date(currentYear, 0, 1),
          lte: new Date(currentYear, 11, 31, 23, 59, 59, 999)
        }
      }
    }).then(res => Number(res._sum.amount || 0));

    // Threshold is 20 million rubles (2,000,000,000 cents)
    const isVatThresholdExceeded = annualRevenue >= 2000000000;
    
    // If threshold is exceeded, add special 5% VAT rate to base tax rate
    const effectiveTaxRate = isVatThresholdExceeded ? baseTaxRate + 5.0 : baseTaxRate;

    const taxes = usnScheme === 'INCOME'
      ? Math.round((revenueGross > 0 ? revenueGross : 0) * (effectiveTaxRate / 100))
      : Math.round((marginGross > 0 ? marginGross : 0) * (effectiveTaxRate / 100));
    const profitNet = marginGross - taxes - opex;
    const marginPercentage = revenueNet > 0 ? (marginGross / revenueNet) * 100 : 0;

    return {
      revenueGross,
      refunds,
      gatewayFees,
      revenueNet,
      cogs,
      marginGross,
      taxes,
      opex,
      profitNet,
      marginPercentage,
      annualRevenue,
      effectiveTaxRate,
      isVatThresholdExceeded,
      usnScheme
    };
  }

  async getSettings(tenantId?: string) {
    const activeSettingsId = tenantId && tenantId !== 'all' ? tenantId : 'smmplan';
    let settings = await db.systemSettings.findUnique({ where: { id: activeSettingsId } });
    if (!settings) {
      settings = await db.systemSettings.create({
        data: { id: activeSettingsId, taxRate: 6.0, opexMonthly: 0.0, usnScheme: 'INCOME_EXPENSES' }
      });
    }
    return settings;
  }

  async updateSettings(taxRate: number, opexMonthly: number, usnScheme?: UsnScheme, tenantId?: string) {
    const activeSettingsId = tenantId && tenantId !== 'all' ? tenantId : 'smmplan';
    return db.systemSettings.upsert({
      where: { id: activeSettingsId },
      update: { taxRate, opexMonthly, ...(usnScheme ? { usnScheme } : {}) },
      create: { id: activeSettingsId, taxRate, opexMonthly, usnScheme: usnScheme || 'INCOME_EXPENSES' }
    });
  }

  async getGatewayBreakdown(startDate?: Date, endDate?: Date, tenantId?: string) {
    const isSingleTenant = tenantId && tenantId !== 'all';
    const where: Prisma.PaymentWhereInput = {};
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }
    if (isSingleTenant) {
      where.tenantId = tenantId;
    }

    const [allPayments, succeededPayments] = await Promise.all([
      db.payment.groupBy({
        by: ['gateway'],
        _count: true,
        where,
      }),
      db.payment.groupBy({
        by: ['gateway'],
        _sum: { amount: true },
        _count: true,
        where: {
          ...where,
          status: 'SUCCEEDED',
        },
      }),
    ]);

    const totalRevenueKopecks = succeededPayments.reduce((acc, p) => acc + BigInt(p._sum.amount || 0), BigInt(0));

    const totalMap = new Map<string, number>();
    for (const ap of allPayments) {
      totalMap.set(ap.gateway, ap._count);
    }

    return succeededPayments.map(sp => {
      const g = sp.gateway;
      const amountKopecks = BigInt(sp._sum.amount || 0);
      const totalCount = totalMap.get(g) || sp._count;
      const successCount = sp._count;
      const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
      
      let feePct = 3.5;
      let label: string;
      let icon: string;
      if (g.toLowerCase().includes('sbp') || g.toLowerCase().includes('qr')) {
        feePct = 0.7;
        label = 'СБП (QR / Пэй)';
        icon = '⚡';
      } else if (g.toLowerCase().includes('crypto')) {
        feePct = 1.0;
        label = 'CryptoCloud';
        icon = '₿';
      } else if (g.toLowerCase().includes('robo')) {
        feePct = 3.9;
        label = 'Robokassa';
        icon = '🛡️';
      } else if (g.toLowerCase().includes('yoo')) {
        feePct = 3.5;
        label = 'ЮKassa (Карты/Банки)';
        icon = '💳';
      } else {
        label = g.toUpperCase();
        icon = '🌐';
      }

      const feeKopecks = (amountKopecks * BigInt(Math.round(feePct * 10))) / BigInt(1000);
      const sharePct = totalRevenueKopecks > BigInt(0)
        ? Math.round(Number((amountKopecks * BigInt(100)) / totalRevenueKopecks))
        : 0;

      return {
        gateway: g,
        label,
        icon,
        amountKopecks,
        feeKopecks,
        feePct,
        successCount,
        totalCount,
        successRate,
        sharePct,
      };
    }).sort((a, b) => Number(b.amountKopecks - a.amountKopecks));
  }
}

export const accountingService = new AccountingService();

```

