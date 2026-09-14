# Software Design Document: Link Edge Cases, Multi-Category Engine & Dynamic Checkout Architecture
**Project**: SMMplan / SMMflux (OmniSMM 1.0 Enterprise Core)  
**Standard**: RAC-2026 / SDD-TDD 2026 / ExactMath & Security Invariants  
**Document Identifier**: `docs/specs/SPEC-2026-LINK-EDGE-CASES.md`  
**Classification**: Tier 1 Core Architecture Specification  
**Status**: Authoritative & Approved for Implementation (Zero Placeholders, Zero TODOs)  

---

## 1. Title & Executive Architectural Summary

### 1.1. Purpose & Domain Scope
This specification formalizes the architectural contracts, validation invariants, taxonomic edge cases, and wizard orchestration state machine for the URL ingestion and order creation pipeline across the OmniSMM 1.0 platform (powering `smmplan.pro` and `smmflux.ru`).

The system bridges client input across multiple entry points (responsive web wizard, mobile-first stepper, desktop master catalog, Telegram mini-app, and external API v2) with a resilient, defense-in-depth processing pipeline. It guarantees:
1. **Semantic Link Compatibility**: Guarantees links strictly match the operational capability of the selected social media service (e.g. channel link vs post views).
2. **Intent Disambiguation**: Deterministically resolves multi-category applicability (1 link $\to$ $N$ categories) without blind guessing.
3. **Structured Custom Data Payloads**: Replaces loose, unvalidated text with type-safe, sanitized Zod DTO contracts (`comments`, `reactions`, `pollOption`, `usernames`, `mediaGroupUrl`).
4. **Security & Financial Integrity**: Hardens against Server-Side Request Forgery (SSRF), Regular Expression Denial of Service (ReDoS), Cross-Site Scripting (XSS), Prohibited Content (54-FZ), and Ledger Transaction Escape (`ExactMath`).
5. **Zero-Defect Bug Remediation**: Formulates definitive structural fixes for the 4 critical checkout bugs identified in the 2026 architectural survey (Bug A, Bug B, Bug C, Bug D).

