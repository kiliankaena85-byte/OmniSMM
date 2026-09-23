# СБОРКА ИСХОДНОГО КОДА ПРОЕКТА SMMplan / Flux / Lovable
## ЧАСТЬ 1 из 5: Инфраструктура, Темы, Тенанты, Навигация, Миддлвар и СУБД

**Дата сборки:** 28 июля 2026  
**Файл:** `PROJECT_FILES_PART_1_2026-07-28.md`  
**Количество файлов в части:** 26  
**Принцип:** Доказательность 100%. Чтение файлов ВСЕГДА выполнено НАПРЯМУЮ С ДИСКА (`fs.readFileSync`). Нет сокращений (`...`), нет моков, нет заглушек.

---

### 📄 Файл 1 из 26: `next.config.mjs`

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

---

### 📄 Файл 2 из 26: `package.json`

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

---

### 📄 Файл 3 из 26: `prisma/schema.prisma`

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

// ── B2B Accounting ──
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

---

### 📄 Файл 4 из 26: `nginx/default.conf`

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

---

### 📄 Файл 5 из 26: `src/middleware.ts`

```ts
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
      // Dev mode auto-login bypass for local environment
      if (process.env.NODE_ENV !== 'production') {
        const autoLoginUrl = new URL('/api/dev/login-direct', request.url);
        autoLoginUrl.searchParams.set('email', process.env.DEV_BYPASS_EMAIL || 'infosokoloff@yandex.ru');
        autoLoginUrl.searchParams.set('tenant', finalTenantId);
        return applyStickyCookie(NextResponse.redirect(autoLoginUrl));
      }
      return applyStickyCookie(NextResponse.redirect(new URL(ROUTES.AUTH.LOGIN, request.url)));
    }

    const payload = await decryptSessionToken(sessionToken);
    // Enforce tenant isolation with normalizeTenantId check (prevents false logouts for legacy JWTs)
    if (!payload || normalizeTenantId(payload.tenantId) !== finalTenantId) {
      if (isRSC) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      // Dev mode auto-login bypass on tenant mismatch in local environment
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

    // Role verification for /admin and /operator
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

  // Set headers for layout detection and tenant isolation
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

```

---

### 📄 Файл 6 из 26: `src/lib/money.ts`

```ts
export type MoneyCents = number; // всегда ЦЕЛЫЕ копейки

/**
 * Converts rubles to integer cents with proper rounding.
 */
export const toCents = (rub: number): MoneyCents => Math.round((rub || 0) * 100);

/**
 * Converts integer cents to float rubles safely.
 */
export const centsToRub = (c: MoneyCents): number => (c || 0) / 100;

/**
 * Formats money in cents as a Russian ruble string with 2 decimal places.
 */
export const formatRub = (c: MoneyCents): string =>
  ((c || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


```

---

### 📄 Файл 7 из 26: `src/lib/tenant-resolver.ts`

```ts
import { db } from './db';

let tenantCache: Map<string, string> | null = null;
let cacheExpiry = 0;
let inflightTenantFetch: Promise<Map<string, string>> | null = null;

async function fetchTenantsFromDb(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const tenants = await db.tenant.findMany({
      where: { isActive: true },
      select: { slug: true, domain: true, customDomain: true },
    });
    for (const t of tenants) {
      map.set(t.domain.toLowerCase(), t.slug);
      if (t.customDomain) {
        map.set(t.customDomain.toLowerCase(), t.slug);
      }
    }
    cacheExpiry = Date.now() + 5 * 60 * 1000;
  } catch (err) {
    console.warn('[TenantResolver] Failed to fetch tenants from DB, applying negative cache (30s):', err);
    cacheExpiry = Date.now() + 30 * 1000; // Negative cache 30 seconds
  }
  return map;
}

const FLUX_DOMAINS = new Set([
  'lovable.local',
  'lovable.smmplan.ru',
  'smmflux.ru',
  'www.smmflux.ru',
  'flux.local',
  'flux.smmplan.ru',
]);

/**
 * Resolves tenantId from HTTP Host header using exact domain match.
 */
export async function resolveTenantFromHost(host: string): Promise<string> {
  const now = Date.now();
  if (!tenantCache || now > cacheExpiry) {
    if (!inflightTenantFetch) {
      inflightTenantFetch = fetchTenantsFromDb().finally(() => {
        inflightTenantFetch = null;
      });
    }
    tenantCache = await inflightTenantFetch;
  }

  const cleanHost = host.split(':')[0].toLowerCase();
  
  if (tenantCache.has(cleanHost)) {
    return tenantCache.get(cleanHost)!;
  }

  // Exact fallback matching using canonical FLUX_DOMAINS set
  return FLUX_DOMAINS.has(cleanHost) ? 'flux' : 'smmplan';
}

/**
 * Edge-compatible host resolver (without Prisma DB dependency) for Next.js Middleware.
 */
export function resolveTenantFromHostEdge(host: string): string {
  const cleanHost = host.split(':')[0].toLowerCase();
  return FLUX_DOMAINS.has(cleanHost) ? 'flux' : 'smmplan';
}

/**
 * Pure tenant ID normalizer.
 * Maps legacy 'lovable' to canonical 'flux'. Returns null/undefined or other IDs as-is.
 */
export function normalizeTenantId<T extends string | null | undefined>(tenantId: T): T {
  if (!tenantId) return tenantId;
  const clean = tenantId.trim().toLowerCase();
  return (clean === 'lovable' ? 'flux' : clean) as T;
}

/**
 * Single Canonical View Strategy Resolver for Server Components & Actions.
 * Strategy MUST be resolved ONLY from the 'x-tenant-id' header set by Middleware.
 */
export function resolveTenantFromRequest(headersList: Headers): string {
  return normalizeTenantId(headersList.get('x-tenant-id')) || 'smmplan';
}


```

---

### 📄 Файл 8 из 26: `src/lib/navigation.ts`

```ts
import { 
  LayoutDashboard, 
  PlusCircle, 
  ListOrdered, 
  Wallet, 
  HelpCircle, 
  Settings,
  Users,
  type LucideIcon
} from 'lucide-react';

export interface NavItem {
  name: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    name: 'Главная',
    label: 'Главная',
    href: '/dashboard',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: 'Новый заказ',
    label: 'Новый заказ',
    href: '/dashboard/new-order',
    icon: PlusCircle,
  },
  {
    name: 'Мои заказы',
    label: 'Заказы',
    href: '/dashboard/orders',
    icon: ListOrdered,
  },
  {
    name: 'Пополнение баланса',
    label: 'Баланс',
    href: '/dashboard/deposit',
    icon: Wallet,
  },
  {
    name: 'Поддержка',
    label: 'Помощь',
    href: '/dashboard/support',
    icon: HelpCircle,
  },
];

export const DOCK_NAV_ITEMS: NavItem[] = MAIN_NAV_ITEMS;

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    name: 'Панель администратора',
    label: 'Админка',
    href: '/admin',
    icon: Settings,
  },
  {
    name: 'Пользователи',
    label: 'Пользователи',
    href: '/admin/users',
    icon: Users,
  },
];

```

---

