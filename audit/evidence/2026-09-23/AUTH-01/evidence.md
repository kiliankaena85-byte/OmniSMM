# Evidence: [AUTH-01] Dev-Login Security Gate & Host Restriction

## 1. Problem Description
- **Vulnerability**: `src/app/api/auth/dev-login/route.ts` permitted bypassing dev-login gates when `Host` header contained `:3005` (via `host.includes('3005')`). An external attacker could send `Host: evil.com:3005` or `Host: smmplan.pro:3005` in non-production environments to generate valid authenticated administrative or customer sessions without credentials.
- **Severity**: High (Authentication Bypass / Account Takeover)
- **CWE**: CWE-287 (Improper Authentication), CWE-346 (Origin Validation Error)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/auth-dev-login-gate.test.ts`
- Reproduction test:
  1. Sending `Host: evil.com:3005` with `NODE_ENV=development` bypassed `isAllowedHost` check due to substring matching on port `3005`.
  2. Missing `ALLOW_DEV_LOGIN` environment flag allowed dev-login whenever `NODE_ENV === 'development'`.
- Running the suite against unmodified code failed with `FAIL src/__tests__/unit/auth-dev-login-gate.test.ts` (TypeError as execution unexpectedly reached user lookup and session creation instead of immediately returning 404).

## 3. Remediation Details
- **File**: `src/app/api/auth/dev-login/route.ts`
  - Replaced substring matching (`host.includes('3005')`) with strict hostname extraction (`rawHostname = host.split(':')[0].trim().toLowerCase()`).
  - Restricted authorized hosts to exact local loopback: `rawHostname === 'localhost' || rawHostname === '127.0.0.1'`.
  - Enforced mandatory explicit environment flag `process.env.ALLOW_DEV_LOGIN === 'true'`.
  - Blocked all attempts when `process.env.NODE_ENV === 'production'`.
  - Added structured security logging via `logger.warn('[AUTH-01 Security Gate] Dev login attempt rejected', { ip, userAgent, host, ... })` capturing client IP and User-Agent.

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/auth-dev-login-gate.test.ts` (4/4 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
