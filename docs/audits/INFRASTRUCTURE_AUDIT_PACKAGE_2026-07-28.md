# ИНФРАСТРУКТУРНЫЙ АУДИТОРСКИЙ ПАКЕТ (INFRASTRUCTURE_AUDIT_PACKAGE_2026-07-28.md)

**Дата создания:** 28 июля 2026  
**Проект:** SMMplan Lite / Multi-Tenant Infrastructure Audit  
**Содержимое:** Полные исходные файлы конфигурации Nginx, Next.js, Prisma Schema и Package.json  

---

## 1. Сводный анализ инфраструктурных аспектов

### А. Анализ безопасности Nginx и `getClientIp` (Замечание C-2)
В конфигурации `nginx/default.conf` во всех роутах (`/api/webhooks/`, `/api/v2`, `/api/auth/`, `/api/support/chat/stream`, `/`, `/api/`) явно установлены следующие директивы:
```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
```
**Вывод:** Nginx принудительно перезаписывает заголовок `X-Forwarded-For` реальным IP-адресом сокета (`$remote_addr`). Подмена заголовка `X-Forwarded-For` извне невозможна, так как любые внешние заголовки сбрасываются Nginx перед проксированием в приложение.

---

### Б. Анализ защиты от гонок в балансе кошелька (Замечание M-1)
В `prisma/schema.prisma` для модели `LedgerEntry` установлена составная уникальная инвариантность:
```prisma
model LedgerEntry {
  id              String   @id @default(cuid())
  userId          String
  ...
  idempotencyKey  String?
  transactionType String   @default("PAYMENT")
  ...

  @@unique([idempotencyKey, transactionType])
}
```
**Вывод:** В базе данных PostgreSQL уже действует суровый индекс `@@unique([idempotencyKey, transactionType])`. Повторная попытка проведения финансовой транзакции с тем же `idempotencyKey` сбросится на уровне СУБД с ошибкой уникального ключа, что блокирует параллельные race-condition атаки.

---

## 2. Исходные файлы конфигурации

### 📄 `next.config.mjs`

```javascript
/** @type {import('next').NextConfig} */
console.log("=== NEXT BUILD ENV ===", { 
  NODE_ENV: process.env.NODE_ENV, 
  APP_ENV: process.env.APP_ENV, 
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV, 
  DATABASE_URL: process.env.DATABASE_URL 
});

const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@blocknote/core", "@blocknote/react", "@blocknote/server-util", "bullmq", "ioredis", "sanitize-html"],

  typescript: { ignoreBuildErrors: true },

  transpilePackages: ["@base-ui/react"],

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: ['smmplan.pro', 'www.smmplan.pro', 'localhost:3000', '127.0.0.1:3000'],
    },
  },
  allowedDevOrigins: ["public-walls-play.loca.lt", "*.loca.lt", "127.0.0.1:3001", "localhost:3001", "127.0.0.1", "localhost"],
  
  // OSAD-V2: Distributed Cache Sync for Redis (Resolves C4.1)
  cacheHandler: (process.env.NODE_ENV === 'production' && !process.env.DISABLE_REDIS_CACHE) ? process.cwd() + '/cache-handler.js' : undefined,

  // User-uploaded files use raw buffer response via /api/media/ (never _next/image), keeping static image optimization intact.
  images: {
    unoptimized: false,
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';",
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

```

### 📄 `package.json`