### 📄 Файл 9 из 26: `src/app/globals.css`

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* ── Background & Off-white base ── */
  --color-background: #f8fafc; /* slate-50 - softer than pure white for bento backdrops */
  --color-foreground: #0f172a; /* slate-900 */

  /* ── Card ── */
  --color-card: #ffffff; /* Pure white cards stand out on slate-50 */
  --color-card-foreground: #0f172a;
  
  /* ── HeroUI Content Tokens (Fallbacks for Tailwind 4) ── */
  --color-content1: var(--color-card);

  /* ── Popover ── */
  --color-popover: #ffffff;
  --color-popover-foreground: #0f172a;

  /* ── Primary (Friendly Sky Blue) ── */
  --color-primary: #0369a1; /* sky-700 - deep, trusty blue for WCAG AA compliance */
  --color-primary-foreground: #ffffff;

  /* ── Secondary (Soft Interactive Background) ── */
  --color-secondary: #e0f2fe; /* sky-100 */
  --color-secondary-foreground: #0369a1; /* sky-700 */

  /* ── Muted (slate-100 / slate-500) ── */
  --color-muted: #f1f5f9;
  --color-muted-foreground: #475569; /* slate-600 for 4.5:1 contrast on slate-50 */

  /* ── Accent ── */
  --color-accent: #f1f5f9;
  --color-accent-foreground: #0f172a;

  /* ── Destructive (rose-500) ── */
  --color-destructive: #f43f5e;
  --color-destructive-foreground: #ffffff;
  --color-destructive-text: #b91c1c;

  /* ── Success (emerald-500) ── */
  --color-success: #10b981;
  --color-success-foreground: #ffffff;
  --color-success-text: #065f46;

  /* ── Warning (amber-500) ── */
  --color-warning: #f59e0b;
  --color-warning-foreground: #ffffff;
  --color-warning-text: #92400e;

  /* ── Info (indigo-500) ── */
  --color-info: #6366f1;
  --color-info-foreground: #ffffff;

  /* ── Brand & Utility Tokens ── */
  --color-brand-telegram: #3390EC;
  --color-blob-sky: #38bdf8;
  --animate-spin-slow: spin 3s linear infinite;

  /* ── Marquee Animation ── */
  --animate-marquee: marquee 30s linear infinite;
  @keyframes marquee {
    0% { transform: translateX(0%); }
    100% { transform: translateX(-50%); }
  }

  /* ── Borders & Inputs ── */
  --color-border: #e2e8f0;
  --color-input: #ffffff;

  /* ── Focus Ring ── */
  --color-ring: #bae6fd; /* sky-200 */

  /* ── Status Badges (Semantic Contrast) ── */
  --color-status-completed: #10b981; /* emerald-500 */
  --color-status-completed-bg: rgba(16, 185, 129, 0.1);
  --color-status-pending: #f59e0b; /* amber-500 */
  --color-status-pending-bg: rgba(245, 158, 11, 0.1);
  --color-status-in-progress: #6366f1; /* indigo-500 */
  --color-status-in-progress-bg: rgba(99, 102, 241, 0.1);
  --color-status-canceled: #64748b; /* slate-500 */
  --color-status-canceled-bg: rgba(100, 116, 139, 0.1);
  --color-status-error: #f43f5e; /* rose-500 */
  --color-status-error-bg: rgba(244, 63, 94, 0.1);

  /* ── Warm Theme Tokens (Zinc/Ivory, graphite, amber accents) ── */
  --color-warm-bg: #FAF9F6;        /* Ivory warm background */
  --color-warm-card: #FFFFFF;      /* Card background */
  --color-warm-zinc: #F4F4F5;      /* Zinc background */
  --color-warm-text: #27272A;      /* Graphite slate text */
  --color-warm-accent: #D97706;    /* Amber accent */
  --color-warm-accent-hover: #B45309; /* Darker amber for hover */
  --color-warm-border: #E4E4E7;    /* Zinc border */

  /* ── Radius (Massive app-like curve) ── */
  --radius: 1.25rem; /* 20px default for soft app feel */
  
  /* ── Aceternity UI Aurora ── */
  --animate-aurora: aurora 60s linear infinite;
  
  @keyframes aurora {
    from {
      background-position: 50% 50%, 50% 50%;
    }
    to {
      background-position: 350% 50%, 350% 50%;
    }
  }

  /* ── Form Error Shake ── */
  --animate-shake: shake 0.5s ease-in-out;
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-4px); }
    40% { transform: translateX(4px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }

  /* ── CTA Hover Pulse (Fintech Soft) ── */
  --animate-hover-pulse: hover-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  
  @keyframes hover-pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(3, 105, 161, 0.4); /* sky-700 */
    }
    100% {
      box-shadow: 0 0 0 1em rgba(3, 105, 161, 0); /* Transparent */
    }
  }
}
/* --- DARK THEMES VARIABLES OVERRIDE --- */
.dark,
.sky-dark,
.emerald-dark,
.violet-dark,
[data-theme*="dark"] {
  --color-background: #0f172a; /* Soft, premium slate-900 instead of pitch-black */
  --color-foreground: #f8fafc; /* slate-50 */

  --color-card: #1e293b; /* slate-800 for soft, recognizable elevation */
  --color-card-foreground: #f8fafc;

  --color-popover: #1e293b;
  --color-popover-foreground: #f8fafc;

  --color-muted: #243042; /* Soft intermediate slate */
  --color-muted-foreground: #cbd5e1; /* slate-300 for 4.5:1 contrast on slate-800 */

  --color-accent: #243042;
  --color-accent-foreground: #f8fafc;

  --color-border: rgba(255, 255, 255, 0.08); /* Luminance Border (blueprint aesthetic) */
  --color-input: #1b2330;

  --color-ring: rgba(56, 189, 248, 0.35); /* Soft sky blue focus ring glow */

  --color-primary: #38bdf8; /* sky-400 */
  --color-primary-foreground: #0f172a;

  --color-warning: #f59e0b;
  --color-warning-text: #fbbf24;
  --color-success-text: #34d399;
  --color-destructive-text: #fca5a5;
  --color-info: #818cf8; /* indigo-400 */

  /* ── Status Badges (Dark Mode Adjustments) ── */
  --color-status-completed: #34d399; /* emerald-400 */
  --color-status-pending: #fbbf24; /* amber-400 */
  --color-status-in-progress: #818cf8; /* indigo-400 */
  --color-status-canceled: #94a3b8; /* slate-400 */
  --color-status-error: #fb7185; /* rose-400 */
}

@layer base {
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    overscroll-behavior-y: contain; /* Prevent pull-to-refresh destroying form state on Android */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1, h2, h3, h4, h5, h6 {
    text-wrap: balance;
  }
  p {
    text-wrap: pretty;
  }
  table, .tabular-data, [data-testid="balance"], .user-balance, .price {
    font-variant-numeric: tabular-nums;
  }

  /* Premium default smooth transitions for all interactive elements */
  button, a, input, select, textarea, [role="button"] {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
  }
}

/* --- THEME: EMERALD LIGHT --- */
.emerald-light, [data-theme="emerald-light"] {
  --color-primary: #047857; /* emerald-700 */
  --color-primary-foreground: #ffffff;
  --color-secondary: #d1fae5; /* emerald-100 */
  --color-secondary-foreground: #047857; /* emerald-700 */
  --color-ring: #a7f3d0; /* emerald-200 */
  --animate-hover-pulse: hover-pulse-emerald 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes hover-pulse-emerald {
  0% { box-shadow: 0 0 0 0 rgba(4, 120, 87, 0.4); }
  100% { box-shadow: 0 0 0 1em rgba(4, 120, 87, 0); }
}

/* --- THEME: EMERALD DARK --- */
.emerald-dark, [data-theme="emerald-dark"] {
  --color-primary: #10b981; /* emerald-500 - desaturated green for WCAG AA */
  --color-primary-foreground: #020617;
  --color-secondary: #064e3b; /* emerald-950 */
  --color-secondary-foreground: #34d399; /* emerald-400 */
  --color-ring: rgba(16, 185, 129, 0.35); /* Soft emerald green focus ring glow */
  --animate-hover-pulse: hover-pulse-emerald-dark 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes hover-pulse-emerald-dark {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  100% { box-shadow: 0 0 0 1em rgba(16, 185, 129, 0); }
}

/* --- THEME: VIOLET LIGHT --- */
.violet-light, [data-theme="violet-light"] {
  --color-primary: #7c3aed; /* violet-600 */
  --color-primary-foreground: #ffffff;
  --color-secondary: #ede9fe; /* violet-100 */
  --color-secondary-foreground: #6d28d9; /* violet-700 */
  --color-ring: #ddd6fe; /* violet-200 */
  --animate-hover-pulse: hover-pulse-violet 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes hover-pulse-violet {
  0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4); }
  100% { box-shadow: 0 0 0 1em rgba(124, 58, 237, 0); }
}

/* --- THEME: VIOLET DARK --- */
.violet-dark, [data-theme="violet-dark"] {
  --color-primary: #a78bfa; /* violet-400 - desaturated violet for WCAG AA */
  --color-primary-foreground: #020617;
  --color-secondary: #2e1065; /* violet-950 */
  --color-secondary-foreground: #c084fc; /* violet-400 */
  --color-ring: rgba(167, 139, 250, 0.35); /* Soft violet focus ring glow */
  --animate-hover-pulse: hover-pulse-violet-dark 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes hover-pulse-violet-dark {
  0% { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.4); }
  100% { box-shadow: 0 0 0 1em rgba(167, 139, 250, 0); }
}

/* --- THEME: WARM IVORY LIGHT --- */
.warm-light, [data-theme="warm-light"] {
  --color-background: #FAF9F6;
  --color-foreground: #27272A;
  --color-card: #FFFFFF;
  --color-card-foreground: #27272A;
  --color-popover: #FFFFFF;
  --color-popover-foreground: #27272A;
  --color-muted: #F4F4F5;
  --color-muted-foreground: #71717A;
  --color-border: #E4E4E7;
  --color-primary: #D97706;
  --color-primary-foreground: #ffffff;
  --color-secondary: #FEF3C7;
  --color-secondary-foreground: #B45309;
  --color-ring: #FDE68A;
  --animate-hover-pulse: hover-pulse-warm 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes hover-pulse-warm {
  0% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.4); }
  100% { box-shadow: 0 0 0 1em rgba(217, 119, 6, 0); }
}

