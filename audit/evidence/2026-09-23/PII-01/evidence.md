# Evidence: [PII-01][PII-02] Log Masking & Magic Link Stdout Dump Elimination

## 1. Problem Description
- **PII-01**: `src/lib/smtp.ts:212` dumped raw authentication magic links directly to stdout (`console.info`) regardless of environment. Log aggregation systems (Loki, Elasticsearch, CloudWatch) collected valid, reusable single-use login tokens, enabling account takeover by anyone with log access.
- **PII-02**: Structured logs in `src/lib/logger/sensitive-data-filter.ts` lacked masking for email addresses, URL token parameters, and phone numbers. As a result, sensitive personal identifiable information (PII) was recorded in plaintext in server logs.
- **Severity**: Medium (PII Disclosure, Account Takeover via Log Ingestion)
- **CWE**: CWE-532 (Insertion of Sensitive Information into Log File), CWE-359 (Exposure of Private Personal Information)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/pii-and-log-masking.test.ts`
- Tests proved:
  1. Default calls to `sendMagicLink` dumped full URLs with raw tokens to stdout.
  2. `redactSensitiveTokens` previously did not mask standalone emails (`user@domain.com`), URL query parameters (`?token=...`), or structured JSON email/phone fields.

## 3. Remediation Details
- **PII-01**:
  - Gated stdout output in `src/lib/smtp.ts` strictly behind `process.env.DEBUG_MAGIC_LINK === 'true'` AND `process.env.NODE_ENV !== 'production'`.
  - In all other scenarios, stdout dumping is disabled.
  - The fallback `log.warn` uses a masked link (`link.replace(/token=[^&]+/, 'token=***')`).
- **PII-02**:
  - Implemented `maskEmail(email: string): string` producing `u***@domain.com`.
  - Added regex rules to `SENSITIVE_PATTERNS` in `src/lib/logger/sensitive-data-filter.ts`:
    - JSON email fields: `"email":"u***@domain.com"`
    - Standalone email addresses in log text: `u***@domain.com`
    - Token query parameters: `?token=[REDACTED]`
    - Phone number fields in JSON: `"phone":"[REDACTED]"`
    - Extended token and session variable names to redact.
  - Structured logger now automatically sanitizes all context fields and message strings before writing to Pino.

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/pii-and-log-masking.test.ts` (8/8 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
