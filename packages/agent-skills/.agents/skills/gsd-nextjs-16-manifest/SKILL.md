---
name: gsd-nextjs-16-manifest
version: 1.1.0
description: "Manifest Next.js 16 for SMMplan. Critical build rules, proxy migration, Server Actions contract, Turbopack regressions, August 2026 knowledge digest."
tags: [nextjs, build, server-actions, docker, standalone, turbopack, webpack, proxy]
---

# SKILL: Next.js 16 Manifest — SMMplan Production Rules

> **Knowledge status:** current as of August 2026.
> Read this skill BEFORE editing `next.config.mjs`, Server Actions, `proxy.ts`, Dockerfile, or `package.json`.

---

## CRITICAL BUILD RULES

### Rule 1: Always use Webpack for production standalone builds

**Problem (Turbopack regression confirmed by Vercel):**
Turbopack in Next.js 16 with `output: "standalone"` generates hashed module names
(`sanitize-html-<hash>`, `postcss-<hash>`). Inside Docker, Node.js cannot find them.
Result: 500 Internal Server Error on ALL pages.

**Solution (locked in package.json):**

```json
{ "scripts": { "build": "next build --webpack" } }
```

### Rule 2: Forbidden packages in serverExternalPackages

NEVER add to `next.config.mjs` → `serverExternalPackages`:
- `ioredis`
- `sanitize-html`
- `bullmq`

Only allowed:
```js
serverExternalPackages: ["@blocknote/core", "@blocknote/react", "@blocknote/server-util"]
```

### Rule 3: Mandatory deploy order

```bash
# 1. Build on host (creates .next/standalone)
npm run build

# 2. Then rebuild Docker image
docker-compose up -d --build web
```

NEVER rebuild Docker without a fresh host build.

---

## MIGRATION middleware.ts to proxy.ts (Next.js 16 official)

`middleware.ts` is officially deprecated in Next.js 16. SMMplan has already migrated.

| Before | After |
|---|---|
| src/middleware.ts | src/proxy.ts |
| export function middleware(req) | export function proxy(req) |
| skipMiddlewareUrlNormalize | skipProxyUrlNormalize |

Automatic migration command:
```bash
npx @next/codemod@latest middleware-to-proxy
```

`proxy.ts` runs in Node.js runtime (not Edge) — gives full Node.js API access.

---

## SERVER ACTIONS ERROR CONTRACT

### Rule: return, never throw

```typescript
// CORRECT — error reaches UI as readable message
export async function myAction(data: FormData) {
  try {
    await db.something.create({ ... });
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'User-friendly message' };
  }
}

// FORBIDDEN — Next.js masks as "An unexpected response was received from the server."
export async function myAction() {
  throw new Error('Database error'); // NEVER DO THIS IN SERVER ACTIONS
}
```

**Allowed throws:** `redirect()` and `notFound()` from `next/navigation` — they throw internally by design.

### Rule: useActionState (not useFormState — deprecated in React 19)

```tsx
import { useActionState } from 'react';
const [state, formAction, isPending] = useActionState(myAction, { success: false });
```

---

## Next.js 16.3 New Features (released August 3, 2026)

| Feature | Impact |
|---|---|
| Cache Components + Partial Prefetching | SPA navigation with Server Components |
| Root Params | [lang] accessible in any Server Component without props drilling |
| Custom Error Boundaries | Recoverable server errors, no full page reload |
| Dev RAM -90% | Dramatically faster long dev sessions |
| SSR +22% throughput | More requests handled under load |
| TypeScript 7 support | Faster type checking in next build |

CRITICAL SECURITY PATCH — 26 August 2026:
Next.js 16.3.3 closes a critical severity vulnerability.
After 26.08.2026, check and update:
```bash
npm list next
npm install next@16.3.3
```

---

## PRE-FLIGHT CHECKLIST before every deploy

```bash
npx tsc --noEmit                       # must be 0 errors
npm run build                          # next build --webpack
docker-compose up -d --build web       # rebuild container
curl http://localhost:3000/api/health  # {"status":"ok"}
```

---

## next.config.mjs canonical reference for SMMplan

```js
const nextConfig = {
  output: 'standalone',
  // ALLOWED: heavy UI packages not used server-side
  serverExternalPackages: ['@blocknote/core', '@blocknote/react', '@blocknote/server-util'],
  // NEVER ADD: ioredis, sanitize-html, bullmq
};
export default nextConfig;
```

---

## Official Sources

- Next.js blog: https://nextjs.org/blog
- Server Actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- Proxy migration: https://nextjs.org/docs/app/building-your-application/routing/proxy
- Standalone output: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- Security advisories: https://github.com/vercel/next.js/security/advisories