### 1.2. Architecture Component Map
```
[Client Web / Mobile Wizard / API v2]
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  src/services/link-engine/unified-link-engine.ts       │
│  ├── LinkDomainRouter (O(1) Domain & Subdomain Map)    │
│  ├── LinkCanonicalizer (Strip tracking, keep routing)  │
│  ├── IntelligenceLinkAnalyzer (37 platforms, AST regex)│
│  ├── SSRF Guard (isUrlSafeForFetch, RFC 1918 block)    │
│  └── Prohibited Content Guard (54-FZ gov/protest block)│
└────────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  src/utils/target-type-mapper.ts                       │
│  ├── resolveServiceTargetType (Rule 4.1 Invariant)     │
│  └── normalizeTargetType / inferTargetTypeFromName     │
└────────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  src/constants/link-service-compatibility.ts           │
│  ├── COMPATIBILITY_MAP (LinkType <-> ServiceTargetType)│
│  └── getCompatibilityError (Educational User Guidance) │
└────────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  src/schemas/custom-data.ts (NEW)                      │
│  ├── OrderCustomDataSchema (Discriminated Union DTO)   │
│  └── Comments / Poll / Reactions / Mentions Validators │
└────────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  src/actions/order/checkout.ts & order.processor.ts    │
│  ├── ExactMath (BigInt kopecks & Ledger Entry)         │
│  ├── Dual Order Atomic Split (Telegram Albums)         │
│  └── Provider Adapter Dispatch (Normalized params)     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Requirement R1: Taxonomic Edge Cases Matrix Summary

The exhaustive platform taxonomy across all 37 supported social platforms, media networks, and web traffic vectors is codified in the companion document:
👉 **[`docs/specs/LINK_EDGE_CASES_MATRIX.md`](file:///c:/Users/Shadow/Documents/SMM/docs/specs/LINK_EDGE_CASES_MATRIX.md)**.

### 2.1. Summary of the 5 Core Dimensions & Criticalities

```
┌────────────────────────┬─────────────┬────────────────────────────────────────────────────────────────┐
│ Dimension              │ Criticality │ Core Engineering Invariant                                     │
├────────────────────────┼─────────────┼────────────────────────────────────────────────────────────────┤
│ 1. Multi-Category      │ Major (P2)  │ 1 link -> N categories must NOT reset to blank. Render         │
│    Applicability       │             │ contextual intent chips ([Подписчики], [Бусты], [Автопросмотры])│
├────────────────────────┼─────────────┼────────────────────────────────────────────────────────────────┤
│ 2. Auto & Subscription │ Major (P2)  │ Enforce Drip-Feed Floor: floor(Q/N) >= minQty. Support provider│
│    Services            │             │ subscriptions with min, max, posts, delay schema.              │
├────────────────────────┼─────────────┼────────────────────────────────────────────────────────────────┤
│ 3. Closed & Private    │ Critical(P1)│ Reject Telegram /c/ posts. Scope Telegram +invite to CHANNEL.  │
│    Entities            │             │ Require JIT toggle "Профиль открыт" for private Instagram/VK.  │
├────────────────────────┼─────────────┼────────────────────────────────────────────────────────────────┤
│ 4. Dynamic Custom      │ Critical(P1)│ Auto-sync textarea line count with Quantity (Q = lines.length).│
│    Input Fields        │             │ Validate poll options (1..20). Standardize max length to 5,000.│
├────────────────────────┼─────────────┼────────────────────────────────────────────────────────────────┤
│ 5. Platform URL        │ Critical(P1)│ Canonicalize YouTube Shorts to /watch?v=. Rule of Two Orders:  │
│    Edge Cases          │             │ Telegram albums create 2 orders (first + last photo) in 1 tx.  │
└────────────────────────┴─────────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2. Query Parameter Preservation vs Stripping Standard
To prevent provider API rejections while preserving deep-link targets:
- **Blacklisted (Always Stripped)**: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `igsh`, `igshid`, `fbclid`, `gclid`, `yclid`, `ttref`, `si`, `feature`, `t`, `ref`, `_hsenc`, `_hsmi`, `mc_cid`.
- **Whitelisted (Strictly Preserved)**:
  - `v` (YouTube video identifier on `/watch`)
  - `lc` (YouTube linked comment ID for comment upvotes)
  - `comment` (Telegram channel post discussion comments)
  - `single` (Telegram media group individual photo selection)
  - `start` (Telegram bot referral/payload parameter)
  - `reply` (VKontakte wall post and video comment reply ID)
  - `i` (Apple Music track ID within album URLs)

---

## 3. Requirement R2: Interactive User Elicitation Summary & Decision Register