```json
{
  "name": "smmplan",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:debt": "npx knip",
    "typecheck": "tsc --noEmit",
    "postinstall": "prisma generate",
    "test": "dotenv -e .env.test -- vitest run",
    "test:ci": "dotenv -e .env.test -- vitest run --coverage",
    "test:watch": "dotenv -e .env.test -- vitest",
    "test:db": "dotenv -e .env.test -- prisma db push --accept-data-loss",
    "test:tenant": "tsx scripts/test-tenant-resolution.ts",
    "test:e2e": "playwright test",
    "test:e2e:update": "playwright test --update-snapshots",
    "visual-qa": "dotenv -e .env -- tsx scripts/visual-qa.js",
    "visual-qa:compare": "dotenv -e .env -- tsx scripts/visual-qa.js --compare",
    "test:visual": "dotenv -e .env.test -- playwright test e2e/visual-regression.spec.ts",
    "bot": "tsx src/bot/index.ts",
    "bot:dev": "dotenv -e .env -- tsx watch src/bot/index.ts",
    "worker": "tsx src/workers/index.ts",
    "audit:visual": "npx dotenv -e .env tsx scripts/synthetic-ux-lab/visual-audit-cli.ts",
    "db:seed-mock": "tsx prisma/seed-mock.ts",
    "seed:legal": "tsx scripts/seed-legal-cms.ts",
    "seed:graphrag": "dotenv -e .env -- tsx scripts/seed-graphrag-stack.ts",
    "check-balances": "dotenv -e .env -- tsx src/utils/balance-verifier.ts",
    "pixelrag:admin": "dotenv -e .env -- tsx scripts/pixelrag-admin-audit.ts && dotenv -e .env -- tsx scripts/pixelrag-admin-analyze.ts",
    "harness:baseline": "tsx .antigravity/scripts/baseline.ts",
    "harness:validate": "tsx .antigravity/scripts/evidence-validator.ts",
    "harness:scan": "tsx .antigravity/scripts/run-scanners.ts",
    "harness:reconcile": "tsx .antigravity/scripts/reconciliation.ts",
    "harness:test": "tsx .antigravity/scripts/test-runner.ts",
    "harness:evals": "tsx .antigravity/scripts/run-evals.ts",
    "harness:selftest": "vitest run .antigravity/tests/",
    "harness:all": "npm run harness:baseline && npm run harness:scan && npm run harness:reconcile && npm run harness:test && npm run harness:evals",
    "harness:leftshift": "tsx .antigravity/scripts/leftshift/merge-gate.ts",
    "harness:leftshift:rules": "tsx .antigravity/scripts/leftshift/run-rules.ts",
    "harness:leftshift:testgate": "tsx .antigravity/scripts/leftshift/test-gate.ts",
    "harness:leftshift:invariants": "tsx .antigravity/scripts/leftshift/invariant-gate.ts"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@base-ui/react": "^1.4.0",
    "@blocknote/core": "^0.51.0",
    "@blocknote/mantine": "^0.51.0",
    "@blocknote/react": "^0.51.0",
    "@blocknote/server-util": "^0.51.0",
    "@heroui/react": "^3.0.3",
    "@heroui/system": "^2.4.28",
    "@mantine/core": "^9.2.1",
    "@mantine/hooks": "^9.2.1",
    "@prisma/client": "^5.20.0",
    "@radix-ui/react-slot": "^1.2.4",
    "@tanstack/react-table": "^8.21.3",
    "@tanstack/react-virtual": "^3.13.24",
    "bullmq": "^5.76.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "dotenv": "^17.4.2",
    "framer-motion": "^12.38.0",
    "html-react-parser": "^6.1.1",
    "ioredis": "^5.10.1",
    "jose": "^5.9.6",
    "lucide-react": "^0.447.0",
    "next": "^16.2.6",
    "next-themes": "^0.4.6",
    "nodemailer": "^9.0.1",
    "pino": "^10.3.1",
    "prisma": "^5.20.0",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "react-icons": "^5.6.0",
    "recharts": "^3.8.1",
    "resend": "^6.12.3",
    "sanitize-html": "^2.17.4",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "telegraf": "^4.16.3",
    "undici": "^7.28.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.60.0",
    "@tailwindcss/postcss": "^4.2.2",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^20.19.41",
    "@types/node-fetch": "^2.6.13",
    "@types/nodemailer": "^6.4.15",
    "@types/pngjs": "^6.0.5",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/sanitize-html": "^2.16.1",
    "@vitejs/plugin-react": "^6.0.1",
    "@vitest/coverage-v8": "^4.1.4",
    "decimal.js": "^10.6.0",
    "dotenv-cli": "^11.0.0",
    "eslint": "^10.2.0",
    "fast-check": "^4.8.0",
    "jsdom": "^29.0.2",
    "knip": "^6.13.1",
    "node-fetch": "^2.7.0",
    "pixelmatch": "^7.2.0",
    "playwright": "^1.60.0",
    "pngjs": "^7.0.0",
    "postcss": "^8.5.10",
    "tailwindcss": "^4.2.2",
    "tsx": "^4.21.0",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.58.2",
    "vitest": "^4.1.4"
  },
  "overrides": {
    "postcss": "^8.5.10",
    "nodemailer": "^9.0.1",
    "undici": "^7.28.0",
    "form-data": "^4.0.6",
    "ws": "^8.21.0",
    "markdown-it": "^14.2.0",
    "vite": "^8.1.0",
    "esbuild": "^0.28.1",
    "brace-expansion": "^5.0.6",
    "sharp": "^0.33.5"
  }
}

```

### 📄 `prisma/schema.prisma`

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

  // API & Accounting Fields
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

  apiConfig ApiConfig?
  userNotes     UserNote[] @relation("UserNotes")
  authoredNotes UserNote[] @relation("AuthorNotes")

  targetBalanceAdjustments    ManualBalanceAdjustment[] @relation("targetBalanceAdjustments")
  requestedBalanceAdjustments ManualBalanceAdjustment[] @relation("requestedBalanceAdjustments")
  approvedBalanceAdjustments  ManualBalanceAdjustment[] @relation("approvedBalanceAdjustments")
  rejectedBalanceAdjustments  ManualBalanceAdjustment[] @relation("rejectedBalanceAdjustments")

  employeeConsents           EmployeeResponsibilityConsent[]
  staffFinancialActions      SupportFinancialAction[]        @relation("staffFinancialActions")
  targetFinancialActions     SupportFinancialAction[]        @relation("targetFinancialActions")

  tenantId String @default("smmplan")

  @@unique([email, tenantId])
  @@index([tenantId])
}