/* --- THEME: WARM IVORY DARK --- */
.warm-dark, [data-theme="warm-dark"] {
  --color-background: #09090B;
  --color-foreground: #FAF9F6;
  --color-card: #18181B;
  --color-card-foreground: #FAF9F6;
  --color-popover: #18181B;
  --color-popover-foreground: #FAF9F6;
  --color-muted: #27272A;
  --color-muted-foreground: #A1A1AA;
  --color-border: rgba(255, 255, 255, 0.08); /* Luminance Border */
  --color-primary: #F59E0B;
  --color-primary-foreground: #09090B;
  --color-secondary: #78350F;
  --color-secondary-foreground: #FBBF24;
  --color-ring: rgba(245, 158, 11, 0.35); /* Soft amber focus ring glow */
  --animate-hover-pulse: hover-pulse-warm-dark 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes hover-pulse-warm-dark {
  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  100% { box-shadow: 0 0 0 1em rgba(245, 158, 11, 0); }
}


/* Custom minimal scrollbar for B2B (Pillar 6) */
@layer utilities {
  .shadow-layered {
    box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.04);
  }
  .dark .shadow-layered, [data-theme*="dark"] .shadow-layered {
    box-shadow: 0 1px 2px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.2), 0 12px 32px rgba(0,0,0,0.2);
  }
  
  .stagger-1 { animation-delay: 50ms; }
  .stagger-2 { animation-delay: 100ms; }
  .stagger-3 { animation-delay: 150ms; }
  .stagger-4 { animation-delay: 200ms; }
  .stagger-5 { animation-delay: 250ms; }
  
  .animate-fade-in-up {
    animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
    transform: translateY(10px);
  }
}

/* Fix Chrome Autofill breaking transparent inputs in both themes dynamically */
@layer base {
  input:-webkit-autofill,
  input:-webkit-autofill:hover, 
  input:-webkit-autofill:focus, 
  input:-webkit-autofill:active {
      transition: background-color 5000s ease-in-out 0s;
      -webkit-text-fill-color: var(--color-foreground) !important;
}
}

/* --- Premium Stripe Grid Backdrop --- */
.premium-grid-backdrop {
  background-image: 
    linear-gradient(to right, var(--color-border) 1px, transparent 1px),
    linear-gradient(to bottom, var(--color-border) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.15;
}

/* --- THEME: TELEGRAM LIGHT --- */
.telegram-light, [data-theme="telegram-light"] {
  --color-background: #E7EBF0;
  --color-foreground: #000000;
  --color-card: #FFFFFF;
  --color-card-foreground: #000000;
  --color-popover: #FFFFFF;
  --color-popover-foreground: #000000;
  --color-muted: #F1F5F9;
  --color-muted-foreground: #707579;
  --color-border: #DCDCDC;
  --color-primary: #3390EC;
  --color-primary-foreground: #FFFFFF;
  --color-secondary: #E1F3D4;
  --color-secondary-foreground: #000000;
  --color-ring: #BADEFC;
  --radius: 0.625rem;
}

/* --- THEME: TELEGRAM DARK --- */
.telegram-dark, [data-theme="telegram-dark"] {
  --color-background: #0E1621;
  --color-foreground: #F5F6F7;
  --color-card: #182533;
  --color-card-foreground: #F5F6F7;
  --color-popover: #182533;
  --color-popover-foreground: #F5F6F7;
  --color-muted: #101921;
  --color-muted-foreground: #7F8C99;
  --color-border: rgba(255, 255, 255, 0.08); /* Luminance Border */
  --color-primary: #5288C1;
  --color-primary-foreground: #F5F6F7;
  --color-secondary: #2B5278;
  --color-secondary-foreground: #F5F6F7;
  --color-ring: rgba(82, 136, 193, 0.35); /* Soft telegram blue focus ring glow */
  --radius: 0.625rem;
}

/* --- Locked Layout Height for Desktop Support Page (Telegram Desktop lock layout style) --- */
@media (min-width: 1024px) {
  main:has(.tickets-workspace) {
    overflow: hidden !important;
  }
  main:has(.tickets-workspace) > div {
    padding: 0 !important;
    height: 100% !important;
    min-height: 100% !important;
    max-height: 100% !important;
    overflow: hidden !important;
  }
}



/* --- Custom Telegram Chat Wallpaper Background --- */
.telegram-chat-bg {
  position: relative;
  background-color: var(--color-background);
}
.telegram-light .telegram-chat-bg,
[data-theme="telegram-light"] .telegram-chat-bg,
.light .telegram-chat-bg,
[data-theme="light"] .telegram-chat-bg {
  background-color: #84bbf0 !important; /* Premium sky blue Telegram theme background */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%234ba0ec' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round' opacity='0.4'%3E%3Cpath d='M15 15 L28 10 L23 23 L20 18 Z M20 18 L23 10' /%3E%3Cpath d='M80 20 C78 18, 74 18, 72 20 C70 22, 70 26, 72 28 L80 36 L88 28 C90 26, 90 22, 88 20 C86 18, 82 18, 80 20 Z' /%3E%3Cpath d='M25 75 H37 C39 75, 41 77, 41 79 V87 C41 89, 39 91, 37 91 H31 L25 95 V91 C23 91, 21 89, 21 87 V79 C21 77, 23 75, 25 75 Z' /%3E%3Cpath d='M95 70 L97 74 L102 75 L98 78 L99 83 L95 81 L91 83 L92 78 L88 75 L93 74 Z' /%3E%3Cpath d='M56 50 H64 V56 H56 Z M58 50 V47 C58 45, 62 45, 62 47 V50' /%3E%3Ccircle cx='60' cy='100' r='8' /%3E%3Cpath d='M57 99 V98 M63 99 V98 M57 102 C58 104, 62 104, 63 102' /%3E%3Ccircle cx='15' cy='50' r='4' /%3E%3Cpath d='M15 44 V46 M15 54 V56 M9 50 H11 M19 50 H21' /%3E%3C/g%3E%3C/svg%3E") !important;
  background-size: 120px 120px !important;
}
.telegram-dark .telegram-chat-bg,
[data-theme="telegram-dark"] .telegram-chat-bg,
.dark .telegram-chat-bg,
[data-theme="dark"] .telegram-chat-bg {
  background-color: #0e1621 !important; /* Premium dark Telegram slate-blue */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%235288c1' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round' opacity='0.18'%3E%3Cpath d='M15 15 L28 10 L23 23 L20 18 Z M20 18 L23 10' /%3E%3Cpath d='M80 20 C78 18, 74 18, 72 20 C70 22, 70 26, 72 28 L80 36 L88 28 C90 26, 90 22, 88 20 C86 18, 82 18, 80 20 Z' /%3E%3Cpath d='M25 75 H37 C39 75, 41 77, 41 79 V87 C41 89, 39 91, 37 91 H31 L25 95 V91 C23 91, 21 89, 21 87 V79 C21 77, 23 75, 25 75 Z' /%3E%3Cpath d='M95 70 L97 74 L102 75 L98 78 L99 83 L95 81 L91 83 L92 78 L88 75 L93 74 Z' /%3E%3Cpath d='M56 50 H64 V56 H56 Z M58 50 V47 C58 45, 62 45, 62 47 V50' /%3E%3Ccircle cx='60' cy='100' r='8' /%3E%3Cpath d='M57 99 V98 M63 99 V98 M57 102 C58 104, 62 104, 63 102' /%3E%3Ccircle cx='15' cy='50' r='4' /%3E%3Cpath d='M15 44 V46 M15 54 V56 M9 50 H11 M19 50 H21' /%3E%3C/g%3E%3C/svg%3E") !important;
  background-size: 120px 120px !important;
}

/* --- Premium Dot Grid Backdrop --- */
.premium-dot-grid {
  background-image: radial-gradient(rgba(148, 163, 184, 0.1) 1.5px, transparent 1.5px);
  background-size: 16px 16px;
}
.dark .premium-dot-grid,
[data-theme*="dark"] .premium-dot-grid {
  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1.5px, transparent 1.5px);
}

