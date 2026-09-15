
# 🛡️ EXTERNAL ADVERSARIAL AUDIT REPORT (GLM-5.2 & MiniMax-M3)
**Timestamp:** 2026-08-29T14:21:40.555Z
**Targets Analyzed:** test.smmplan.pro, flux.smmplan.pro, smmplan.pro
**Commit SHA:** 8b2a2faa2

---

## 1. GLM-5.2 Adversarial Assessment:
N/A

---

## 2. MiniMax-M3 Adversarial Assessment:
# ADVERSARIAL PENETRATION TEST AUDIT REPORT
## Target: Next.js 16 Multi-Tenant SaaS | Commit: 8b2a2faa2

---

## F-7.1: Physical Session Deletion & Replay Immunity

**VERDICT: RISK (Partial Implementation — Race Condition + Cookie Cookie-Explicit-Logout Bypass)**

### Findings:

1. **CRITICAL — Logout Race Condition (TOCTOU)**: The `GET /api/auth/logout` handler delegates to `POST()`, which reads `session_token` cookie → decrypts → `db.session.deleteMany()`. However, the JWT itself remains valid for its full 24h TTL even after DB deletion. An attacker who captured the JWT pre-logout can replay it during the 24h window against any endpoint that does NOT re-validate `db.session` existence on every request. The `verifySession` excerpt is truncated, but the existence of `sessionVer: 1` suggests a versioning mechanism — if it is not strictly enforced against DB, replay is possible.

2. **MEDIUM — `explicit_logout` Cookie Re-Hydration Attack**: The `verifySession` function returns `null` if `explicit_logout === 'true'`. However, this cookie is `httpOnly: true` only on `/api/auth/logout` response. The proxy sets `explicit_logout` via `res.cookies.set` with `httpOnly: true` (truncated code). If at any point this cookie is set without `httpOnly`, an attacker with XSS could delete it and restore "valid" session state from a leaked JWT.

3. **MEDIUM — `/logout` UI Route vs `/api/auth/logout` Divergence**: The proxy intercepts `/logout` and ONLY clears the cookie client-side (`res.cookies.set('session_token', '', { maxAge: 0 })`) — it does NOT delete the DB session. An attacker who tricks a user into hitting `/logout` (which still requires user gesture) prevents a real DB cleanup. The comment correctly notes the API route is required for DB deletion, but the UI route gives users a false sense of security and allows session token reuse from any captured copy until JWT expiry.

4. **LOW — `sec-fetch-site` Bypass via `none`**: The check accepts `sec-fetch-site: none` for logout. This is correct for top-level navigation, but combined with the 1-year `explicit_logout` cookie TTL, a malicious site can navigate to `/api/auth/logout` once and lock out the user.

---

## F-7.2: Panel API Key Cross-Tenant Rejection

**VERDICT: FAIL (Contour Bypass + Tenant Spoofing via Header)**

### Findings:

1. **CRITICAL — Tenant Requirement is Optional**: `verifyAPIKey(key, requiredTenantId?)` — if `requiredTenantId` is not passed (or is null/undefined), the cross-tenant check is **completely skipped**. The API v2 route must always pass `resolveTenantFromRequest(request)` as the required tenant. Audit shows this is imported, but I cannot verify it is unconditionally threaded into `verifyAPIKey` in all code paths. The header `x-tenant-id` is stripped by the proxy, but `resolveTenantFromRequest` may fall back to `request.headers.get('x-tenant-id')` — and since the proxy `requestHeaders.set('x-tenant-id', finalTenantId)` re-injects it, the **resolved tenant is attacker-influenced** in dev/QA mode via the `x_tenant` cookie.

2. **CRITICAL — Test/Prod Contour Account Reuse**: `requiredContour === 'prod'` check only blocks accounts whose email **contains literal strings** `'pentest'` or `'test_'`. This is a string-match blacklist:
   - `test+prod@evil.com` → bypasses
   - `pentester.real@target.io` → bypasses
   - Any account not following naming convention → **cross-contour accepted**
   - The blocklist is brittle and assumes all pentest/test accounts have those substrings. A legitimate API user created in test contour without those substrings can authenticate against prod.

