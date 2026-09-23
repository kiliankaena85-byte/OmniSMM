# Marketing Description Rewriter - Investigation Report

## 1. Observation
This investigation analysed the `Smmplan` codebase to compile the architecture, dependencies, and configurations needed to implement:
- Console script `scripts/marketing-description-rewriter.ts`
- Unit tests `test/unit/marketing-rewrite.test.ts`

Here are the direct findings:

### 1.1 Database Models
In `prisma/schema.prisma`:
- **`Service` Model (Lines 176–240)** contains the following fields:
  ```prisma
  model Service {
    id               String    @id @default(cuid())
    numericId        Int       @unique @default(autoincrement())
    name             String
    description      String?
    features         Json?
    categoryId       String
    category         Category  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
    providerId       String?
    provider         Provider? @relation(fields: [providerId], references: [id], onDelete: SetNull)
    rate             Float
    providerCurrency String    @default("USD")
    markup           Float     @default(3.0)
    anomalyScore     Int       @default(0)
    minQty           Int       @default(10)
    maxQty           Int       @default(100000)
    externalId       String?
    dataHash         String?
    lastSeenAt       DateTime?
    isDripFeedEnabled Boolean @default(true)
    isRefillEnabled   Boolean @default(false)
    isCancelEnabled   Boolean @default(false)
    isQuarantined    Boolean   @default(false)
    pendingRate      Float?
    quarantineReason String?
    quarantinedAt    DateTime?
    cooldownUntil  DateTime?
    cooldownReason String?
    etaP50Seconds  Int?
    etaP90Seconds  Int?
    etaSampleCount Int       @default(0)
    etaSpeedClass  String?
    etaUpdatedAt   DateTime?
    targetType        String  @default("POST")
    customDataType    String  @default("NONE")
    customDataLabel   String?
    isMediaGroupAware Boolean @default(false)
    requireWarning    Boolean  @default(false)
    warningMessage    String?
    isActive          Boolean  @default(true)
    pricePer1000Cents Int      @default(0)
    createdAt         DateTime @default(now())
    updatedAt         DateTime @updatedAt
    orders         Order[]
    routes         ServiceRoute[]
    smartCampaigns SmartCampaign[]
    smartConfig    ServiceSmartConfig?
    @@index([categoryId])
    @@index([providerId])
    @@index([isQuarantined])
  }
  ```
- **`AdminAuditLog` Model (Lines 612–628)** contains the following fields:
  ```prisma
  model AdminAuditLog {
    id         String   @id @default(cuid())
    adminId    String
    adminEmail String
    action     String
    target     String
    targetType String
    oldValue   String?
    newValue   String?
    ipAddress  String?
    createdAt  DateTime @default(now())
    @@index([adminId])
    @@index([createdAt])
    @@index([targetType])
  }
  ```

### 1.2 Redis Configuration and Caching
- **Initialization (In `src/lib/redis.ts`)**:
  ```typescript
  import { Redis } from 'ioredis';
  const globalForRedis = global as unknown as { redis: Redis };
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  export const redis = globalForRedis.redis || new Redis(redisUrl, { ... });
  ```
- **Cache Key & Structure (In `src/actions/admin/providers/import-cherry-pick.ts`)**:
  - Key: `provider:${providerId}:catalog`
  - Caching logic: `await redis.setex(cacheKey, 86400, JSON.stringify(services));` (TTL of 24 hours).
  - Item structure in cached catalog array:
    ```typescript
    {
      service: string | number;
      name: string;
      category?: string;
      rate: string | number;
      min: string | number;
      max: string | number;
      refill?: boolean;
      cancel?: boolean;
      dripfeed?: boolean;
      desc?: string;
      description?: string;
      cleanName?: string;
      metrics?: { ... }
    }
    ```

### 1.3 Gemini API Configuration
- **Gemini Call Pattern (In `src/services/admin/ai-support.service.ts`)**:
  Gemini is accessed directly through REST via HTTP `fetch` using `process.env.GEMINI_API_KEY`:
  ```typescript
  const model = 'gemini-3.5-flash'; // For the script, must use 'gemini-3-flash' or 'gemini-3-flash-preview'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  ```

### 1.4 SMM Provider Client Invocation
- In `src/services/providers/provider.service.ts` and `src/services/providers/universal.provider.ts`:
  - Fetching active providers and creating client instances is done through `providerService`:
    ```typescript
    import { providerService } from "@/services/providers/provider.service";
    const providerInstance = await providerService.getProviderInstance(providerDbRecord);
    const rawServices = await providerInstance.getServices();
    ```

### 1.5 Test Setup and Mocks
- **Vitest Config (In `vitest.config.ts`)**:
  - Configures `test/setup.ts` as the setup file.
  - Excludes `.agents` and `.planning` folders.
- **Global Mocks (In `test/setup.ts`)**:
  - `ioredis` is globally mocked to store data inside an in-memory `Map` class.
  - Global `fetch` is mocked with `vi.stubGlobal('fetch', vi.fn())` to prevent external network traffic.
  - `admin-audit` library is mocked to capture `auditAdmin` actions.

---

## 2. Logic Chain
- The script `scripts/marketing-description-rewriter.ts` needs to scan the database for active services. This corresponds to retrieving `db.service.findMany({ where: { isActive: true, externalId: { not: null } } })`.
- For each service, we must acquire its provider's raw technical name and description. We should check Redis using `await redis.get(cacheKey)`.
- If cache is empty, we must fallback to provider API call: retrieve `Provider` record via `db.provider.findUnique`, create client via `providerService.getProviderInstance(provider)`, call `getServices()`, search for `service.externalId`, and then save to Redis with a 24-hour TTL using `redis.setex` for subsequent lookups.
- Once raw spec (original provider name and description) is obtained, we pass it to the Gemini API (`gemini-3-flash` or `gemini-3-flash-preview`) in structured batches using standard fetch to generate translated/marketing names and descriptions.
- Upon receiving rewritten structures, we update `Service` in the database and invoke `auditAdminAwaitable` with action `SERVICE_AUTO_FIX`.
- Unit tests can mock the Redis cache using standard mock Redis set commands, and mock Gemini API calls using `vi.spyOn(globalThis, 'fetch')` returning standard JSON structured responses.

---

## 3. Caveats
- Gemini model context limits: The script should batch services (e.g., 20 or 30 at a time) to fit within context/token limits and handle rate-limiting cooldown.
- Missing original description: If the provider catalog doesn't list a description, the script should pass a fallback text derived from local fields to the Gemini API.

---

## 4. Conclusion
The codebase contains all necessary tools (`db`, `redis`, `providerService`, `auditAdminAwaitable`) and test configurations to allow clean implementation of `scripts/marketing-description-rewriter.ts` and `test/unit/marketing-rewrite.test.ts`.

---

## 5. Verification Method
- Independent verification command: `npx vitest run test/unit/marketing-rewrite.test.ts`
- Files to inspect:
  - `scripts/marketing-description-rewriter.ts`
  - `test/unit/marketing-rewrite.test.ts`