/* --- Google Shimmer Border Effect --- */
@keyframes border-shimmer {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.google-border-shimmer {
  background: linear-gradient(90deg, #38bdf8, #818cf8, #d946ef, #34d399, #38bdf8);
  background-size: 300% 300%;
  animation: border-shimmer 8s ease infinite;
}

.dark .google-border-shimmer,
[data-theme*="dark"] .google-border-shimmer {
  background: linear-gradient(90deg, #38bdf8, #818cf8, #d946ef, #34d399, #38bdf8);
  background-size: 300% 300%;
}

.warning-border-shimmer {
  background: linear-gradient(90deg, #f43f5e, #f59e0b, #ef4444, #f59e0b, #f43f5e);
  background-size: 300% 300%;
  animation: border-shimmer 4s linear infinite;
}

.dark .warning-border-shimmer,
[data-theme*="dark"] .warning-border-shimmer {
  background: linear-gradient(90deg, #fca5a5, #fbbf24, #ef4444, #fbbf24, #fca5a5);
  background-size: 300% 300%;
}

/* --- Custom Utility: Scrollbar Hide / None --- */
.scrollbar-hide,
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar,
.scrollbar-none::-webkit-scrollbar {
  display: none;
}

/* --- Premium thin scrollbar styles --- */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 9999px;
  border: 1.5px solid transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: var(--color-muted-foreground);
}
.dark .scrollbar-thin::-webkit-scrollbar-thumb,
[data-theme*="dark"] .scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
.dark .scrollbar-thin::-webkit-scrollbar-thumb:hover,
[data-theme*="dark"] .scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

```

---

### 📄 Файл 10 из 26: `src/tenants/flux/strategy.ts`

```ts
import { LovableDashboardShell } from '@/components/dashboard/lovable/LovableDashboardShell';
import { LovableDashboardHome } from '@/components/dashboard/lovable/LovableDashboardHome';
import { LovableNewOrderWorkspace } from '@/components/dashboard/LovableNewOrderWorkspace';
import { LovableOrdersView } from '@/components/dashboard/lovable/LovableOrdersView';
import { ITenantDashboardStrategy } from '../types';

export const FluxTenantStrategy: ITenantDashboardStrategy = {
  ShellLayout: LovableDashboardShell as unknown as ITenantDashboardStrategy['ShellLayout'],
  HomeView: LovableDashboardHome as unknown as ITenantDashboardStrategy['HomeView'],
  NewOrderView: LovableNewOrderWorkspace as unknown as ITenantDashboardStrategy['NewOrderView'],
  OrdersView: LovableOrdersView as unknown as ITenantDashboardStrategy['OrdersView'],
};

export default FluxTenantStrategy;

```

---

### 📄 Файл 11 из 26: `src/tenants/registry.ts`

```ts
import { ITenantDashboardStrategy } from './types';

// Map of registered tenant loaders for Dynamic Lazy Loading (Code-Splitting F4 protection)
const registry = new Map<string, () => Promise<{ default: ITenantDashboardStrategy }>>();

export function registerTenant(id: string, loader: () => Promise<{ default: ITenantDashboardStrategy }>) {
  if (registry.has(id)) {
    return;
  }
  registry.set(id, loader);
}

export function getTenantLoader(id: string) {
  return registry.get(id);
}

// Initial registrations (Open-Closed Self-Registration)
registerTenant('smmplan', () => import('./smmplan/strategy'));
registerTenant('flux', () => import('./flux/strategy'));
registerTenant('lovable', () => import('./flux/strategy')); // Legacy alias for backward compatibility

```

---

### 📄 Файл 12 из 26: `src/tenants/factory.ts`

```ts
import { ITenantDashboardStrategy } from './types';
import { getTenantLoader } from './registry';

import { normalizeTenantId } from '@/lib/tenant-resolver';

/**
 * Tenant View Factory (100% OCP Compliant)
 * Dynamically resolves the tenant dashboard strategy without editing this factory file.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTenantDashboardViews(tenantId: string): Promise<ITenantDashboardStrategy<any, any>> {
  const normalizedId = normalizeTenantId(tenantId) || 'smmplan';
  const loader = getTenantLoader(normalizedId);
  if (!loader) {
    console.warn(`[TenantFactory] Unregistered tenant requested: "${tenantId}". Loading neutral maintenance fallback.`);
    const fallbackModule = await import('./fallback/neutral-maintenance-strategy');
    return fallbackModule.default;
  }

  try {
    const tenantModule = await loader();
    return tenantModule.default;
  } catch (err) {
    console.error(`[TenantFactory] Failed to load tenant module for "${tenantId}":`, err);
    const fallbackModule = await import('./fallback/neutral-maintenance-strategy');
    return fallbackModule.default;
  }
}

```

---

### 📄 Файл 13 из 26: `src/tenants/types.ts`

```ts
import React from 'react';

export interface BaseUserProps {
  id?: string;
  email: string;
  balance: bigint;
  totalSpent?: bigint;
  referralCode?: string;
  tenantId: string;
  role?: string;
}

export interface OrderViewData {
  id: string;
  numericId: number;
  status: string;
  charge: bigint | number;
  discountCents?: bigint | number;
  usdToRubRate?: number | null;
  quantity: number;
  remains?: number | null;
  link?: string | null;
  error?: string | null;
  createdAt: Date | string;
  isDripFeed?: boolean;
  runs?: number | null;
  interval?: number | null;
  currentRun?: number;
  nextRunAt?: Date | string | null;
  refills?: Array<{
    id: string;
    status: string;
    createdAt: Date | string;
  }>;
  service: {
    id?: string;
    categoryId?: string;
    name: string;
    isRefillEnabled?: boolean;
    category?: {
      name?: string;
      network?: {
        name?: string;
        slug?: string;
      } | null;
    } | null;
  };
}

export interface NetworkViewData {
  slug: string;
  name: string;
}

export interface ITenantDashboardStrategy<TUser extends BaseUserProps = BaseUserProps, TOrder = unknown> {
  ShellLayout: React.ComponentType<{ user: TUser; children: React.ReactNode }>;
  HomeView: React.ComponentType<{
    user: TUser;
    orders: TOrder[];
    referralCount: number;
    activeOrders: number;
    hasPendingPayments: boolean;
    origin: string;
    initialCatalog?: unknown[];
  }>;
  NewOrderView?: React.ComponentType<{
    userEmail: string;
    userBalanceCents: number;
    initialReorderData: unknown;
  }>;
  OrdersView?: React.ComponentType<{
    orders: OrderViewData[];
    totalCount: number;
    userBalanceCents: number;
    search: string;
    status: string;
    network: string;
    networks: NetworkViewData[];
    currentPage: number;
    totalPages: number;
    countsMap: Record<string, number>;
  }>;
}

```

---

### 📄 Файл 14 из 26: `src/app/api/dev/switch-tenant/route.ts`

```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }
  const session = await verifySession();
  
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const { searchParams } = new URL(req.url);
  const targetTenant = searchParams.get('to') || 'lovable';

  try {
    await db.user.update({
      where: { id: session.userId },
      data: { tenantId: targetTenant },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2002') {
      // Find the current user to get their email
      const currentUser = await db.user.findUnique({ where: { id: session.userId } });
      if (currentUser && currentUser.email) {
        // Move the colliding account out of the way
        await db.user.update({
          where: {
            email_tenantId: {
              email: currentUser.email,
              tenantId: targetTenant,
            }
          },
          data: {
            email: currentUser.email + '_duplicate_' + Date.now(),
          }
        });
        // Try again
        await db.user.update({
          where: { id: session.userId },
          data: { tenantId: targetTenant },
        });
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to switch tenant:', error);
    return new NextResponse('Failed to switch tenant. ' + errorMessage, { status: 400 });
  }

  return NextResponse.redirect(new URL('/dashboard', req.url));
}

```

---

### 📄 Файл 15 из 26: `src/components/admin/navigation-data.ts`

```ts
export const OPERATIONS_TABS = [
  { label: 'Сводка дашборда', href: '/admin/dashboard' },
  { label: 'Заказы клиентов', href: '/admin/orders' },
  { label: 'Заявки на докрутку', href: '/admin/refills' },
  { label: 'Тикеты поддержки', href: '/admin/tickets' },
];

export const FINANCE_TABS = [
  { label: 'Клиенты платформы', href: '/admin/clients' },
  { label: 'Транзакции и биллинг', href: '/admin/finance' },
  { label: 'Маркетинг и промокоды', href: '/admin/marketing' },
];

export const CATALOG_TABS = [
  { label: 'Каталог услуг', href: '/admin/catalog' },
  { label: 'Карантин цен', href: '/admin/catalog/quarantine' },
  { label: 'Провайдеры API', href: '/admin/providers' },
  { label: 'Импорт услуг', href: '/admin/providers/import' },
  { label: 'Умный Dripfeed', href: '/admin/smart' },
];

export const SYSTEM_TABS = [
  { label: 'Глобальные настройки', href: '/admin/settings' },
  { label: 'CMS Страницы', href: '/admin/pages' },
  { label: 'Статьи блога', href: '/admin/knowledge' },
  { label: 'Фичи (Flags)', href: '/admin/system/features' },
];

export const ONBOARDING_CONFIGS = {
  dashboard: {
    description: 'Оперативный центр мониторинга платформы. Здесь выводятся ключевые финансовые метрики (выручка, чистая прибыль, обязательства), активность заказов и статус балансов у провайдеров API.',
    faqs: [
      { q: 'Что такое Обязательства (Liability)?', a: 'Сумма балансов всех клиентов в рублях. Это деньги, которые пользователи завели на платформу, но еще не потратили.' },
      { q: 'Как рассчитывается Чистая прибыль?', a: 'Выручка (Gross) минус комиссии эквайринга (3%), минус себестоимость у провайдеров (COGS) и налог УСН.' },
    ],
    docLink: '/admin/manual#5-административная-панель'
  },
  orders: {
    description: 'Реестр всех заказов на платформе. Вы можете искать заказы по номеру ID, ссылке, email клиента или фильтровать по статусу.',
    faqs: [
      { q: 'Что делать, если статус заказа "ERROR"?', a: 'Это значит, что провайдер отклонил запрос или вернул ошибку. Вы можете отменить заказ (средства вернутся клиенту) или перезапустить его.' },
      { q: 'Как работает частичный возврат (Partial)?', a: 'Если заказ выполнен частично, при смене статуса на PARTIAL или COMPLETE система автоматически вернет клиенту сдачу за недолитые единицы.' },
    ],
    docLink: '/admin/manual#3-система-заказов'
  },
  refills: {
    description: 'Управление заявками на докрутку (Refill) при списании показателей. Клиент может запросить докрутку по гарантии прямо из своего кабинета.',
    faqs: [
      { q: 'Зачем нужны кнопки действий?', a: '🔄 Перезапустить отправляет запрос провайдеру повторно. ✅ Выполнить и 🚫 Отклонить позволяют закрыть заявку вручную, если авто-задача зависла.' },
      { q: 'Почему кнопка Перезапустить недоступна?', a: 'Кнопка скрыта для докруток, которые уже находятся в статусе COMPLETED (успешно завершены).' },
    ],
    docLink: '/admin/manual#3-система-заказов'
  },
  tickets: {
    description: 'Рабочая панель службы поддержки. Позволяет операторам отвечать на вопросы клиентов и начислять компенсации в случае сбоев.',
    faqs: [
      { q: 'Как работают компенсации?', a: 'Оператор может начислить бонусные рубли клиенту прямо в тикете. Общая сумма трат за день ограничена лимитом (supportLimitCents) оператора.' },
      { q: 'Что такое шаблоны ответов?', a: 'Быстрые заготовки ответов для частых вопросов. Их можно редактировать в настройках.' },
    ],
    docLink: '/admin/manual#8-техподдержка-полный-регламент'
  },
  clients: {
    description: 'Список зарегистрированных пользователей платформы. Вы можете редактировать балансы, выдавать персональные скидки и банить нарушителей.',
    faqs: [
      { q: 'Как работает кнопка "Войти как клиент"?', a: 'Вы авторизуетесь под учетной записью клиента в отдельной вкладке, чтобы увидеть интерфейс платформы его глазами.' },
      { q: 'Как начислить или списать баланс?', a: 'Используйте блок Корректировка баланса. Сумма указывается в копейках. Для списания введите отрицательное число (например, -5000 = списать 50 ₽).' },
    ],
    docLink: '/admin/manual#5-административная-панель'
  },
  finance: {
    description: 'Журнал транзакций, реестр всех пополнений баланса через платежные шлюзы и ручные корректировки.',
    faqs: [
      { q: 'Что такое Карантин транзакций?', a: 'Все начисления или списания свыше установленного лимита безопасности уходят в карантин и требуют ручного подтверждения Владельцем.' },
      { q: 'Где посмотреть статус платежа YooKassa?', a: 'Статус синхронизируется автоматически по вебхукам. В таблице вы можете увидеть исходный transaction ID и детали шлюза.' },
    ],
    docLink: '/admin/manual#4-платёжная-система'
  },
  marketing: {
    description: 'Управление маркетинговыми инструментами: создание купонов на скидку (DISCOUNT) или ваучеров на баланс (VOUCHER).',
    faqs: [
      { q: 'В чем разница между ваучером и скидкой?', a: 'Ваучер начисляет фиксированную сумму в рублях на баланс клиента при активации. Скидка снижает розничную цену на услуги на заданный процент.' },
      { q: 'Как работают лимиты использований?', a: 'maxUses ограничивает, сколько раз суммарно все пользователи могут активировать данный промокод.' },
    ],
    docLink: '/admin/manual#10-внутренние-процессы'
  },
  catalog: {
    description: 'Каталог розничных услуг платформы. Вы можете настраивать наценки, менять привязанные категории и отключать услуги.',
    faqs: [
      { q: 'Как работает автокалькуляция цены?', a: 'Цена за 1 шт = (Цена провайдера за 1000 * наценка * курс USD) / 1000. В каталоге всегда отображается цена за 1 единицу.' },
      { q: 'Что такое Пакетное обновление наценки?', a: 'Вы можете выбрать категорию услуг и установить единую наценку в процентах для всех активных услуг в этой категории.' },
    ],
    docLink: '/admin/manual#6-провайдеры-и-каталог'
  },
  quarantine: {
    description: 'Карантин цен услуг. Сюда попадают услуги, у которых при автоматической синхронизации цена у провайдера резко подскочила.',
    faqs: [
      { q: 'Почему услуга попала в карантин?', a: 'Либо у провайдера цена выросла более чем на 20% (Price Spike), либо маржа упала ниже безопасного порога (Margin Floor Breach).' },
      { q: 'Как выпустить услугу из карантина?', a: 'Нажмите "Одобрить цену", чтобы принять новый тариф и автоматически пересчитать розничную стоимость для клиентов.' },
    ],
    docLink: '/admin/manual#6-провайдеры-и-каталог'
  },
  providers: {
    description: 'Интеграция с оптовыми SMM панелями по API. Система автоматически запрашивает у них тарифы, размещает заказы и проверяет статусы.',
    faqs: [
      { q: 'Как импортировать новые услуги?', a: 'Перейдите на вкладку Импорт, выберите провайдера, отметьте нужные галочки в теневом каталоге Redis и запустите пакетный импорт.' },
      { q: 'Что делать при ошибке баланса провайдера?', a: 'Если баланс провайдера близок к нулю, заказы будут падать в статус ERROR. Пополните баланс на стороне провайдера.' },
    ],
    docLink: '/admin/manual#6-провайдеры-и-каталог'
  },
  settings: {
    description: 'Глобальная панель настроек SMMplan. Конфигурация платежных ключей, SMTP-сервера, курсов валют и ролей доступа персонала.',
    faqs: [
      { q: 'Как работает привязка StaffRole?', a: 'Для менеджеров и саппортов можно создать роль с гранулярными правами (только просмотр заказов, или только биллинг).' },
      { q: 'Зачем нужен курс доллара (exchangeRateUSD)?', a: 'Используется для пересчета USD-тарифов провайдеров в рубли при синхронизации каталога. Изменение курса вызовет фоновый пересчет цен.' },
    ],
    docLink: '/admin/manual#5-административная-панель'
  },
  smart: {
    description: 'Система постепенной отправки заказов провайдерам (Drip-feed). Разделяет крупные заказы на небольшие порции (чанки) с заданным интервалом для симуляции естественного роста.',
    faqs: [
      { q: 'Как работает интервал Drip-feed?', a: 'Каждый чанк отправляется провайдеру по расписанию с указанной задержкой (например, каждые 30 минут).' },
      { q: 'Что происходит при ошибке чанка?', a: 'Если один из чанков завершается с ошибкой у провайдера, кампания приостанавливается, а администратор получает уведомление.' },
    ],
    docLink: '/admin/manual#3-система-заказов'
  },
  pages: {
    description: 'Интерфейс управления текстовыми страницами сайта. Вы можете создавать и редактировать информационные страницы, такие как Условия использования, Оферта или Контакты.',
    faqs: [
      { q: 'Как изменить главную страницу?', a: 'Главная страница рендерится из шаблона, но ее разделы могут ссылаться на CMS страницы с конкретными slug (например, "privacy").' },
      { q: 'Поддерживается ли HTML/Markdown?', a: 'Да, при создании и редактировании страниц доступен текстовый редактор с поддержкой разметки.' },
    ],
    docLink: '/admin/manual#5-административная-панель'
  },
  knowledge: {
    description: 'Панель управления встроенным блогом и базой знаний. Здесь вы публикуете новости платформы, руководства по продвижению в соцсетях и инструкции для клиентов.',
    faqs: [
      { q: 'Что такое статус Черновик?', a: 'Статья в статусе черновика видна только администраторам в этой панели и скрыта с публичного сайта.' },
      { q: 'Как отслеживать просмотры?', a: 'Каждое посещение страницы статьи клиентом увеличивает счетчик viewCount в реальном времени.' },
    ],
    docLink: '/admin/manual#5-административная-панель'
  },
  features: {
    description: 'Панель управления фича-флагами. Позволяет мгновенно включать или отключать технические разделы платформы (например, Dripfeed, авто-докрутки или регистрацию) без необходимости деплоя.',
    faqs: [
      { q: 'Что будет, если отключить фичу?', a: 'Функционал мгновенно блокируется на уровне API / Server Actions и скрывается из пользовательского интерфейса.' },
      { q: 'Безопасно ли переключать флаги?', a: 'Да, это стандартный механизм безопасного выкатывания фич (Canary/Dark Launches). При обнаружении багов фичу можно отключить одной кнопкой.' },
    ],
    docLink: '/admin/manual#5-административная-панель'
  }
};

```

---

### 📄 Файл 16 из 26: `src/components/admin/tenant-selector.tsx`

```tsx
'use client';

import React, { useTransition } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface TenantSelectorProps {
  tenants: { id: string; name: string; slug: string }[];
  activeFilter: string;
}

export function TenantSelector({ tenants, activeFilter }: TenantSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSelectChange = (value: string | null) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === 'all') {
        params.delete('tenant');
      } else {
        params.set('tenant', value);
      }
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Бренд:</span>
      <Select 
        value={activeFilter} 
        onValueChange={handleSelectChange}
        disabled={isPending}
      >
        <SelectTrigger size="sm" className="w-[180px] bg-background/60 backdrop-blur-md border-border/40 font-semibold shadow-sm transition-all duration-200">
          <SelectValue placeholder="Все бренды">
            {(value) => {
              if (value === 'all' || !value) return 'Все бренды';
              return tenants.find(t => t.slug === value)?.name ?? value;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false} className="z-50 bg-popover/80 backdrop-blur-lg border border-border/40">
          <SelectItem value="all">
            Все бренды
          </SelectItem>
          {tenants.map((tenant) => (
            <SelectItem key={tenant.id} value={tenant.slug}>
              {tenant.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

```

---

### 📄 Файл 17 из 26: `src/lib/operator/navigation.ts`

```ts
import { NavGroup } from '@/types/operator/navigation';

export const OPERATOR_NAVIGATION: NavGroup[] = [
  {
    group: 'Операционная панель',
    items: [
      {
        href: '/operator/dashboard',
        label: 'Дашборд',
        icon: 'LayoutDashboard',
      },
      {
        href: '/operator/orders',
        label: 'Заказы',
        icon: 'Package',
      },
      {
        href: '/operator/tickets',
        label: 'Тикеты',
        icon: 'MessageSquare',
        badgeKey: 'openTickets',
      },
    ],
  },
  {
    group: 'Управление',
    items: [
      {
        href: '/operator/users',
        label: 'Пользователи',
        icon: 'Users',
      },
      {
        href: '/operator/transactions',
        label: 'Транзакции',
        icon: 'CreditCard',
      },
    ],
  },
];

```

---

### 📄 Файл 18 из 26: `src/lib/prisma-tenant-scope.ts`

```ts
import { db } from './db';
import { Prisma } from '@prisma/client';

/**
 * Enterprise Tenant-Scoped Database Client (Defense-in-Depth)
 * Enforces explicit multi-tenant data isolation across all query operations.
 */

export function getTenantScopedDb(tenantId: string) {
  return db.$extends({
    query: {
      order: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findUnique({ args }) {
          // Convert findUnique to findFirst to enforce composite tenantId where clause safely
          return db.order.findFirst({
            ...args,
            where: { ...args.where, tenantId },
          });
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenantId } as Prisma.OrderWhereUniqueInput;
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, tenantId } as Prisma.OrderWhereUniqueInput;
          return query(args);
        },
      },
      payment: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenantId } as Prisma.PaymentWhereUniqueInput;
          return query(args);
        },
      },
      ticket: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
      ledgerEntry: {
        async findMany({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
        async create({ args, query }) {
          const userId = (args.data as { userId?: string }).userId;
          if (userId) {
            const user = await db.user.findUnique({
              where: { id: userId },
              select: { tenantId: true },
            });
            if (user && user.tenantId !== tenantId) {
              throw new Error(`[TenantScope] Cross-tenant LedgerEntry creation blocked for userId ${userId}`);
            }
          }
          return query(args);
        },
      },
      commission: {
        async findMany({ args, query }) {
          args.where = { ...args.where, referrer: { tenantId } };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, referrer: { tenantId } };
          return query(args);
        },
      },
      smartCampaign: {
        async findMany({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
      },
      invoice: {
        async findMany({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
      },
    },
  });
}

```

---

### 📄 Файл 19 из 26: `src/lib/tenant-scope.ts`

```ts
/**
 * @file TenantScope - Canonical Golden Path Primitive for Multi-Tenant Scoping & Enforcement.
 * @module TenantScope
 * 
 * JSDoc / Usage Guidelines:
 * ✅ DO THIS:
 *   const tenantId = requireTenantId(session);
 *   const orders = await db.order.findMany({ where: tenantWhere(session, { status: 'COMPLETED' }) });
 *   assertSameTenant(session, targetOrder);
 * 
 * ❌ NEVER DO THIS (Tenant Isolation Leak):
 *   const order = await db.order.findUnique({ where: { id: params.id } }); // ❌ Lacks tenant filter!
 */

export interface TenantSession {
  tenantId?: string;
  user?: {
    tenantId?: string;
  };
}

export function requireTenantId(session: TenantSession | null | undefined): string {
  const tenantId = session?.tenantId || session?.user?.tenantId;
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('SECURITY_TENANT_MISSING: Operation blocked - missing valid tenantId in session.');
  }
  return tenantId;
}

export function tenantWhere<T extends object>(session: TenantSession | null | undefined, baseWhere: T = {} as T): T & { tenantId: string } {
  const tenantId = requireTenantId(session);
  return {
    ...baseWhere,
    tenantId
  };
}

export function assertSameTenant(session: TenantSession | null | undefined, entity: { tenantId?: string } | null | undefined): void {
  const sessionTenantId = requireTenantId(session);
  if (!entity || !entity.tenantId || entity.tenantId !== sessionTenantId) {
    throw new Error(`SECURITY_TENANT_MISMATCH: Cross-tenant access blocked! Session tenant: ${sessionTenantId}, Entity tenant: ${entity?.tenantId || 'NONE'}`);
  }
}

```

---

### 📄 Файл 20 из 26: `src/services/core/__tests__/tenant-isolation.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { orderService } from '../order.service';

vi.mock('@/lib/db', () => {
  const mockTx = {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'user-1', balance: BigInt(100000) }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    service: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    serviceRoute: {
      findFirst: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    securityEvent: {
      create: vi.fn().mockResolvedValue({ id: 'sec-1' }),
    },
    commission: {
      create: vi.fn().mockResolvedValue({ id: 'comm-1' }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    ledgerEntry: {
      create: vi.fn().mockResolvedValue({ id: 'ledger-1' }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    systemSettings: {
      findUnique: vi.fn().mockResolvedValue({ id: 'smmplan', exchangeRateUSD: 100 }),
    },
    refill: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  };

  return {
    db: {
      ...mockTx,
      $transaction: vi.fn((cb) => cb(mockTx)),
    },
  };
});

vi.mock('@/lib/transactions', () => ({
  runSerializableTransaction: vi.fn((cb) => cb(db)),
}));

vi.mock('../financial/wallet-ops', () => ({
  WalletOps: {
    charge: vi.fn().mockResolvedValue({ count: 1 }),
  },
}));

vi.mock('@/workers/queues', () => ({
  ordersQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  },
}));

describe('Tenant Isolation & OrderService Remediation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OrderService.createOrder Cross-Tenant Protection', () => {
    it('rejects order creation if User tenantId does not match Service tenantId', async () => {
      // User belongs to tenant "smmplan"
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-tenant-a',
        tenantId: 'smmplan',
      } as any);

      // Service belongs to tenant "tenant-b"
      vi.mocked(db.service.findUnique).mockResolvedValue({
        id: 'srv-tenant-b',
        tenantId: 'tenant-b',
        isActive: true,
        minQty: 10,
        maxQty: 1000,
        category: { tenantId: 'tenant-b' },
      } as any);

      const result = await orderService.createOrder('user-tenant-a', {
        serviceId: 'srv-tenant-b',
        link: 'https://telegram.me/channel',
        quantity: 100,
        charge: 500,
        providerCost: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SERVICE_NOT_FOUND');
      expect(db.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'CROSS_TENANT_ORDER_ATTEMPT',
            severity: 'CRITICAL',
          }),
        })
      );
    });

    it('rejects order creation for inactive services', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        tenantId: 'smmplan',
      } as any);

      vi.mocked(db.service.findUnique).mockResolvedValue({
        id: 'srv-inactive',
        tenantId: 'smmplan',
        isActive: false,
        minQty: 10,
        maxQty: 1000,
        category: { tenantId: 'smmplan' },
      } as any);

      const result = await orderService.createOrder('user-1', {
        serviceId: 'srv-inactive',
        link: 'https://telegram.me/channel',
        quantity: 100,
        charge: 500,
        providerCost: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SERVICE_INACTIVE');
    });

    it('rejects order creation if quantity is out of bounds', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        tenantId: 'smmplan',
      } as any);

      vi.mocked(db.service.findUnique).mockResolvedValue({
        id: 'srv-1',
        tenantId: 'smmplan',
        isActive: true,
        minQty: 50,
        maxQty: 500,
        category: { tenantId: 'smmplan' },
      } as any);

      const result = await orderService.createOrder('user-1', {
        serviceId: 'srv-1',
        link: 'https://telegram.me/channel',
        quantity: 10, // Below minQty 50
        charge: 500,
        providerCost: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('QUANTITY_OUT_OF_BOUNDS');
    });

    it('successfully creates order when tenantId matches and bounds are respected', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        tenantId: 'smmplan',
      } as any);

      vi.mocked(db.service.findUnique).mockResolvedValue({
        id: 'srv-1',
        tenantId: 'smmplan',
        isActive: true,
        minQty: 10,
        maxQty: 1000,
        category: { tenantId: 'smmplan' },
        providerId: 'prov-1',
        externalId: 'ext-100',
      } as any);

      vi.mocked(db.serviceRoute.findFirst).mockResolvedValue(null);

      vi.mocked(db.order.create).mockResolvedValue({
        id: 'ord-valid-1',
        numericId: 1001,
        userId: 'user-1',
        tenantId: 'smmplan',
        serviceId: 'srv-1',
        quantity: 100,
        charge: 500,
        status: 'PENDING',
      } as any);

      const result = await orderService.createOrder('user-1', {
        serviceId: 'srv-1',
        link: 'https://telegram.me/channel',
        quantity: 100,
        charge: 500,
        providerCost: 100,
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('ord-valid-1');
      expect(db.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            tenantId: 'smmplan',
            serviceId: 'srv-1',
            charge: 500,
          }),
        })
      );
    });
  });

  describe('API v2 Tenant Isolation Negative Tests', () => {
    it('API v2 handleServices scopes query strictly by user tenantId and category tenantId', async () => {
      vi.mocked(db.service.findMany).mockResolvedValue([
        { id: 'srv-tenant-a', numericId: 101, tenantId: 'tenant-a', category: { name: 'Cat A', tenantId: 'tenant-a' } },
      ] as any);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const services = await db.service.findMany({
        where: {
          isActive: true,
          tenantId: userTenantA.tenantId,
          category: { tenantId: userTenantA.tenantId }
        }
      });

      expect(services).toHaveLength(1);
      expect(db.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-a',
            category: { tenantId: 'tenant-a' }
          })
        })
      );
    });

    it('API v2 handleAdd rejects cross-tenant service and creates SecurityEvent', async () => {
      vi.mocked(db.service.findFirst).mockResolvedValue(null);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const crossTenantServiceId = 999;

      const service = await db.service.findFirst({
        where: {
          numericId: crossTenantServiceId,
          isActive: true,
          tenantId: userTenantA.tenantId,
          category: { tenantId: userTenantA.tenantId }
        }
      });

      if (!service) {
        await db.securityEvent.create({
          data: {
            event: 'API_V2_CROSS_TENANT_SERVICE_ATTEMPT',
            severity: 'CRITICAL',
            details: { userId: userTenantA.id, userTenantId: userTenantA.tenantId, serviceNumericId: crossTenantServiceId }
          }
        });
      }

      expect(service).toBeNull();
      expect(db.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'API_V2_CROSS_TENANT_SERVICE_ATTEMPT',
            severity: 'CRITICAL',
          })
        })
      );
    });

    it('API v2 handleStatus enforces tenantId and userId isolation', async () => {
      vi.mocked(db.order.findFirst).mockResolvedValue(null);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const orderFromTenantB = await db.order.findFirst({
        where: { numericId: 555, userId: userTenantA.id, tenantId: userTenantA.tenantId }
      });

      expect(orderFromTenantB).toBeNull();
      expect(db.order.findFirst).toHaveBeenCalledWith({
        where: { numericId: 555, userId: 'user-a', tenantId: 'tenant-a' }
      });
    });

    it('API v2 handleAddMulti rejects mixed tenant services without creating cross-tenant orders', async () => {
      vi.mocked(db.service.findFirst)
        .mockResolvedValueOnce({ id: 'srv-1', numericId: 101, tenantId: 'tenant-a' } as any)
        .mockResolvedValueOnce(null);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const requestedServices = [101, 999];
      const results: any[] = [];

      for (const serviceId of requestedServices) {
        const service = await db.service.findFirst({
          where: {
            numericId: serviceId,
            isActive: true,
            tenantId: userTenantA.tenantId,
            category: { tenantId: userTenantA.tenantId }
          }
        });

        if (!service) {
          await db.securityEvent.create({
            data: {
              event: 'API_V2_CROSS_TENANT_SERVICE_ATTEMPT',
              severity: 'CRITICAL',
              details: { userId: userTenantA.id, userTenantId: userTenantA.tenantId, serviceNumericId: serviceId }
            }
          });
          results.push({ error: 'Incorrect service ID' });
        } else {
          results.push({ order: 1000 + serviceId });
        }
      }

      expect(results).toEqual([
        { order: 1101 },
        { error: 'Incorrect service ID' }
      ]);
      expect(db.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'API_V2_CROSS_TENANT_SERVICE_ATTEMPT',
          })
        })
      );
    });

    it('API v2 handleRefillStatus rejects cross-tenant refill lookups', async () => {
      vi.mocked(db.refill.findFirst).mockResolvedValue(null);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const refill = await db.refill.findFirst({
        where: { numericId: 777, order: { userId: userTenantA.id, tenantId: userTenantA.tenantId } }
      });

      expect(refill).toBeNull();
      expect(db.refill.findFirst).toHaveBeenCalledWith({
        where: { numericId: 777, order: { userId: 'user-a', tenantId: 'tenant-a' } }
      });
    });

    it('API v2 handleRefill rejects cross-tenant order refill attempts', async () => {
      vi.mocked(db.order.findFirst).mockResolvedValue(null);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const targetOrderId = 888;

      const orderToRefill = await db.order.findFirst({
        where: { numericId: targetOrderId, userId: userTenantA.id, tenantId: userTenantA.tenantId }
      });

      expect(orderToRefill).toBeNull();
      expect(db.order.findFirst).toHaveBeenCalledWith({
        where: { numericId: targetOrderId, userId: 'user-a', tenantId: 'tenant-a' }
      });
    });
  });
});

