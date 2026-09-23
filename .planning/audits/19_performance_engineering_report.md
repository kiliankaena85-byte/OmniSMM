# ⚡ Omni-Audit Report: Discipline 19 (Performance Engineering)
## Date: 2026-05-12
## Status: 🔴 ACTION REQUIRED (PRESCRIBE Phase)

### 📊 Executive Summary
The performance audit analyzed the Next.js 16 build configuration, client bundle dependencies, and rendering strategies. We found a critical misconfiguration in the main landing page causing unnecessary server load (TTFB degradation), as well as heavy "dead code" dependencies left over from previous design iterations.

### 🔍 Findings & Recommendations

#### 1. [🔴 Critical] Missing ISR on the Main Landing Page
**Context:** In `src/app/page.tsx`, the directive `export const dynamic = "force-dynamic";` is used.
**Risk:** This forces Next.js to Server-Side Render (SSR) the landing page on every single visitor request. For a high-traffic SMM panel, this dramatically degrades TTFB (Time to First Byte) and puts unnecessary load on the database via `getPublicCatalogAction()`.
**Prescription:** 
- Remove `export const dynamic = "force-dynamic";`.
- Add ISR via `export const revalidate = 3600;` (1 hour) so the landing page and public catalog are statically generated and served from the CDN/Edge cache, resulting in instant TTFB.

#### 2. [🟠 High] Dead WebGL Dependencies
**Context:** `package.json` includes `three`, `@react-three/fiber`, and `@react-three/drei`. There is a component `HeroScene.tsx` that uses them.
**Risk:** While tree-shaking might prevent them from reaching the client bundle (since `HeroScene` is never imported in `SmartLinkLanding.tsx`), these heavy dependencies slow down `npm install`, CI/CD pipelines, and IDE indexing.
**Prescription:**
- Since the design migrated to a "Soft Background" (as noted in `SmartLinkLanding.tsx`), these packages should be uninstalled: `npm uninstall three @react-three/fiber @react-three/drei @types/three`.

#### 3. [🟡 Medium] Client-Side Animations (`framer-motion`)
**Context:** `SmartLinkLanding.tsx` imports `framer-motion` synchronously.
**Risk:** `framer-motion` adds ~30-40kb (gzipped) to the initial JavaScript payload, which slightly impacts Time to Interactive (TTI) and INP.
**Prescription:** 
- Acceptable trade-off for the current premium UI, but if strict Core Web Vitals are required, consider refactoring to use CSS animations or `next/dynamic` for below-the-fold components (like `WhyUs`, `FAQ`, `Reviews`).

---

### 📝 Next Steps (IMPLEMENT Phase)
1. User must review this report.
2. If approved, the agent will update `src/app/page.tsx` to switch from `force-dynamic` to ISR (`revalidate = 3600`).
3. The agent will run `npm uninstall` to clear out the dead WebGL packages.
4. The agent will then update `AUDIT_STATE.md` to mark Discipline 19 as `✅ Done`.