model ApiConfig {
  id               String  @id @default(cuid())
  userId           String  @unique
  user             User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  isApiEnabled            Boolean @default(true)
  prioritySupport  Boolean @default(true) // Выделение и приоритетная поддержка
  webhookUrl       String? // Webhook URL для синхронизации тикетов
  webhookSecret    String? // Секретный ключ подписи вебхуков API
  isWebhookActive  Boolean @default(false) // Toggle for webhook status
  customLimitCents Int? // Кастомный лимит компенсаций (если null — лимит не применяется!)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
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

model Network {
  id          String       @id @default(cuid())
  name        String       @unique // "Telegram"
  slug        String       @unique // "telegram"
  icon        String? // SVG content or name
  sort        Int          @default(0)
  isActive    Boolean      @default(true)
  tenantId    String       @default("smmplan")
  categories  Category[]
  urlPatterns UrlPattern[] // Link detection patterns
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([tenantId])
}

// URL patterns for link detection (two-level: network + content type)
model UrlPattern {
  id          String   @id @default(cuid())
  networkId   String
  network     Network  @relation(fields: [networkId], references: [id], onDelete: Cascade)
  pattern     String // Regex: e.g. "instagram\\.com\\/p\\/[^/]+"
  contentType String // "profile" | "post" | "reel" | "story" | "video" | "channel" | "channel_post"
  sort        Int      @default(0)
  createdAt   DateTime @default(now())

  @@index([networkId])
}

model Category {
  id             String    @id @default(cuid())
  name           String
  slug           String    @unique @default(cuid())
  networkId      String?
  network        Network?  @relation(fields: [networkId], references: [id], onDelete: Restrict)
  tenantId       String    @default("smmplan")
  sort           Int       @default(0)
  requireWarning Boolean   @default(false)
  warningMessage String?
  analyzerTags   String?   // Comma-separated list of Link Analyzer types (e.g. "private_post,channel")
  services       Service[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([networkId])
  @@index([tenantId])
}

model Service {
  id               String    @id @default(cuid())
  numericId        Int       @unique @default(autoincrement())
  name             String
  description      String? // Public SEO description (shown to clients)
  features         Json? // Structured metadata extracted by AI (geo, speed, warranty)
  categoryId       String
  category         Category  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  tenantId         String    @default("smmplan")
  providerId       String? // Link to Provider who fulfills this service
  provider         Provider? @relation(fields: [providerId], references: [id], onDelete: SetNull)
  rate             Float // provider rate per 1000
  providerCurrency String    @default("USD") // Dual-Ledger: tracks original currency of rate
  markup           Float     @default(3.0) // 300% markup
  anomalyScore     Int       @default(0) // Data Intelligence: 0-100 score for suspicious provider claims
  minQty           Int       @default(10)
  maxQty           Int       @default(100000)
  externalId       String? // mapped ID to provider
  dataHash         String? // MD5 for diff-sync
  lastSeenAt       DateTime? // Last time provider confirmed this service exists

  // API v2 feature flags
  isDripFeedEnabled Boolean @default(true)
  isRefillEnabled   Boolean @default(false)
  isCancelEnabled   Boolean @default(false)

  // Quarantine: price spike isolation & Elastic Quarantine
  // When rate changes > quarantineThreshold% → service goes QUARANTINE status
  isQuarantined    Boolean   @default(false)
  pendingRate      Float? // Proposed new rate awaiting admin approval
  quarantineReason String? // Human-readable reason: "Price spike: +45%"
  quarantinedAt    DateTime? // When it was flagged

  // Wave 4.1: Elastic Quarantine (Self-Healing)
  cooldownUntil  DateTime? // If set, service is temporarily unavailable until this time
  cooldownReason String? // Reason for cooldown (e.g., "API_ERROR", "DELAYED_CANCEL")

  // ETA Estimation (Adaptive Percentile Window — cron-updated every 15 min)
  etaP50Seconds  Int? // Median execution time in seconds
  etaP90Seconds  Int? // 90th percentile ("worst case")
  etaSampleCount Int       @default(0) // Number of completed orders behind the estimate
  etaSpeedClass  String? // FAST | MEDIUM | SLOW | ULTRA_SLOW
  etaUpdatedAt   DateTime? // Last ETA recalculation timestamp

  // Link Target & Format Validation (Wave 2)
  targetType        String  @default("POST") // POST, PROFILE, CHANNEL, COMMENT, POLL, VK_WALL, etc.
  customDataType    String  @default("NONE") // NONE, TEXTAREA, NUMBER
  customDataLabel   String? // Optional custom text prompt for the input field
  isMediaGroupAware Boolean @default(false) // If false, backend splits "123-125" into separate orders

  requireWarning     Boolean  @default(false)
  warningMessage     String?
  clientRequirement  String?  // Legal/Marketing requirement for the service (e.g. "Profile must be public")
  clientConfirmation String?  // JIT confirmation toggle text (e.g. "My profile is public")
  isActive           Boolean  @default(true)
  pricePer1000Cents  Int      @default(0) // Denormalized price for sorting (rate * markup * exchangeRate)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  orders         Order[]
  routes         ServiceRoute[]
  smartCampaigns SmartCampaign[]
  smartConfig    ServiceSmartConfig?
  priceHistory   ServicePriceHistory[]

  @@index([categoryId])
  @@index([providerId])
  @@index([isQuarantined])
  @@index([externalId])
  @@index([tenantId])
}

model Provider {
  id              String   @id @default(cuid())
  name            String   @unique
  apiUrl          String
  apiKey          String // Encrypted API key
  isActive        Boolean  @default(true)
  metadata        Json? // { httpMethod, requestType, headers, keyField, actionField }
  providerType    String   @default("SMM_PANEL") // SMM_PANEL, SMS_ACTIVATE
  syncLock        Boolean  @default(false)
  balanceCurrency String   @default("USD")
  ticketUrl       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // SLA Monitoring fields (P0.3)
  errorCount5m  Int       @default(0) // Errors in last 5 minutes (reset by sync)
  lastErrorAt   DateTime? // Last error timestamp
  lastSuccessAt DateTime? // Last successful API response
  avgResponseMs Int       @default(0) // Rolling average response time in ms

  services        Service[]
  Order           Order[]
  ServiceRoute    ServiceRoute[]
  smartExecutions SmartExecution[]
  shadowServices  ShadowService[]
}

model ShadowService {
  id                String   @id @default(cuid())
  providerId        String
  provider          Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  externalId        String
  name              String
  type              String?
  category          String?
  rate              Float
  rateRub           Float
  min               Int
  max               Int
  refill            Boolean  @default(false)
  cancel            Boolean  @default(false)
  dripfeed          Boolean  @default(false)

  // AI normalisation metrics
  cleanName         String?
  platform          String?
  normalizedCategory String?
  targetType        String   @default("POST")
  customDataType    String   @default("NONE")
  isMediaGroupAware Boolean  @default(false)
  isPrivate         Boolean  @default(false)
  warranty          Int      @default(0)
  geo               String?
  velocity          Int      @default(0)
  anomalyScore      Float    @default(0.0)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([providerId, externalId])
  @@index([providerId])
  @@index([platform])
  @@index([normalizedCategory])
  @@index([rateRub])
}

model Order {
  id                String      @id @default(cuid())
  numericId         Int         @unique @default(autoincrement())
  userId            String
  serviceId         String
  providerId        String? // Snapshots the provider used AT THE TIME of checkout
  provider          Provider?   @relation(fields: [providerId], references: [id], onDelete: SetNull)
  providerServiceId String? // Snapshots the provider's external service ID AT THE TIME of checkout
  externalId        String? // ID from provider (like VexBoost)
  dripExternalIds   String[]    @default([]) // History of run IDs for Drip-Feed
  link              String
  isLinkOverridden  Boolean     @default(false)
  quantity          Int
  status            OrderStatus @default(AWAITING_PAYMENT)
  remains           Int         @default(0) // Outstanding amount to deliver
  charge            BigInt // price paid by user in Cents
  providerCost      BigInt // exact cost from provider in Cents
  error             String? // Error message from provider API
  actualProviderCost BigInt?
  realMarginDelta    BigInt?
  retryCount        Int         @default(0) // Safe API Backoff mechanism
  isTest            Boolean     @default(false) // Isolation flag for mock environment
  email             String? // Contact email for guest / notification
  customData        String? // Additional payload (comments, answer #, keywords)
  usdToRubRate      Float?  // Historical CBR exchange rate at checkout time to prevent margin drift


  // Drip-Feed specifics
  isDripFeed Boolean   @default(false)
  runs       Int?
  interval   Int? // Minutes between runs
  currentRun Int       @default(0)
  nextRunAt  DateTime?

  // Lifecycle Wait specifics
  waitingUntil DateTime?

  discountCents BigInt  @default(0)
  promoCodeId   String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user           User            @relation(fields: [userId], references: [id], onDelete: Restrict)
  service        Service         @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  paymentId      String?
  payment        Payment?        @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  promoCode      PromoCode?      @relation(fields: [promoCodeId], references: [id], onDelete: SetNull)
  promoCodeUsage PromoCodeUsage?
  refills        Refill[]
  tickets        Ticket[]
  ticketMessages TicketMessage[]
  smartCampaign  SmartCampaign?

  idempotencyKey String? @unique // Wave 1: Token to prevent double order creation

  abVariant      String? // A/B test variant tag: A, B, C
  tenantId       String  @default("smmplan")

  @@index([userId])
  @@index([tenantId])
  @@index([tenantId, userId])
  @@index([tenantId, status, createdAt])
  @@index([serviceId]) // Fast lookup for orders by service
  @@index([status])
  @@index([createdAt]) // P2.2: temporal queries & analytics
  @@index([status, createdAt]) // P2.2: filtered + sorted admin queries
  @@index([userId, status]) // Fast lookup for user orders by status
  @@index([paymentId]) // Fast lookup for orders by payment (Order.paymentId foreign key)
  userNotes UserNote[]
}

model Refill {
  id         String  @id @default(cuid())
  numericId  Int     @unique @default(autoincrement())
  orderId    String
  order      Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  status     String  @default("PENDING") // PENDING, IN_PROGRESS, COMPLETED, REJECTED, ERROR
  externalId String? // Refill ID from the provider

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orderId])
  @@index([status])
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
}

