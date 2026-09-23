# SPEC-2026-09-23: Automated Custom Domain Verification & SSL (DNS CNAME/TXT Probe) & Domain Takeover Defense (Phase 5)

## 1. Overview & Threat Model
- **Goal**: Enable secure, automated onboarding of arbitrary custom domains (e.g. `clientagency.com`, `promo-shop.ru`) for OmniSMM 1.0 white-label storefronts with cryptographically verifiable ownership proof before routing live traffic.
- **Threat Vector (Domain Hijacking / Route Injection - OWASP A01 / RFC 9116)**:
  - Without verification, any tenant administrator could register a domain owned by another entity or platform (e.g., `google.com`, `competitor.ru`, or existing client domains), causing route poisoning or SSL certificate contention.
- **Solution**:
  - **Fail-Closed Verification Gate**: Custom domains remain in `PENDING` status and are **NOT** added to the active routing table in `DomainRegistryService` until verified.
  - **Dual Ownership Probe**:
    1. **Primary Probe (CNAME)**: Domain CNAME points to the platform CNAME target (`smmplan.pro` or configured `PLATFORM_CNAME_TARGET`).
    2. **Secondary Probe (TXT Ownership Challenge)**: `_omnismm-challenge.<domain>` contains `omnismm-verify=<secure_token>`.
  - **Zero DDL Migration Invariant**: Verification state and tokens are stored in the existing `SystemSetting` key-value table (`key = "tenant_domain_meta_<tenantSlug>"`).

## 2. Architecture & Data Structures
```typescript
export type DomainVerificationStatus = 'UNCONFIGURED' | 'PENDING' | 'VERIFIED' | 'FAILED';

export interface TenantDomainMeta {
  customDomain: string;
  verificationToken: string;
  status: DomainVerificationStatus;
  cnameTarget: string;
  txtHost: string;
  txtValue: string;
  lastCheckedAt?: string;
  lastError?: string | null;
  verifiedAt?: string;
}
```

## 3. DNS Probe Protocol
1. Probe DNS CNAME using `node:dns/promises.resolveCname(domain)`.
   - If resolved target matches platform target (or canonical platform domain), verification passes (`method: 'CNAME'`).
2. Probe DNS TXT using `node:dns/promises.resolveTxt('_omnismm-challenge.' + domain)`.
   - If flattened records contain `omnismm-verify=<token>`, verification passes (`method: 'TXT'`).
3. If both probes fail, return actionable failure diagnostic with exact found vs expected values.
4. On verification success:
   - Update metadata to `status: 'VERIFIED'`.
   - Immediately register the custom domain in `DomainRegistryService` (L1 memory + L2 Redis).

## 4. UI & Admin Ergonomics
- Visual badge in `TenantsManager`:
  - 🟢 **Верифицирован** (Active in routing)
  - 🟡 **Ожидает DNS** (Click to view DNS records)
  - 🔴 **Ошибка DNS** (Diagnostic details)
- Interactive Modal `<DomainVerificationModal>`:
  - CNAME Record: Host, Target, Copy button.
  - TXT Challenge Record: Host, Value, Copy button.
  - One-click "Проверить DNS сейчас" button with spinner.

## 5. Verification & Safety Criteria
- 100% unit test coverage for `DomainVerificationService` (valid CNAME, valid TXT, wrong CNAME, missing TXT, timeout, hijacked domain check).
- Zero regression on existing core domains (`smmplan`, `flux` are inherently verified).
- 0 TypeScript errors (`npx tsc --noEmit`).
- 0 leaked secrets (`check-bundle-secrets.mjs`).
- 0 BLOCKERs in `npm run lint:tenant`.