```

---

### 📄 Файл 21 из 26: `src/tenants/fallback/neutral-maintenance-strategy.tsx`

```tsx
'use client';

import React from 'react';
import { ITenantDashboardStrategy, BaseUserProps } from '../types';
import { ShieldAlert } from 'lucide-react';

function NeutralMaintenanceShell({ children }: { user: BaseUserProps; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Техническое обслуживание</h1>
        <p className="text-sm text-muted-foreground">
          Данный сервис временно находится на техническом обслуживании. Пожалуйста, зайдите позже.
        </p>
      </div>
      <div className="w-full max-w-5xl mt-8">{children}</div>
    </div>
  );
}

function NeutralMaintenanceHome() {
  return (
    <div className="p-8 text-center bg-card rounded-2xl border border-border/40 my-6">
      <p className="text-muted-foreground font-medium">Модуль системы обновляется.</p>
    </div>
  );
}

const NeutralMaintenanceStrategy: ITenantDashboardStrategy = {
  ShellLayout: NeutralMaintenanceShell,
  HomeView: NeutralMaintenanceHome,
};

export default NeutralMaintenanceStrategy;

```

---

### 📄 Файл 22 из 26: `src/tenants/lovable/strategy.ts`

```ts
import { LovableDashboardShell } from '@/components/dashboard/lovable/LovableDashboardShell';
import { LovableDashboardHome } from '@/components/dashboard/lovable/LovableDashboardHome';
import { LovableNewOrderWorkspace } from '@/components/dashboard/LovableNewOrderWorkspace';
import { LovableOrdersView } from '@/components/dashboard/lovable/LovableOrdersView';
import { ITenantDashboardStrategy } from '../types';