// ── API Accounting ──
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

enum UsnScheme {
  INCOME
  INCOME_EXPENSES
}

model Tenant {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  domain       String   @unique
  customDomain String?  @unique
  isActive     Boolean  @default(true)
  vaultSalt    String   @default("") // TODO: Implement per-tenant HKDF key derivation (P2)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  systemSettings SystemSettings?
}

model SystemSettings {
  id              String    @id
  tenant          Tenant    @relation(fields: [id], references: [id], onDelete: Cascade)
  isTestMode      Boolean   @default(false)
  taxRate         Float     @default(6.0) // % tax rate
  usnScheme       UsnScheme @default(INCOME_EXPENSES)
  opexMonthly     Int       @default(0) // Fixed operational expenses sum in Cents
  maintenanceMode Boolean   @default(false)
  siteName        String    @default("Smmplan")
  siteDescription String    @default("")

  // Telegram Bot Settings
  welcomeMessage String? @default("Добро пожаловать в Smmplan! Ваш персональный кабинет готов к работе.")

  // Payment Gateways (Secrets are AES-256-GCM encrypted in DB)
  // Production keys
  yookassaShopId        String?
  yookassaSecretKey     String?
  // Test keys (used when isTestMode = true)
  yookassaTestShopId    String?
  yookassaTestSecretKey String?
  cryptoBotToken        String?

  // Catalog settings
  quarantineThreshold   Float     @default(0.20) // 20% price spike triggers quarantine
  globalMarkup          Float     @default(3.0) // Default markup multiplier for new services
  safetyFloor           Float     @default(1.0) // Min markup (100% = sell at cost)
  exchangeRateUSD       Float     @default(90.0) // USD to RUB rate (auto-synced from CBR)
  exchangeRateUpdatedAt DateTime? // Last CBR sync time

  // Site branding
  siteLogoUrl    String? // URL to uploaded logo
  siteFaviconUrl String? // URL to uploaded favicon

  // SMTP Settings (Email Integration)
  emailProvider             String  @default("SMTP")
  resendApiKey              String?
  smtpHost                  String?
  smtpPort                  Int     @default(465)
  smtpUser                  String?
  smtpPassword              String? // AES-256-GCM encrypted
  supportEmailDomain        String? // e.g. "smmplan.pro" used for inbound webhook
  inboundEmailWebhookSecret String? // Secret for validating incoming webhook payloads

  // Robokassa (encrypted)
  robokassaLogin    String?
  robokassaPassword String?
  robokassaWebhookPassword String?

  updatedAt DateTime @updatedAt

  // Contact & Social Information
  contactSupportEmail    String?
  contactPrivacyEmail    String?
  contactTelegramBot     String?
  contactTelegramChannel String?
  contactWhatsApp        String?
  contactVk              String?

  // Legal Information
  legalCompanyName    String?
  legalCompanyInn     String?
  legalCompanyOgrnip  String?
  legalCompanyAddress String?
}