3. **MEDIUM — `requiredContour` is Optional in the API**: If `resolveContourFromHost` returns `null` or is not passed to `verifyAPIKey`, no contour check occurs at all. The host detection depends on the `host` header which (per F-7.5 below) is spoofable.

4. **MEDIUM — Timing Attack on API Key Lookup**: `db.user.findFirst` with `apiKeyHash` is constant-time at DB level, but the `if (!key || key.length < 10) return null` early return is not constant-time relative to valid key prefixes, enabling key-length enumeration.

---

## F-7.3: Multi-Contour Isolation

**VERDICT: RISK (Host Trust + String-Based Blacklist)**

### Findings:

1. **HIGH — `resolveContourFromHost` Depends on Spoofable Host**: The contour resolution relies on host header parsing. Combined with F-7.5 findings below, an attacker can claim `host: smmplan.pro` while the request is actually destined elsewhere. The `contour` is then stamped into the JWT at creation — but if the user was created in test contour and the attacker spoofs host to prod at request time, the contour check at API verification fails only on the brittle email substring filter.

2. **HIGH — `contour` is Not Cryptographically Bound to Tenant**: The JWT contains both `tenantId` and `contour` as separate claims. There is no enforcement that `tenantId === resolveContourToTenant(contour)`. A JWT minted on `test.smmplan.pro` with `contour: 'test'` and `tenantId: 'smmplan'` (the test tenant) could be replayed if prod's JWT signing key matches (which it does in this code — single `JWT_SECRET`).

3. **MEDIUM — Cross-Contour User Table is Shared**: The Prisma `User` model is not scoped by contour. The `tenantId` is the only separator. A user in `tenantId: 'smmplan'` on test contour can have an `apiKeyHash` that matches when their JWT is replayed against prod if the prod system uses the same DB or the JWT secret is shared (which it is, per `getEncodedKey`).

4. **LOW — `normalizeTenantId` is Bypassable if Not Applied Consistently**: Trust boundary depends on this function being called on every boundary crossing. Any endpoint that doesn't normalize tenant IDs prior to comparison is vulnerable.

---

## F-7.4: Production Maintenance Gate Bypass

**VERDICT: RISK (Maintenance Mode Logic Absent / Trivially Bypassable)**

### Findings:

1. **CRITICAL — No Maintenance Mode Middleware Detected**: The proxy contains logic for `isDevOrQA`, `LOVABLE_HOSTS`, legacy redirects, and tenant resolution — but **no `isMaintenanceMode` or contour-based gating for `smmplan.pro`**. The comment states `smmplan.pro (prod maintenance)` but the code does not enforce read-only/maintenance state.

2. **HIGH — `isProduction` Boolean is Sufficient to Enable Routes**: `const isProduction = process.env.NODE_ENV === 'production'` — the code uses this to determine if dev/QA routes should be hidden. However, **the prod contour (`smmplan.pro`) does not appear to have an additional write-block layer** during maintenance. If maintenance means "block writes," there is no enforcement shown.

3. **MEDIUM — `ENABLE_DEV_ROUTES` and `NEXT_PUBLIC_ENABLE_DEV_ROUTES`**: These env flags are checked at proxy time. If either leaks into prod via misconfiguration, ALL dev routes become accessible. There is no contour-level override that hard-disables these for `smmplan.pro` host.

4. **MEDIUM — Lovable Host Redirect to Production**: `LOVABLE_HOSTS` redirects to `https://smmflux.ru`. This is not a maintenance bypass, but it indicates the prod domain `smmplan.pro` accepts traffic, meaning if a maintenance page is intended, it must be enforced in route handlers, not just proxy.

---

## F-7.5: Host Header Injection & X-Forwarded-Host Spoofing

**VERDICT: FAIL (Systemic Host Trust Without Trust Boundary Validation)**

### Findings:

1. **CRITICAL — `x-forwarded-host` is Trusted Without Verifying Proxy Chain**: 
   ```typescript
   let host = hostHeader || fwdHost || '';
   ```
   There is **zero validation** that the request actually came from a trusted reverse proxy before reading `x-forwarded-host`. In a Next.js deployment behind nginx/Cloudflare/Vercel, this header can be set by any client unless the edge platform strips it. Attackers can set `x-forwarded-host: smmplan.pro` while connecting to `test.smmplan.pro`, fooling:
   - Tenant resolution
   - Contour detection (`resolveContourFromHost` returns `'prod'`)
   - `isDevOrQA` evaluation
   - All redirect target URLs (host determines where the user lands post-logout)

