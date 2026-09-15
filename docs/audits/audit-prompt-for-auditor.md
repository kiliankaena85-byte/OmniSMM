# 📋 Чек-лист и последовательность проведения аудита для внешнего ИИ (GLM-5.2 / Claude)

## Что передается аудитору:
1. **Стек технологий**: Next.js 16.0.10 (App Router), React 19.0.0, Tailwind CSS 4.0.0, HeroUI v3, Prisma 5 (PostgreSQL).
2. **Список файлов для аудита**:
   - `src/utils/target-type.ts`
3. **Контекст схемы базы данных (Prisma Schema)**: Для точной верификации связей, транзакций и ограничений БД.
4. **Пользовательские инструкции**: Специализированные требования к проверке (Race Conditions, лимиты, бизнес-логика).

---

## 🚀 Пошаговая последовательность выполнения аудита:

1. **Шаг 1. Передача данных**:
   Скопируйте весь текст из этого файла (`audit-prompt-for-auditor.md`) и отправьте его внешнему ИИ-аудитору (GLM-5.2, Claude 3.5 Sonnet или аналогичному).
   
2. **Шаг 2. Запуск проверки в ИИ**:
   Убедитесь, что ИИ-аудитор ответил подробным структурированным Markdown-отчетом с перечислением:
   - Критических уязвимостей (Race Conditions, утечки, права доступа).
   - Логических ошибок (несоответствие конвенциям Next.js 16, пустые catch).
   - Четких рекомендаций с кодовыми примерами исправления.

3. **Шаг 3. Сохранение отчета**:
   Скопируйте markdown-ответ внешнего аудитора целиком и сохраните его в файл `auditor-review-report.md` в корневом каталоге проекта.

4. **Шаг 4. Автоматическое исправление (Снова запуск Maker)**:
   Отправьте команду `Исправь ошибки по отчету аудитора` вашему основному ИИ-разработчику (Antigravity). Он автоматически считает файл `auditor-review-report.md`, применит точечные исправления (Surgeon-паттерн) и проверит кодовую базу.


---
---

# 🕵️ Промпт для ИИ-Аудитора (Скопируйте текст ниже):

Вы выступаете в роли ведущего эксперта по безопасности (DevSecOps) и архитектора ПО.
Вам передан исходный код веб-приложения SMM-панели (Next.js 16, React 19, Prisma, PostgreSQL).
Ваша задача — провести глубокий внешний аудит предоставленного кода.

Критерии анализа:
1. Безопасность и уязвимости (OWASP Top 10, утечки секретов, права доступа в Server Actions).
2. Логическая целостность (целостность транзакций Prisma, защита баланса пользователей, Race Conditions).
3. Структурная архитектура (соответствие конвенциям Server Component, Next.js 16).
4. Ошибки обработки исключений (пустые блоки catch, отсутствие логирования).

Предоставьте подробный отчет в формате Markdown с перечислением найденных дефектов и конкретными рекомендациями по их исправлению.

---

## Пользовательские инструкции для проверки:
Проведи аудит безопасности, логики и структуры этого кода. Найди Race Conditions, уязвимости авторизации и пустые catch-блоки.

---

## Код для анализа:
### FILE: src/utils/target-type.ts
```typescript
/**
 * Infers the correct targetType from a category name.
 * Used as a safety net when `service.targetType` is missing or defaulted to 'POST'.
 *
 * IMPORTANT: This mapping MUST stay in sync with SmartAnalyzerLogic.detectSync()
 * in src/services/providers/smart-analyzer.logic.ts (lines 384-427).
 */

const CHANNEL_KEYWORDS = [
  'подписчик', 'участник', 'subscriber', 'follower',
  'буст', 'boost',
  'груп', 'group',
  'друз', 'friend',
  'premium', 'премиум участ',
  'автопросмотр', 'автолайк', 'автореакци', 'авторепост', 'автокоммент',
  'массовые просмотры', 'просмотры массовых', 'auto', 'future view',
];

const STORY_KEYWORDS = [
  'стори', 'story', 'stories', 'истори',
];

const CUSTOM_KEYWORDS = [
  'звёзд', 'звезд', 'star',
];

/**
 * Determines targetType based on category name keywords.
 * Falls back to 'POST' only for engagement metrics (likes, views, comments, etc.).
 */
export function inferTargetTypeFromCategory(categoryName: string | null | undefined): string {
  if (!categoryName) return 'POST';

  const lower = categoryName.toLowerCase();

  if (CHANNEL_KEYWORDS.some(k => lower.includes(k))) return 'CHANNEL';
  if (STORY_KEYWORDS.some(k => lower.includes(k))) return 'STORY';
  if (CUSTOM_KEYWORDS.some(k => lower.includes(k))) return 'CUSTOM';

  // Engagement categories: likes, views, comments, reactions, reposts → POST
  return 'POST';
}

```



### DATABASE SCHEMA CONTEXT (Prisma Schema):
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
}

model ApiConfig {
  id               String  @id @default(cuid())
  userId           String  @unique
  user             User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  isApiEnabled            Boolean @default(true)
  prioritySupport  Boolean @default(true) // Выделение и приоритетная поддержка
  webhookUrl       String? // Webhook URL для синхронизации тикетов
  webhookSecret    String? // Секретный ключ подписи вебхуков API
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
  categories  Category[]
  urlPatterns UrlPattern[] // Link detection patterns
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
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
  sort           Int       @default(0)
  requireWarning Boolean   @default(false)
  warningMessage String?
  services       Service[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([networkId])
}

model Service {
  id               String    @id @default(cuid())
  numericId        Int       @unique @default(autoincrement())
  name             String
  description      String? // Public SEO description (shown to clients)
  features         Json? // Structured metadata extracted by AI (geo, speed, warranty)
  categoryId       String
  category         Category  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
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

  requireWarning    Boolean  @default(false)
  warningMessage    String?
  isActive          Boolean  @default(true)
  pricePer1000Cents Int      @default(0) // Denormalized price for sorting (rate * markup * exchangeRate)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  orders         Order[]
  routes         ServiceRoute[]
  smartCampaigns SmartCampaign[]
  smartConfig    ServiceSmartConfig?
  priceHistory   ServicePriceHistory[]

  @@index([categoryId])
  @@index([providerId])
  @@index([isQuarantined])
  @@index([externalId])
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

  @@index([userId])
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

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([gatewayId])
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

model SystemSettings {
  id              String    @id @default("global")
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

  @@index([userId])
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

```