enum TicketStatus {
  OPEN
  PENDING
  CLOSED
}

enum TicketSource {
  WEB
  TELEGRAM
  EMAIL
}

enum MessageSender {
  USER
  STAFF
  INTERNAL
}

model Ticket {
  id      String       @id @default(cuid())
  userId  String
  user    User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  subject String
  status  TicketStatus @default(OPEN)
  source  TicketSource @default(WEB)

  // Optional: Link ticket to a specific order for context (live chat)
  orderId String?
  order   Order?  @relation(fields: [orderId], references: [id], onDelete: SetNull)

  paymentId String?
  payment   Payment? @relation(fields: [paymentId], references: [id], onDelete: SetNull)

  firstRespondedAt DateTime? // SLA: First Response Time (FRT)
  resolvedAt       DateTime? // SLA: Time to Resolution (TTR)
  tags             String[]  @default([]) // NLP Tagging

  messages TicketMessage[]
  userNotes UserNote[]

  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  tenantId String @default("smmplan")

  @@index([userId])
  @@index([tenantId])
  @@index([tenantId, userId])
  @@index([tenantId, status, createdAt])
  @@index([source])
  @@index([orderId])
  @@index([paymentId])
  @@index([status])
  @@index([status, createdAt])
}

model TicketMessage {
  id        String        @id @default(cuid())
  ticketId  String
  ticket    Ticket        @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  sender    MessageSender
  text      String
  mediaUrl  String? // @deprecated - relative path to uploaded file (legacy)
  mediaType String? // @deprecated - "image", "audio", "video" (legacy)

  replyToId String?
  replyTo   TicketMessage?  @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)
  replies   TicketMessage[] @relation("MessageReplies")

  telegramMsgId String?
  isDeleted     Boolean @default(false)
  isEdited      Boolean @default(false)
  originalText  String?

  attachments MessageAttachment[]

  orderId String?
  order   Order?  @relation(fields: [orderId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())

  @@index([ticketId])
  @@index([telegramMsgId])
  @@index([ticketId, createdAt])
  @@index([orderId])
}

model MessageAttachment {
  id        String        @id @default(cuid())
  messageId String
  message   TicketMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  url      String // relative path to uploaded file (slugified)
  type     String // "image" | "audio" | "video" | "document"
  mimeType String // exact MIME type
  name     String // original file name
  size     Int? // file size in bytes

  createdAt DateTime @default(now())

  @@index([messageId])
}

model Page {
  id      String @id @default(cuid())
  slug    String @unique
  title   String
  content String

  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  action    String
  details   String
  createdAt DateTime @default(now())

  @@index([userId])
}

model Commission {
  id         String @id @default(cuid())
  orderId    String
  referrerId String
  amount     BigInt // in Cents (BigInt for consistency with financial fields)
  status     String @default("PENDING") // PENDING, PAID, REJECTED

  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  referrer User @relation("ReferredCommissions", fields: [referrerId], references: [id], onDelete: Cascade)

  @@unique([orderId, referrerId])
  @@index([referrerId])
}

// Security: Rate Limit
model RateLimit {
  id        String   @id @default(cuid())
  ip        String
  endpoint  String
  hits      Int      @default(1)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@unique([ip, endpoint])
  @@index([expiresAt])
}

// ── Admin Panel: Audit & Finance ──

model AdminAuditLog {
  id         String   @id @default(cuid())
  adminId    String // Who performed the action
  adminEmail String // Denormalized for fast log reading
  action     String // USER_BALANCE_CHANGE, SERVICE_DISABLE, SETTINGS_UPDATE, etc.
  target     String // ID of affected entity
  targetType String // USER, SERVICE, ORDER, SETTINGS, PROVIDER
  oldValue   String? // JSON string of previous state
  newValue   String? // JSON string of new state
  ipAddress  String? // Admin IP for security investigations
  createdAt  DateTime @default(now())

  @@index([adminId])
  @@index([createdAt])
  @@index([targetType])
}

model LedgerEntry {
  id              String   @id @default(cuid())
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
}

model SupportTemplate {
  id        String   @id @default(cuid())
  shortcut  String?  @unique // unique keyboard command e.g. "delay", "refund"
  label     String
  text      String
  category  String   @default("GENERAL")
  isActive  Boolean  @default(true)
  useCount  Int      @default(0)
  sort      Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category])
}

// Telemetry
model AnalyticsEvent {
  id        String   @id @default(cuid())
  event     String
  metadata  Json?
  sessionId String?
  createdAt DateTime @default(now())

  @@index([event]) // P2.2: filter by event type
  @@index([createdAt]) // P2.2: TTL cleanup & temporal queries
}

// ── Feature Flags ──
// Predefined list. State: ON (all users) | TEST (test accounts only) | OFF
model FeatureFlag {
  id          String   @id @default(cuid())
  key         String   @unique // e.g. "drip_feed", "referral_program"
  label       String // Human-readable: "Drip-Feed"
  description String   @default("")
  state       String   @default("OFF") // ON | TEST | OFF
  updatedBy   String? // Admin email who last changed
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  @@index([key])
}

// ── Flexible RBAC ──
// Custom roles with granular permissions per sidebar section
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

// One permission entry per section per role: section + action (view|edit)
model StaffPermission {
  id      String    @id @default(cuid())
  roleId  String
  role    StaffRole @relation(fields: [roleId], references: [id], onDelete: Cascade)
  section String // e.g. "orders", "finance", "catalog", "settings"
  canView Boolean   @default(false)
  canEdit Boolean   @default(false)

  @@unique([roleId, section])
  @@index([roleId])
}