2. **CRITICAL — Logout Redirect Hostname = Attacker-Controlled**:
   ```typescript
   const targetUrl = `${proto}://${host}/login`;
   const response = NextResponse.redirect(targetUrl, 303);
   ```
   In `/api/auth/logout`, the redirect target is constructed from the untrusted `host` header. An attacker can craft a logout link/POST that, after the user logs out, redirects them to `https://evil.com/login` (phishing), and the legitimate user's `explicit_logout` cookie is set with `secure: true` but the **Domain attribute is the default (origin host)**, so the attacker's host doesn't get the cookie — but the user is now on a phishing page immediately after a high-trust action (logout).

3. **HIGH — `x-forwarded-proto` is Also Untrusted**: 
   ```typescript
   const proto = fwdProto || (...);
   ```
   Spoofable. An attacker sets `x-forwarded-proto: https` to bypass protocol checks or set `x-forwarded-proto: javascript` (browsers will reject, but the URL parser may produce unexpected results).

4. **HIGH — `0.0.0.0` / `host.docker.internal` Sanitization is Incomplete**: The sanitization is applied for these specific strings only. An attacker sending `host: 0.0.0.0.malicious.com` would pass the check (because `.includes('0.0.0.0')` matches), but the `cleanHost.split(':')[0].toLowerCase()` is then `'0.0.0.0.malicious.com'`, which does not match `LOVABLE_HOSTS` — but it WOULD match `host.includes('localhost')` only if it contained the substring "localhost". The fallback to `APP_URL` only occurs for exact substring matches, not host suffix. **Subdomain bypass is possible.**

5. **MEDIUM — Cookie Domain Not Set**: Neither `session_token` nor `explicit_logout` are set with an explicit `Domain` attribute. They are scoped to the exact host. This actually **mitigates** some cross-subdomain attacks, but means the proxy's tenant resolution must be 100% accurate per host (which F-7.5 violations break).

---

## NEW / UNRESOLVED VULNERABILITIES IDENTIFIED

| ID | Severity | Vulnerability | Location |
|---|---|---|---|
| V-01 | CRITICAL | JWT secret shared across all contours (single `JWT_SECRET`). Test/QA token replayable to prod if secret is identical. | `src/lib/session-edge.ts: getEncodedKey()` |
| V-02 | CRITICAL | `x-forwarded-host` trusted without proxy chain validation → tenant/contour hijack. | `src/proxy.ts`, `src/app/api/auth/logout/route.ts` |
| V-03 | HIGH | Logout open-redirect via attacker-controlled `host` header. | `src/app/api/auth/logout/route.ts` |
| V-04 | HIGH | API key cross-tenant check bypassable by omitting `requiredTenantId`. | `src/lib/api-auth.ts` |
| V-05 | HIGH | Pentest/test account blocklist uses brittle substring matching. | `src/lib/api-auth.ts` |
| V-06 | MEDIUM | JWT (24h TTL) remains valid after DB session deletion → replay window. | `src/app/api/auth/logout/route.ts`, `src/lib/session.ts` |
| V-07 | MEDIUM | `/logout` UI route clears cookie only, does not delete DB session. | `src/proxy.ts` |
| V-08 | MEDIUM | `RateLimit-*` headers hardcoded to `49` remaining in all responses (rate limiter may be a no-op). | `src/app/api/v2/route.ts` |
| V-09 | MEDIUM | Content-length check uses `request.headers?.get` (optional chaining suggests code path may bypass DoS protection). | `src/app/api/v2/route.ts` |
| V-10 | MEDIUM | `resolveTenantFromRequest` likely uses `x-tenant-id` (which proxy re-injects from untrusted cookie in dev/QA). | `src/lib/tenant-resolver-edge.ts` |
| V-11 | MEDIUM | No CSRF token on logout `POST` (only `sec-fetch-site` heuristic, which is non-standard and spoofable in some browsers/extensions). | `src/app/api/auth/logout/route.ts` |
| V-12 | LOW | `apiRequestLog.create` is fire-and-forget — could be DoS'd to fill DB, and unauthenticated logging paths may exist. | `src/app/api/v2/route.ts
