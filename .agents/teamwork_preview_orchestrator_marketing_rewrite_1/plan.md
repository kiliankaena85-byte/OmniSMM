# Implementation Plan: Marketing Description Rewriter

## 1. 5 Vectors of Reliability

- **Архитектурный стык (Architecture Boundaries)**:
  - The script must be executable as a standalone CLI script via `npx tsx scripts/marketing-description-rewriter.ts`.
  - It must correctly initialize the Prisma Client and close database and Redis connections on exit to prevent leaking resource handles.
  - Gemini API key must be read securely from `process.env.GEMINI_API_KEY`.
- **Хаос и пустота (Edge Cases & Cold Starts)**:
  - If no active services with an `externalId` exist, log a message and exit gracefully without error.
  - If the Redis cache `provider:${providerId}:catalog` is empty, query the provider via `providerService.getProviderInstance(provider).getServices()`, cache it to Redis for 24 hours (86400s), and handle provider network failures gracefully.
  - If the Gemini API call fails or returns invalid JSON/malformed content, catch the error, log a warning, and continue to the next service.
  - Handle cases where the provider description is empty or missing by using a fallback prompt.
- **Visual & UX Density**:
  - The script must support a `--dry-run` flag.
  - When `--dry-run` is active, it must not write to the database or create audit logs, but must output a clean, readable diff to the console showing:
    - Service ID, Category, Provider
    - Name: `[Old Name]` -> `[New Name]`
    - Description: `[Old Description]` -> `[New Description]`
  - Format the CLI output clearly to ease admin review of proposed updates.
- **Доступность WCAG 2.2 AA**:
  - As a console script, standard WCAG elements don't apply directly, but output logs should be clearly formatted with clear headers and bullet points.
- **Security & Trust**:
  - API keys must not be logged or leaked.
  - Audit logs must use the standard email `system@smmplan.pro` and `action: "SERVICE_AUTO_FIX"` so that they are securely traceable.

## 2. Pre-mortem Analysis (Failure Simulation)

| Risk (Сценарий отказа) | Механизм защиты (Mitigation) |
| :--- | :--- |
| **Gemini API Key missing or invalid** | The script must check for `process.env.GEMINI_API_KEY` at startup. If missing, it should fail-fast with a clear error message. |
| **Gemini rate limits (429) on large service catalogs** | Introduce a short delay (e.g. 1-2 seconds) between API requests or process in small chunks to stay within rate limits. |
| **Prisma/Redis connection issues during execution** | Wrap DB/Redis calls in standard try-catch blocks, ensuring connections are closed correctly on error. |
| **Decryption of provider keys fails** | Decrypt the key using `VaultService.decrypt` before passing it to `UniversalProvider`, catching errors. |

## 3. Implementation Steps

### Step 1: Core Script Base (`scripts/marketing-description-rewriter.ts`)
- Parse CLI arguments (`--dry-run`).
- Retrieve active services: `db.service.findMany({ where: { isActive: true, externalId: { not: null } } })`.
- Fetch provider information (Redis cache `provider:${providerId}:catalog` first, fallback to provider client).

### Step 2: Gemini API Integration
- Setup structured prompt: System instruction with rules (Honesty, selling structure with lists, spam clean).
- Request JSON structure: `{ name: string, description: string }` using `responseMimeType: "application/json"`.
- Use model `gemini-3-flash` or `gemini-3-flash-preview`.

### Step 3: DB Update and Audit Logging
- Compare the new name/description with the current ones.
- If changed (and not `--dry-run`), perform `db.service.update` and create `AdminAuditLog` via `auditAdminAwaitable`.

### Step 4: Unit Tests (`test/unit/marketing-rewrite.test.ts`)
- Mock Redis cache.
- Mock Gemini API REST calls.
- Test name/description update, dry-run simulation, and audit log generation.

### Step 5: Verification
- Execute `npx tsc --noEmit`.
- Execute `npm run lint`.
- Execute `npx vitest run test/unit/marketing-rewrite.test.ts`.