// ── Security: Login Log ──
// Per OWASP A07: Authentication Failures monitoring
model LoginLog {
  id         String   @id @default(cuid())
  email      String // Attempted email
  userId     String? // Resolved userId if login succeeded
  ipAddress  String
  userAgent  String?
  success    Boolean
  failReason String? // "INVALID_PASSWORD" | "ACCOUNT_LOCKED" | "NOT_FOUND"
  createdAt  DateTime @default(now())

  @@index([email])
  @@index([ipAddress])
  @@index([createdAt])
}

model ServiceRoute {
  id        String  @id @default(cuid())
  serviceId String
  service   Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  providerId        String
  provider          Provider @relation(fields: [providerId], references: [id], onDelete: Restrict)
  providerServiceId String // The external ID for this provider (e.g., "102")

  isPrimary Boolean @default(false)
  isActive  Boolean @default(true)
  priority  Int     @default(0) // 0 = highest priority

  failoverMode String @default("manual") // "manual", "automatic", "weighted"

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([serviceId, providerId])
  @@index([serviceId])
  @@index([providerId])
}

model RoutingAuditLog {
  id             String   @id @default(cuid())
  serviceId      String
  adminId        String?
  action         String // "SWAP", "ADD_ROUTE", "QUARANTINE_REROUTE", "MANUAL_OVERRIDE"
  fromProviderId String?
  toProviderId   String?
  reason         String?
  createdAt      DateTime @default(now())
}

// Global System Settings (Key-Value Store)
model SystemSetting {
  key         String   @id // e.g. "SUPPORT_EMAIL", "COMPANY_INN"
  value       String // String value, can be stringified JSON if needed
  group       String   @default("GENERAL") // e.g. "CONTACTS", "LEGAL", "SEO"
  description String? // Admin-facing description
  updatedAt   DateTime @updatedAt
  updatedBy   String? // Admin email who last updated it
}

// ── Order Status Enum ──
enum OrderStatus {
  AWAITING_PAYMENT
  PENDING
  PENDING_CHECK
  PROVISIONING
  IN_PROGRESS
  COMPLETED
  PARTIAL
  CANCELED
  ERROR
  CANCELING
}

// ── Enterprise CMS ──

enum ContentType {
  PAGE
  ACADEMY_LESSON
  GLOSSARY_TERM
  NEWS_POST
}

model ContentCategory {
  id       String            @id @default(cuid())
  name     String
  slug     String            @unique
  parentId String?
  parent   ContentCategory?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  children ContentCategory[] @relation("CategoryTree")
  items    ContentItem[]

  sort      Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId])
}

model ContentItem {
  id         String      @id @default(cuid())
  type       ContentType @default(PAGE)
  slug       String      @unique
  title      String
  excerpt    String?
  coverImage String?

  // Dual Storage
  contentJson String? // Stored as stringified JSON block array
  contentHtml String? // Rendered HTML

  // Relations
  categoryId String?
  category   ContentCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  // Metadata & Stats
  authorName String?
  viewCount  Int     @default(0)

  // Publishing Workflow
  isPublished Boolean   @default(false)
  publishedAt DateTime?

  // SEO
  metaTitle       String?
  metaDescription String?
  readTimeMinutes Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([type])
  @@index([slug])
  @@index([categoryId])
}

model SecurityEvent {
  id        String   @id @default(cuid())
  event     String // SIGNATURE_FAILED | REPLAY_ATTEMPT | INVALID_FORMAT
  severity  String // WARNING | CRITICAL
  ip        String?
  details   Json?
  createdAt DateTime @default(now())

  @@index([event])
  @@index([createdAt])
}

enum SmartCampaignStatus {
  PLANNED
  RUNNING
  PAUSED
  COMPLETED
  ERROR
}

enum SmartTaskStatus {
  PLANNED
  SENT
  COMPLETED
  ERROR
}

