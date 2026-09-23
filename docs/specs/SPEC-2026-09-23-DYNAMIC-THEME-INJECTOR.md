# SPEC-2026-09-23: Dynamic Tenant Theme Injector & White-Label Design System (Phase 3)

## 1. Overview & Business Intent
- **Goal**: Enable complete visual and branding isolation for dynamic N-tenants in OmniSMM 1.0 without code redeployments, container rebuilds, or PostgreSQL DDL migrations.
- **Problem**: Previously, Tailwind CSS 4 theme colors were hardcoded in `globals.css` with static classes (`.theme-flux`), and `RootLayout` / `generateMetadata()` had rigid binary checks (`tenantId === 'flux' ? ... : 'smmplan'`). Any newly onboarded tenant or custom domain defaulted visually to SMMplan's blue identity.
- **Solution**:
  1. `TenantThemeService`: Tiered L1 (Memory Map, 60s TTL) / L2 (Redis `tenant:theme:<id>`) / L3 (PostgreSQL `SystemSetting` key-value store) theme resolution.
  2. Built-in presets: `sky` (SMMplan default), `violet` (SMMflux default), `emerald`, `amber`, `rose`, `indigo`, `slate`, plus `custom` HEX values.
  3. `TenantThemeInjector`: High-performance SSR style injector with CSP Nonce support rendering scoped CSS variables directly into `<head>`.
  4. Fully dynamic `generateMetadata()` in `src/app/layout.tsx` resolving title, description, favicon, logo, and OpenGraph tags from `SystemSettings`.
  5. Dynamic dashboard branding in `ClassicDashboardShell.tsx`, `SidebarNav`, and `factory.ts`.

## 2. Invariants & Security
- **0 DB Migrations**: Theme data is stored in the existing `SystemSetting` key-value table (`key = "tenant_theme_${cleanTenant}"`) and cached in Redis.
- **CSP Nonce Compliance**: The injected `<style>` tag strictly uses `nonce={nonce}` extracted from request headers (`x-nonce`).
- **CSS Injection Sanitization**: All user-provided color values are validated against strict HEX / RGBA regexes to prevent CSS injection / XSS vulnerabilities.
- **Zero FOUC (Flash of Unstyled Content)**: CSS variables are injected directly in SSR HTML `<head>`.
- **Backward Compatibility**: `smmplan` defaults to `sky`, `flux` defaults to `violet`. Existing UI behaves with 100% fidelity.

## 3. Data Schema & Contracts
```typescript
export interface TenantThemeConfig {
  preset: 'sky' | 'violet' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate' | 'custom';
  primaryColor?: string; // e.g. #047857
  primaryForeground?: string; // e.g. #ffffff
  secondaryColor?: string; // e.g. #d1fae5
  secondaryForeground?: string; // e.g. #047857
  ringColor?: string; // e.g. #a7f3d0
  accentColor?: string;
  accentForeground?: string;
  borderRadius?: string; // e.g. 0.75rem, 1rem, 1.25rem
  darkPrimaryColor?: string;
  darkPrimaryForeground?: string;
  darkSecondaryColor?: string;
  darkSecondaryForeground?: string;
  darkRingColor?: string;
}
```

## 4. Verification Plan
- Unit tests for `TenantThemeService` (presets, CSS generation, sanitization, fallbacks, caching).
- Verification of metadata generation with arbitrary dynamic tenants.
- `npx tsc --noEmit` clean.
- `node scripts/check-bundle-secrets.mjs` clean.
- `npm run lint:tenant` clean.
