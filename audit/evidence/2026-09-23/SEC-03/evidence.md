# Evidence: [SEC-03][SEC-04] Fail-Closed Elimination of Fallback Secrets

## 1. Problem Description
- **SEC-03**: `src/proxy.ts:366` and `src/app/api/security/challenge/route.ts:14` contained a hardcoded fallback string `'omnismm-ddos-shield-fallback-secret-2026'` when `JWT_SIGNING_KEY` / `JWT_SECRET` was unset. An attacker aware of this fallback could forge PoW gatekeeper tokens to bypass DDoS rate limiting and perimeter security.
- **SEC-04**: `scripts/backup/backup-postgres-s3.ts:63` used a public fallback encryption key `'default-postgres-backup-secret-key-32b!'` if `BACKUP_ENCRYPTION_KEY` was missing, resulting in database backups encrypted with a publicly exposed key.
- **Severity**: High
- **CWE**: CWE-798 (Use of Hard-coded Credentials), CWE-321 (Use of Hard-coded Cryptographic Key)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/sec-fallback-secrets.test.ts`
- Tests proved:
  1. In production without secrets, `getShieldSecret()` previously did not throw and instead leaked the predictable static string.
  2. In `backup-postgres-s3.ts`, missing `BACKUP_ENCRYPTION_KEY` previously allowed generating backups using the hardcoded default key without error.

## 3. Remediation Details
- **SEC-03**:
  - Implemented `src/lib/security/ddos-shield/shield-secret.ts` with `getShieldSecret()`.
  - In production (`NODE_ENV === 'production'`), throws a fatal fail-closed error if no secret is configured.
  - In non-production environments, generates a cryptographically random 256-bit ephemeral secret (`crypto.randomBytes(32).toString('hex')`) in-memory per process runtime.
  - Updated `src/app/api/security/challenge/route.ts` and `src/proxy.ts` to consume `getShieldSecret()` and fail closed (HTTP 500 / rejection).
- **SEC-04**:
  - Updated `scripts/backup/backup-postgres-s3.ts` `getEncryptionKey()`:
    - Removed public default fallback key.
    - Requires an explicit key of at least 32 characters, throwing a fail-closed error (`[SEC-04 Fail-Closed] BACKUP_ENCRYPTION_KEY is required and must be at least 32 characters long.`).

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/sec-fallback-secrets.test.ts` (7/7 passed).
- **Backup Suite**: `npx dotenv -e .env.test -- vitest run scripts/backup/__tests__/backup-postgres-s3.test.ts` (4/4 passed).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