model SmartCampaign {
  id            String              @id @default(cuid())
  userId        String
  user          User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  serviceId     String
  service       Service             @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  status        SmartCampaignStatus @default(PLANNED)
  link          String
  totalQuantity Int
  totalDays     Int
  isTestMode    Boolean             @default(false)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  tasks     SmartTask[]
  snapshots SmartSnapshot[]
  metrics   SmartChannelMetric[]

  paymentId String?
  payment   Payment? @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  orderId   String?  @unique
  order     Order?   @relation(fields: [orderId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([serviceId])
  @@index([paymentId])
}

model SmartTask {
  id         String          @id @default(cuid())
  campaignId String
  campaign   SmartCampaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  quantity   Int
  runAt      DateTime
  status     SmartTaskStatus @default(PLANNED)
  error      String?
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  executions SmartExecution[]

  @@index([campaignId])
  @@index([runAt, status])
}

model SmartExecution {
  id              String    @id @default(cuid())
  taskId          String
  task            SmartTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  providerId      String?
  provider        Provider? @relation(fields: [providerId], references: [id], onDelete: SetNull)
  externalOrderId String?
  qtySent         Int
  qtyDelivered    Int       @default(0)
  status          String    @default("PENDING")
  error           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([taskId])
}

model ServiceSmartConfig {
  id                String   @id @default(cuid())
  serviceId         String   @unique
  service           Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  isEnabled         Boolean  @default(false)
  isTestMode        Boolean  @default(false)
  minChunk          Int      @default(50)
  maxChunk          Int      @default(200)
  markup            Float    @default(0.15)
  providersPriority String[] @default([])

  // Smart Drip 2.5 extensions
  useInviteBuffer   Boolean @default(false)
  autoCompensate    Boolean @default(true)
  checkIntervalMins Int     @default(120)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model SmartChannelMetric {
  id             String        @id @default(cuid())
  campaignId     String
  campaign       SmartCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  recordedAt     DateTime      @default(now())
  memberCount    Int
  delta          Int
  detectedDrops  Int           @default(0)
  compensatedQty Int           @default(0)

  @@index([campaignId])
}

model SmartSnapshot {
  id         String        @id @default(cuid())
  campaignId String
  campaign   SmartCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  channelUrl String
  members    String[]
  createdAt  DateTime      @default(now())
}

model SmartDetectedUser {
  id         String   @id @default(cuid())
  campaignId String
  telegramId String
  score      Int      @default(0)
  reasons    String[]
  createdAt  DateTime @default(now())
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

enum ArticleStatus {
  DRAFT
  PUBLISHED
}

model Article {
  id          String        @id @default(cuid())
  slug        String        @unique
  title       String
  description String        @db.Text
  content     String        @db.Text
  status      ArticleStatus
  category    String
  viewCount   Int           @default(0)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  authorName  String        @default("Михаил")
  authorRole  String        @default("Системный архитектор прокси-сетей Smmplan")
  priority    Int           @default(0) // 0-100, used for Drip-Feed publish queue

  @@index([category, status])
  @@index([status])
}

model ServicePriceHistory {
  id        String   @id @default(cuid())
  serviceId String
  service   Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  rate      Float
  createdAt DateTime @default(now())

  @@index([serviceId])
  @@index([createdAt])
}

model UserNote {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation("UserNotes", fields: [userId], references: [id], onDelete: Cascade)
  authorId  String?
  author    User?    @relation("AuthorNotes", fields: [authorId], references: [id], onDelete: SetNull)
  content   String
  orderId   String?
  order     Order?   @relation(fields: [orderId], references: [id], onDelete: SetNull)
  ticketId  String?
  ticket    Ticket?  @relation(fields: [ticketId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([authorId])
  @@index([orderId])
  @@index([ticketId])
}

model BalanceAdjustmentPolicy {
  id String @id @default(cuid())

  scopeType String // GLOBAL | ROLE | USER

  staffRoleId String?
  userId      String?

  isActive Boolean @default(true)

  enabled Boolean @default(false)

  canRequestCredit Boolean @default(false)
  canRequestDebit  Boolean @default(false)

  canApprove Boolean @default(false)
  canReject  Boolean @default(false)

  canViewAll   Boolean @default(false)
  canViewStats Boolean @default(false)

  maxCreditPerRequest BigInt @default(0)
  maxDebitPerRequest  BigInt @default(0)

  maxCreditPerDay BigInt @default(0)
  maxDebitPerDay  BigInt @default(0)
  maxTotalPerDay  BigInt @default(0)

  maxApprovalPerRequest BigInt @default(0)

  allowedCreditReasonCodes Json
  allowedDebitReasonCodes  Json
  allowedTargetRoles       Json

  requireTicket        Boolean @default(true)
  requireOrderForDebit Boolean @default(false)

  blockBannedTargets  Boolean @default(true)
  blockDeletedTargets Boolean @default(true)

  autoExecuteBelow BigInt @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([scopeType, staffRoleId])
  @@index([scopeType, userId])
}

model ManualBalanceAdjustment {
  id String @id @default(cuid())

  userId      String
  requestedBy String

  direction String // CREDIT | DEBIT

  amount BigInt

  reasonCode String
  reasonNote String

  ticketId  String?
  orderId   String?
  paymentId String?

  status String @default("PENDING_APPROVAL")
  // PENDING_APPROVAL | APPROVED | REJECTED | EXECUTED | EXECUTION_FAILED | CANCELED

  idempotencyKey String @unique

  approvedBy      String?
  approvedAt      DateTime?

  rejectedBy      String?
  rejectedAt      DateTime?
  rejectionReason String?

  executionError String?

  ledgerEntryId String?

  policySnapshot Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User  @relation("targetBalanceAdjustments", fields: [userId], references: [id], onDelete: Cascade)
  requester User  @relation("requestedBalanceAdjustments", fields: [requestedBy], references: [id], onDelete: Cascade)
  approver  User? @relation("approvedBalanceAdjustments", fields: [approvedBy], references: [id], onDelete: SetNull)
  rejecter  User? @relation("rejectedBalanceAdjustments", fields: [rejectedBy], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([requestedBy, createdAt])
  @@index([status, createdAt])
  @@index([direction, status, createdAt])
  @@index([ticketId])
}

// ── Financial Policy & Audit Engine ──

model SupportLimitUsage {
  id              String   @id @default(cuid())
  tenantId        String?
  staffUserId     String
  dayKey          String   // YYYY-MM-DD in Europe/Moscow (MSK)
  direction       String   // CREDIT | DEBIT | ALL
  amountCents     BigInt   @default(0)
  operationsCount Int      @default(0)
  updatedAt       DateTime @updatedAt

  @@unique([staffUserId, dayKey, direction])
  @@index([staffUserId, dayKey])
  @@index([tenantId, dayKey])
}

model SupportHourlyUsage {
  id              String   @id @default(cuid())
  staffUserId     String
  hourKey         String   // YYYY-MM-DDTHH in Europe/Moscow (MSK)
  direction       String   // CREDIT | DEBIT | ALL
  amountCents     BigInt   @default(0)
  operationsCount Int      @default(0)
  updatedAt       DateTime @updatedAt

  @@unique([staffUserId, hourKey, direction])
  @@index([staffUserId, hourKey])
}

model EmployeeResponsibilityConsent {
  id                String   @id @default(cuid())
  userId            String
  documentVersion   String
  documentHash      String
  acceptedAt        DateTime @default(now())
  acceptedIp        String?
  acceptedUserAgent String?
  status            String   @default("ACTIVE") // ACTIVE | SUPERSEDED | REVOKED
  createdAt         DateTime @default(now())

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([documentVersion])
}

model SupportFinancialAction {
  id              String   @id @default(cuid())
  tenantId        String?
  staffUserId     String
  targetUserId    String
  direction       String   // CREDIT | DEBIT
  source          String   // SUPPORT_COMPENSATION | BALANCE_REQUEST | DIRECT_ADJUSTMENT | TICKET_REFUND | ORDER_REFUND
  amountCents     BigInt
  reasonCode      String
  reasonNote      String
  ticketId        String?
  orderId         String?
  paymentId       String?
  policyId        String?
  policySnapshot  Json?
  idempotencyKey  String   @unique
  status          String   // INITIATED | EXECUTED | REJECTED | QUARANTINE | FAILED | REVIEW_REQUIRED
  ledgerEntryId   String?
  consentId       String?
  reviewStatus    String   @default("PENDING") // PENDING | REVIEWED | FLAGGED | VIOLATION | APPROVED
  reviewedBy      String?
  reviewedAt      DateTime?
  reviewNote      String?
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  staff           User     @relation("staffFinancialActions", fields: [staffUserId], references: [id], onDelete: Cascade)
  target          User     @relation("targetFinancialActions", fields: [targetUserId], references: [id], onDelete: Cascade)

  @@index([staffUserId, createdAt])
  @@index([targetUserId, createdAt])
  @@index([ticketId])
  @@index([orderId])
  @@index([reviewStatus])
  @@index([status])
  @@index([tenantId, createdAt])
}


```

### 📄 `nginx/default.conf`

```nginx
# ── Rate Limiting Zones (P1.2) ───────────────────────────────────────────────
# Define before server blocks
limit_req_zone $binary_remote_addr zone=webhooks:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=api_public:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

server {
    listen 80;
    listen [::]:80;
    server_name smmplan.pro www.smmplan.pro;
    server_tokens off;
    client_max_body_size 20M;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://smmplan.pro$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name smmplan.pro;
    server_tokens off;
    client_max_body_size 20M;

    ssl_certificate /etc/letsencrypt/live/smmplan.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/smmplan.pro/privkey.pem;

    # SSL Config
    ssl_buffer_size 8k;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDH+AESGCM:ECDH+AES256:ECDH+AES128:DH+3DES:!ADH:!AECDH:!MD5;
    ssl_ecdh_curve secp384r1;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8;

    # Gzip Compression
    gzip on;
    gzip_proxied any;
    gzip_comp_level 4;
    gzip_types text/css application/javascript image/svg+xml;

    # ── Security Headers (P1.3 — OWASP) ──────────────────────────────────────
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.telegram.org; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
    proxy_hide_header X-Powered-By;

    # Block Invalid HTTP Methods
    if ($request_method !~ ^(GET|HEAD|POST|PUT|DELETE|PATCH|OPTIONS)$) {
        return 405;
    }

    # ── Rate-limited locations (P1.2) ─────────────────────────────────────────

    # Webhook protection: 30 req/s burst 50, then 429
    location /api/webhooks/ {
        limit_req zone=webhooks burst=50 nodelay;
        limit_req_status 429;
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Public API v2 protection: 10 req/s burst 20
    location /api/v2 {
        limit_req zone=api_public burst=20 nodelay;
        limit_req_status 429;
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Auth (magic link): 5 req/min burst 3
    location /api/auth/ {
        limit_req zone=auth burst=3 nodelay;
        limit_req_status 429;
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── SSE Live Chat Stream (P1.4 — Unbuffered) ───────────────────────────────
    # CRITICAL: proxy_buffering MUST be off for Server-Sent Events.
    # Without this, Nginx accumulates SSE chunks and delivers them as batches,
    # breaking real-time message delivery in the live chat.
    location /api/support/chat/stream {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;

        # Disable all buffering and caching for SSE
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;

        # Long-lived connection timeouts (24h max session)
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;

        # Required for SSE: no Connection upgrade, keep-alive
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        limit_except GET HEAD POST OPTIONS {
            deny all;
        }
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Fallback API route location to allow other methods like PUT/DELETE 
    # (they will be rejected by Next.js if unsupported, but Nginx won't block them)
    location /api/ {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /_next/static/ {
        proxy_pass http://app:3000;
        proxy_cache_bypass $http_upgrade;
        access_log off;
        expires max;
    }

    location ~ /\. {
        return 404;
    }

    location ~* \.env {
        return 404;
    }

    location ~* /_next/static/.*/_(build|ssg)Manifest {
        return 404;
    }
}


```

### 📄 `docker-compose.yml`

```yaml
# Smmplan_lite Local Dev Infrastructure

services:
  db:
    image: postgres:15-alpine
    container_name: smmplan_lite_db
    restart: always
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=smmplan_lite
    volumes:
      - lite_postgres_data:/var/lib/postgresql/data
    ports:
      # Expose on 5433 to prevent conflict with Smmplan legacy db
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: smmplan_lite_redis
    restart: always
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - lite_redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  worker:
    image: node:20-alpine
    container_name: smmplan_lite_worker
    working_dir: /app
    volumes:
      - ./:/app
      - /app/node_modules
    command: sh -c "npm install && npx tsx watch src/workers/index.ts"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/smmplan_lite?schema=public&connection_limit=5&pool_timeout=30
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    image: node:20-alpine
    container_name: smmplan_lite_web
    working_dir: /app
    volumes:
      - ./:/app
      - /app/node_modules
      - /app/.next
    command: sh -c "npm install && npm run dev"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/smmplan_lite?schema=public&connection_limit=5&pool_timeout=30
      - REDIS_URL=redis://redis:6379
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  lite_postgres_data:
  lite_redis_data:

```