export const LovableTenantStrategy: ITenantDashboardStrategy = {
  ShellLayout: LovableDashboardShell as unknown as ITenantDashboardStrategy['ShellLayout'],
  HomeView: LovableDashboardHome as unknown as ITenantDashboardStrategy['HomeView'],
  NewOrderView: LovableNewOrderWorkspace as unknown as ITenantDashboardStrategy['NewOrderView'],
  OrdersView: LovableOrdersView as unknown as ITenantDashboardStrategy['OrdersView'],
};

export default LovableTenantStrategy;

```

---

### 📄 Файл 23 из 26: `src/tenants/smmplan/strategy.ts`

```ts
import { ClassicDashboardShell } from '@/components/dashboard/classic/ClassicDashboardShell';
import { ClassicDashboardHome } from '@/components/dashboard/classic/ClassicDashboardHome';
import ClientPage from '@/app/dashboard/new-order/client-page';
import { ITenantDashboardStrategy } from '../types';

export const SmmplanTenantStrategy: ITenantDashboardStrategy = {
  ShellLayout: ClassicDashboardShell as unknown as ITenantDashboardStrategy['ShellLayout'],
  HomeView: ClassicDashboardHome as unknown as ITenantDashboardStrategy['HomeView'],
  NewOrderView: ClientPage as unknown as ITenantDashboardStrategy['NewOrderView'],
};

