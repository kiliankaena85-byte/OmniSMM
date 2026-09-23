# Evidence: [XSS-03] Telegram Live Preview Template Sanitization

## 1. Problem Description
- **Vulnerability/Defect**: In `src/app/admin/settings/telegram/telegram-live-preview.tsx`, template strings (`formattedWelcome`, `formattedClosed`, `formattedThanks`) were rendered directly into the DOM using `dangerouslySetInnerHTML` with only `.replace(/\n/g, '<br/>')`. If an administrator configured templates containing `<script>`, `<img onerror=...>`, or `<iframe>`, or if malicious data was populated from an API or database field, arbitrary JavaScript executed within the admin session context.
- **Severity**: High (Cross-Site Scripting / Stored & DOM XSS in Administrative Panel)
- **CWE**: CWE-79 (Improper Neutralization of Input During Web Page Generation)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/telegram-preview-xss.test.ts`
- Tests proved:
  1. Plain template rendering allowed execution of `<script>`, `<img onerror=...>`, and `<iframe src=...>` payloads.
  2. With `sanitizeTelegramPreviewHtml`, malicious tags, event handlers, and `javascript:` URIs are discarded completely.
  3. Legitimate Telegram formatting tags (`<b>`, `<i>`, `<u>`, `<code>`, `<a>`, `<br/>`) are preserved.

## 3. Remediation Details
- **`src/lib/sanitize.ts`**:
  - Implemented `sanitizeTelegramPreviewHtml(dirty)` using strict `sanitize-html` configuration:
    - Allowed tags: `b`, `strong`, `i`, `em`, `u`, `s`, `strike`, `code`, `pre`, `a`, `br`.
    - Allowed attributes: `a.href`, `a.title`.
    - Allowed schemes: `http`, `https`, `tg`.
    - Disallowed tags mode: `discard`.
- **`src/app/admin/settings/telegram/telegram-live-preview.tsx`**:
  - Imported `sanitizeTelegramPreviewHtml`.
  - Wrapped all `dangerouslySetInnerHTML` calls (`formattedWelcome`, `formattedClosed`, `formattedThanks`).

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/telegram-preview-xss.test.ts` (3/3 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