The complete interactive elicitation questionnaire, scenario forks, behavioral options, and pre-mortem blast radius analysis are codified in:
👉 **[`docs/specs/USER_ELICITATION_GUIDE.md`](file:///c:/Users/Shadow/Documents/SMM/docs/specs/USER_ELICITATION_GUIDE.md)**.

### 3.1. Master Architectural Decision Register

| Ref # | Domain Scenario | Approved Architectural Decision | Implementation Mechanism |
|:---|:---|:---|:---|
| **DEC-01** | Telegram Channel (1 $\to$ N) | **Option C: Contextual Intent Chips** | Step 1.5 renders chips: `[Подписчики]` `[Авто-просмотры]` `[Бусты]` `[Авто-реакции]`. |
| **DEC-02** | Telegram Post (1 $\to$ N) | **Option B: Interaction Type Selector** | Step 2 renders interaction chips: `[Просмотры]` `[Реакции]` `[Комментарии]` `[Голоса]`. |
| **DEC-03** | Telegram Private Post (`/c/`) | **Option B: Hard Reject + Guidance Modal** | Fail-closed validation with actionable help modal: *"Сделайте канал публичным"*. |
| **DEC-04** | Telegram Private Invite (`+hash`) | **Option B: Scope to Channel + JIT Toggle** | Restrict to `CHANNEL` targets; require toggle confirming join requests are disabled. |
| **DEC-05** | Private Instagram / VK Profiles | **Option B: Mandatory JIT Checkbox** | Checkbox: `[x] Подтверждаю, что аккаунт публичный (открытый)`. |
| **DEC-06** | Discord Invites | **Option C: Format Check + Expiry Warning** | Validate invite code syntax; render warning to use permanent invite links. |
| **DEC-07** | Custom Comments Sync | **Option B: Bidirectional Line Auto-Sync** | Stepper locks to `lines.length`. Real-time dynamic recalculation of price in kopecks. |
| **DEC-08** | Reactions & Emojis | **Option B: Interactive Emoji Picker** | Visual multi-select emoji grid with JSON serialization `{"reactions": ["👍", "🔥"]}`. |
| **DEC-09** | Poll / Survey Votes | **Option A: Strict Number Input (1–20)** | Integer input field mapped to provider payload parameter `answer_number`. |
| **DEC-10** | Drip-Feed vs Subscriptions | **Option B: Dual-Track Architecture** | Standard services use internal BullMQ Drip-feed; subscription services use `min/max/posts`. |
| **DEC-11** | Livestream Services | **Option B: Mandatory Live-Check Toggle** | Active stream toggle: `[x] Подтверждаю, что стрим сейчас онлайн`. |
| **DEC-12** | Telegram Albums (Carousels) | **Option B: Automated Dual Order Pairing** | Step 4 toggle adds `mediaGroupUrl`. Atomic transaction creates 2 orders for $2 \times \text{Price}$. |
| **DEC-13** | YouTube Shorts & Tracking | **Option B & C: Rewrite to `/watch?v=`** | Auto-rewrite `/shorts/` to `/watch?v=`; strip tracking tokens, preserve `v` and `lc`. |

---

## 4. Requirement R3: Zod DTO Schemas & TypeScript Contracts

To replace unstructured text in `Order.customData`, OmniSMM 1.0 establishes a formal, type-safe Zod schema suite in `src/schemas/custom-data.ts`.

### 4.1. Contract Definitions (`src/schemas/custom-data.ts`)

```typescript
import { z } from 'zod';

/**
 * Strips ASCII control characters (\x00-\x08, \x0B, \x0C, \x0E-\x1F, \x7F)
 * but explicitly preserves standard newlines (\n, \r) and tabs (\t).
 */
const sanitizeControlChars = (val: string): string =>
  val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

/**
 * Basic Unicode Emoji Validator.
 * Matches standard emoji sequences, skin tone modifiers, and zero-width joiners.
 */
const EMOJI_REGEX = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component})+$/u;

/**
 * Valid handle format: alphanumeric, underscore, dot, optional leading @.
 */
const USERNAME_REGEX = /^@?[a-zA-Z0-9_.]{3,32}$/;

// -----------------------------------------------------------------------------
// Sub-Schemas
// -----------------------------------------------------------------------------

export const CommentsCustomDataSchema = z.object({
  kind: z.literal('COMMENTS'),
  lines: z
    .array(
      z
        .string()
        .transform(val => sanitizeControlChars(val.trim()))
        .refine(val => val.length > 0, { message: 'Строка комментария не может быть пустой' })
        .refine(val => val.length <= 500, { message: 'Длина одного комментария не должна превышать 500 символов' })
    )
    .min(1, 'Необходимо указать хотя бы один комментарий')
    .max(1000, 'Максимальное количество комментариев — 1 000 строк'),
});

export const ReactionsCustomDataSchema = z.object({
  kind: z.literal('REACTIONS'),
  emojis: z
    .array(
      z
        .string()
        .trim()
        .refine(
          val => EMOJI_REGEX.test(val) || /^\d{15,22}$/.test(val), // Allows custom Telegram Document IDs
          { message: 'Некорректный символ реакции или ID эмодзи' }
        )
    )
    .min(1, 'Выберите хотя бы одну реакцию')
    .max(10, 'Максимум 10 реакций одновременно'),
});

export const PollCustomDataSchema = z.object({
  kind: z.literal('POLL'),
  optionIndex: z
    .number()
    .int('Номер ответа должен быть целым числом')
    .min(1, 'Минимальный номер ответа — 1')
    .max(20, 'Максимальный номер ответа — 20'),
  optionText: z
    .string()
    .max(100, 'Текст ответа не должен превышать 100 символов')
    .transform(val => sanitizeControlChars(val.trim()))
    .optional(),
});

export const MentionsCustomDataSchema = z.object({
  kind: z.literal('MENTIONS'),
  usernames: z
    .array(
      z
        .string()
        .transform(val => val.trim().replace(/^@/, ''))
        .refine(val => USERNAME_REGEX.test(val), { message: 'Некорректный логин пользователя' })
    )
    .min(1, 'Укажите хотя бы одного пользователя')
    .max(500, 'Максимум 500 пользователей в списке'),
  hashtag: z
    .string()
    .max(50, 'Хэштег не должен превышать 50 символов')
    .transform(val => val.trim().replace(/^#/, ''))
    .optional(),
});

export const MediaGroupCustomDataSchema = z.object({
  kind: z.literal('MEDIA_GROUP'),
  firstPostUrl: z.string().url('Некорректная ссылка на первое медиа'),
  lastPostUrl: z.string().url('Некорректная ссылка на последнее медиа'),
});

export const SubscriptionCustomDataSchema = z.object({
  kind: z.literal('SUBSCRIPTION'),
  minPerPost: z.number().int().min(1, 'Минимум на пост — 1'),
  maxPerPost: z.number().int().min(1, 'Максимум на пост — 1'),
  futurePosts: z.number().int().min(1).max(100, 'Максимум 100 будущих публикаций'),
  delayMinutes: z.number().int().min(0).max(1440).default(0),
});

// -----------------------------------------------------------------------------
// Unified Order Custom Data Discriminated Union
// -----------------------------------------------------------------------------

export const OrderCustomDataSchema = z.discriminatedUnion('kind', [
  CommentsCustomDataSchema,
  ReactionsCustomDataSchema,
  PollCustomDataSchema,
  MentionsCustomDataSchema,
  MediaGroupCustomDataSchema,
  SubscriptionCustomDataSchema,
]);

export type OrderCustomData = z.infer<typeof OrderCustomDataSchema>;
export type CommentsCustomData = z.infer<typeof CommentsCustomDataSchema>;
export type ReactionsCustomData = z.infer<typeof ReactionsCustomDataSchema>;
export type PollCustomData = z.infer<typeof PollCustomDataSchema>;
export type MentionsCustomData = z.infer<typeof MentionsCustomDataSchema>;
export type MediaGroupCustomData = z.infer<typeof MediaGroupCustomDataSchema>;
export type SubscriptionCustomData = z.infer<typeof SubscriptionCustomDataSchema>;

/**
 * Serializes OrderCustomData into a database-safe JSON string
 * with total size bounded at 5,000 characters.
 */
export function serializeCustomData(data: OrderCustomData): string {
  const json = JSON.stringify(data);
  if (json.length > 5000) {
    throw new Error('Сериализованные пользовательские данные превышают лимит в 5000 символов');
  }
  return json;
}

/**
 * Safely parses database customData string into strongly-typed OrderCustomData.
 * Falls back gracefully to legacy COMMENTS or POLL parsing if string is not JSON.
 */
export function parseCustomData(raw: string | null | undefined): OrderCustomData | null {
  if (!raw || raw.trim().length === 0) return null;
  const trimmed = raw.trim();

  // 1. Attempt standard JSON parsing
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const result = OrderCustomDataSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // Continue to fallback
    }
  }

  // 2. Legacy numeric poll fallback
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    if (num >= 1 && num <= 20) {
      return { kind: 'POLL', optionIndex: num };
    }
  }

  // 3. Legacy multiline comments fallback
  const lines = trimmed
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length > 0) {
    return { kind: 'COMMENTS', lines };
  }

  return null;
}
```

---

## 5. 4-Step Order Wizard State Machine & Bug Remediation

### 5.1. State Machine Transitions & Invariants

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ STATE 1: LINK INTAKE & CANONICALIZATION                                        │
│   • Trigger: User pastes/types URL in #standard-url-input                      │
│   • Invariant: Length <= 2048 chars, SSRF Check (isUrlSafeForFetch)            │
│   • Action: Strip tracking query parameters, normalize aliases                 │
│   • Transition: If valid -> Advance to State 2 (or State 1.5 if N > 1)        │
└──────────────────────────────────────┬─────────────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ STATE 2: INTENT DISAMBIGUATION & CATEGORY FILTERING                            │
│   • Condition:                                                                 │
│     - If N == 1 matching category: Auto-select, skip directly to State 3.      │
│     - If N > 1: Render Intent Selector Card ([Подписчики], [Бусты], etc.).     │
│   • Invariant: resolveServiceTargetType(service) prevents @default("POST") bug │
│   • Transition: On category selection -> Advance to State 3                   │
└──────────────────────────────────────┬─────────────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ STATE 3: TARIFF & QUALITY FILTERING                                            │
│   • Display: CRO Rule of 3 (Economy, Hit, Premium) with expandable catalog     │
│   • Invariant: Cooldown quarantine check (cooldownUntil > now blocks clicks)   │
│   • Compatibility: isLinkServiceCompatible(linkType, serviceTargetType)        │
│   • Transition: On tariff card click -> Advance to State 4                     │
└──────────────────────────────────────┬─────────────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ STATE 4: PARAMETERS, CUSTOM DATA, LEDGER & CHECKOUT                            │
│   • Invariants:                                                                │
│     1. ExactMath: BigInt kopecks calculation (ExactMath.calculateOrderCost)   │
│     2. Drip-Feed Floor: floor(Q / runs) >= service.minQty                      │
│     3. Custom Data Sync: Q == comments.lines.length (for COMMENTS)             │
│     4. Idempotency Key: Unique UUID generated per checkout attempt             │
│     5. Ledger First: tx.ledgerEntry.create() precedes user.update()            │
│   • Transition: On CTA click -> checkoutAction -> executePaymentRedirect       │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.2. Definitive Code Fixes for Discovered Bugs (Bugs A through D)

#### 🚨 FIX BUG A: Parameter Loss in `confirmAndPay` (`useCheckoutOrchestrator.ts`)
- **Problem**: When a user selected a payment method inside `PaymentGatewaySelectionModal`, lines 548–559 in `src/components/landing/order-engine/useCheckoutOrchestrator.ts` omitted `customData`, `promoCodeStr`, `mediaGroupUrl`, `isSmartDrip`, `smartDripDays`, and `abVariant` when invoking `checkoutAction`.
- **Authoritative Fix**: Update `confirmAndPay` to forward all pending checkout properties:

```typescript
// File: src/components/landing/order-engine/useCheckoutOrchestrator.ts
// Replace lines 548-559 with:
const { checkoutAction } = await import('@/actions/order/checkout');
const res = await checkoutAction({
  email: pendingCheckoutParams.email || "",
  link: pendingCheckoutParams.link || "",
  quantity: pendingCheckoutParams.quantity || 0,
  serviceId: pendingCheckoutParams.serviceId || "",
  customData: pendingCheckoutParams.customData,
  promoCodeStr: pendingCheckoutParams.promoCodeStr,
  mediaGroupUrl: pendingCheckoutParams.mediaGroupUrl,
  isSmartDrip: pendingCheckoutParams.isSmartDrip,
  smartDripDays: pendingCheckoutParams.smartDripDays,
  runs: pendingCheckoutParams.runs,
  interval: pendingCheckoutParams.interval,
  idempotencyKey: pendingCheckoutParams.idempotencyKey,
  isLinkOverridden: pendingCheckoutParams.isLinkOverridden,
  isRequirementsConfirmed: pendingCheckoutParams.isRequirementsConfirmed,
  abVariant: pendingCheckoutParams.abVariant,
  gateway
});
```

---

#### 🚨 FIX BUG B: Total Absence of `customData` Input in Mobile Step 4
- **Problem**: `MobileCheckoutInputs.tsx` completely lacked UI input elements for custom data. Mobile users selecting comments or poll services were blocked by validation without any field on screen to enter data.
- **Authoritative Fix**: Integrate `getServiceFlags(selectedService)` into `MobileCheckoutInputs.tsx` and render the responsive textarea/input:

```tsx
// File: src/components/landing/order-engine/wizard-steps/MobileCheckoutInputs.tsx
// Insert before Email input (around line 75):
{flags.isCustomComments && (
  <div className="space-y-1.5">
    <div className="flex justify-between items-center text-xs">
      <label className="font-semibold text-foreground/90">
        Текст комментариев (по одному на строку)
      </label>
      <span className={clsx(
        "text-[11px] font-mono",
        customDataLines.length < (selectedService?.minQty || 1)
          ? "text-danger font-medium"
          : "text-muted-foreground"
      )}>
        Строк: {customDataLines.length} (мин. {selectedService?.minQty || 1})
      </span>
    </div>
    <textarea
      value={engine.customData || ''}
      onChange={(e) => {
        const text = e.target.value;
        engine.setCustomData(text);
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          engine.setQuantity(lines.length);
        }
      }}
      rows={4}
      placeholder="Напишите каждый комментарий с новой строки..."
      className="w-full text-xs font-mono p-2.5 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition resize-none"
    />
  </div>
)}

{flags.isPoll && (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-foreground/90">
      Номер варианта ответа в опросе
    </label>
    <input
      type="number"
      min={1}
      max={20}
      value={engine.customData || ''}
      onChange={(e) => engine.setCustomData(e.target.value)}
      placeholder="Например: 1 (первый ответ сверху)"
      className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
    />
  </div>
)}
```

---

#### 🚨 FIX BUG C: String Length Limit Inconsistency Across Validation Layers
- **Problem**: `checkout.ts` enforced `customData.length > 2000`, while `order.validators.ts` enforced `max(5000)` and `link-rules-registry.ts` used `max(10000)`. Valid 50-line comment orders crashed in `checkout.ts`.
- **Authoritative Fix**: Harmonize the standard maximum length to **5,000 characters** across all three layers.
  1. In `src/actions/order/checkout.ts`, line 236:
     ```typescript
     if (customData && customData.length > 5000) {
       throw new Error('Слишком длинные пользовательские данные (макс. 5000 символов)');
     }
     ```
  2. In `src/validators/order.validators.ts`, line 15:
     ```typescript
     customData: z.string().max(5000, "Слишком много текста (макс. 5000 символов)").optional()
     ```
  3. In `src/services/link-engine/link-rules-registry.ts`, line 276:
     ```typescript
     z.string().max(5000, "Текст слишком длинный (максимум 5000 символов)")
     ```

---

#### 🚨 FIX BUG D: Parameter Drop in `order-dispatch.service.ts`
- **Problem**: In `src/services/provider/order-dispatch.service.ts`, lines 89–95, `input.customData` was received in `DispatchOrderInput` but was omitted from `instance.createOrder()`.
- **Authoritative Fix**: Map `customData` based on service type before dispatching:

```typescript
// File: src/services/provider/order-dispatch.service.ts
// Replace lines 89-95 with:
const parsedCustomData = parseCustomData(input.customData);

return await instance.createOrder({
  service: input.externalServiceId,
  link: input.link,
  quantity: input.quantity,
  runs: input.runs,
  interval: input.interval,
  comments: parsedCustomData?.kind === 'COMMENTS' ? parsedCustomData.lines.join('\n') : undefined,
  answer_number: parsedCustomData?.kind === 'POLL' ? String(parsedCustomData.optionIndex) : undefined,
  usernames: parsedCustomData?.kind === 'MENTIONS' ? parsedCustomData.usernames.join('\n') : undefined,
});
```

---

## 6. Security Hardening & Concurrency Invariants

### 6.1. SSRF Protection (`src/lib/ssrf-guard.ts`)
- **Protocol Whitelist**: Strict `http:` or `https:`. Blocks `file:`, `gopher:`, `data:`, `ftp:`.
- **Loopback & RFC 1918 Block**:
  - Blocks `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `0.0.0.0/8`.
  - Blocks IPv6 `::1`, `::`, `fc00::/7` (ULA), `fe80::/10` (Link-Local).
  - Blocks AWS/GCP/Azure Cloud IMDS: `169.254.169.254`, `fd00:ec2::254`, `metadata.google.internal`.
  - Blocks IPv4-mapped IPv6 notation (`::ffff:127.0.0.1`, `::ffff:7f00:1`).
- **Short-Link Resolver Guard (`resolveShortLink`)**:
  - Whitelist: `bit.ly`, `youtu.be`, `vm.tiktok.com`, `t.co`, `cutt.ly`, `clck.ru`, `tinyurl.com`, `is.gd`.
  - Max Redirect Hops: 5.
  - DNS Resolution Verification: Checks all IP records via `dns.lookup(hostname, { all: true })` before performing HEAD requests.
  - Timeout: Strict 5000ms `AbortSignal.timeout(5000)`.

### 6.2. ReDoS Protection & Regex Auditing
- **Linear Time Complexity $O(N)$**: All regular expressions in `UNIFIED_REGEX` and `LINK_RULES` avoid nested quantifiers (`(a+)+`, `(a*)*`, `(\w+)*`).
- **Input Length Pre-Guard**: All URL strings are rejected if `url.length > 2048` prior to executing regex evaluation.
- **Continuous AST Audit**: Static AST checks in `validateRegexSafetyAndSmoke` ensure zero catastrophic backtracking risks.

### 6.3. XSS & Control Character Sanitization
- **Control Characters**: All multiline text and user comments are stripped of `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`.
- **HTML Sanitization**: All custom data rendered in Admin Dashboard or Client Receipt is sanitized via `sanitize-html` with empty allowed tags (`allowedTags: []`).
- **Memory & Payload Budgets**:
  - Request body payload cap: 100 KB.
  - Custom data payload cap: 5,000 characters.
  - Maximum comment line length: 500 characters.

### 6.4. Financial Ledger-First & ExactMath Invariants
- **BigInt ExactMath**: All order prices, discounts, and acquiring commissions computed in integer kopecks (`BigInt`). Float operations prohibited.
- **Minimum Acquiring Charge**: Minimum payment gateway charge is 1,000 kopecks (10.00 ₽). Sub-10 ₽ transactions credit excess to user balance.
- **Ledger-First Transaction**: `tx.ledgerEntry.create()` is executed **BEFORE** updating user balance (`tx.user.update({ balance: ... })`).
- **Idempotency Guard**: Unique `idempotencyKey` prevents duplicate balance deductions on rapid network retries.

---

## 7. Verification Plan & Test Vector Matrix

### 7.1. Verification Commands
```bash
# 1. Strict TypeScript compilation check (0 errors required)
npx tsc --noEmit

# 2. Run unit tests for Unified Link Engine
npx vitest run src/__tests__/unit/unified-link-engine.test.ts

# 3. Run ReDoS fuzzing and memory stress benchmarks
npx vitest run src/__tests__/stress/link-validator-stress.test.ts

# 4. Run Edge Cases Matrix Test Vector Suite
npx vitest run src/__tests__/unit/edge-cases-matrix.test.ts
```

### 7.2. SDD-TDD Red/Green Acceptance Criteria
1. **Red Phase**: Test vectors in `src/__tests__/unit/edge-cases-matrix.test.ts` assert the 4 bug scenarios (Bug A parameter loss, Bug B mobile customData absence, Bug C length limit crash, Bug D dispatch omission).
2. **Green Phase**: Minimal code fixes applied, converting all test vectors to green (100% pass).
3. **Forensic Integrity**: Zero hardcoded strings, genuine regex parsing, genuine database transactions.
