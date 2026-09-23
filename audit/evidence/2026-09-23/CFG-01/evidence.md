# Evidence: [CFG-01] Brand Integrity & Forbidden Brands Elimination

## 1. Problem Description
- **Vulnerability**: Historical migrations left legacy phantom brand references (such as `lovable` or `boost`) in configurations and domain root lists. Under OmniSMM 1.0 architecture, only two platform brands exist: `smmplan` (`smmplan.pro`) and `smmflux` (`smmflux.ru`).
- **Severity**: Low/Medium (Brand Bleeding & Architecture Non-Compliance)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/cfg-tenants-brand-integrity.test.ts`
- Verified:
  1. `TENANTS` previously had `lovable.pro` in `KNOWN_ROOT_DOMAINS` in `src/proxy.ts`.
  2. Banned brands `boost` and `smmboost` must be completely absent.
  3. `lovable` must only exist as an alias in `TENANT_ALIASES` mapping to `flux`.

## 3. Remediation Details
- Cleaned up `KNOWN_ROOT_DOMAINS` in `src/proxy.ts` to strictly contain: `smmplan.pro`, `smmflux.ru`, and `smmplan.ru`.
- Verified `src/config/tenants.ts` contains only `smmplan` and `flux` in `TENANTS`.
- Preserved `lovable` strictly in `TENANT_ALIASES: { lovable: 'flux' }` with `isValidTenant('lovable') === false`.

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/cfg-tenants-brand-integrity.test.ts` (4/4 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