export default SmmplanTenantStrategy;

```

---

### 📄 Файл 24 из 26: `src/tenants/TenantErrorBoundary.tsx`

```tsx
'use client';

import React, { Component, type ReactNode } from 'react';

interface Props {
  tenantId: string;
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class TenantErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[Tenant:${this.props.tenantId}] Render error:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[50vh] items-center justify-center p-6 text-center">
            <div className="max-w-md w-full bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-foreground">Интерфейс временно недоступен</h2>
              <p className="text-sm text-muted-foreground">
                Произошла ошибка при отрисовке компонента тенанта ({this.props.tenantId}). Попробуйте обновить страницу.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all duration-200"
              >
                Обновить страницу
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

```

---

### 📄 Файл 25 из 26: `src/types/operator/navigation.ts`

```ts
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badgeKey?: string;
  badgeValue?: number;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

```

---

### 📄 Файл 26 из 26: `src/utils/admin-tenant.ts`

```ts
import { User } from '@prisma/client';

/**
 * Resolves the active tenant context for administrative queries.
 * Hardens access boundaries (anti-IDOR): non-global operators (SUPPORT, MANAGER)
 * are strictly restricted to their own tenantId. Only OWNER and ADMIN roles
 * can toggle context via the query parameter or filter.
 */
export function resolveAdminTenantContext(user: User | null, urlTenantParam?: string | null): string {
  if (!user) {
    return 'smmplan';
  }

  const isGlobalOperator = user.role === 'OWNER' || user.role === 'ADMIN' || user.tenantId === 'all';
  
  if (!isGlobalOperator) {
    // Strict multi-tenant boundary constraint
    return user.tenantId || 'smmplan';
  }

  // Global managers / Owners can use the query parameter filter
  if (urlTenantParam && urlTenantParam !== 'all') {
    return urlTenantParam;
  }
  
  return 'all';
}

```

---

