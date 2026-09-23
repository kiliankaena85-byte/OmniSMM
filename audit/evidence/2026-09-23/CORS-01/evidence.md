# Evidence: [CORS-01] Strict CORS Whitelisting & Credential Isolation

## 1. Problem Description
- **Vulnerability**: In `src/proxy.ts`, storefront API endpoints reflected the incoming `Origin` header while simultaneously setting `Access-Control-Allow-Credentials: true` (`preflightHeaders.set('Access-Control-Allow-Origin', origin || '*')`). Furthermore, `isKnownOrAllowedHost` allowed loopback (`localhost`, `127.0.0.1`) without checking whether the application was running in production. An external website could initiate authenticated cross-origin requests to exfiltrate user data.
- **Severity**: High (Cross-Origin Data Exfiltration / Insecure CORS Configuration)
- **CWE**: CWE-942 (Permissive Cross-origin Resource Sharing Policy with Wildcard)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/cors-policy-hardening.test.ts`
- Tests proved:
  1. In production, requests originating from `localhost` or arbitrary domains previously qualified under loose host-matching rules.
  2. Public wildcard `*` was combined with credential flags when `origin` was passed from arbitrary third-party origins.

## 3. Remediation Details
- **`src/proxy.ts`**:
  - Implemented `isAllowedCorsOrigin(origin)`:
    - In production (`NODE_ENV === 'production'`), strictly rejects `localhost`, `127.0.0.1`, `0.0.0.0`, and `.local` domains.
    - Whitelists only official production root domains (`smmplan.pro`, `smmflux.ru`, and their subdomains).
  - In `isStorefrontApi` preflight and response headers:
    - If origin is authorized: returns `origin` and sets `Access-Control-Allow-Credentials: true`.
    - If origin is unknown/public: returns `Access-Control-Allow-Origin: *` and strictly **OMITS** `Access-Control-Allow-Credentials`.
  - For non-storefront `/api/...` routes: CORS headers are never set for unauthorized origins.

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/cors-policy-hardening.test.ts` (5/5 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
