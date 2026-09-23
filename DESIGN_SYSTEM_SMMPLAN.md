# SMMplan Design System & Visual Architecture Specifications (v4.0)

## 1. Overview & Core Technology Stack

The SMMplan design system is a high-performance, enterprise-grade B2B UI framework built specifically for multi-tenant digital marketing platforms.

- **CSS Engine**: Tailwind CSS 4.2.2 (`@theme` directive in `src/app/globals.css`, CSS-first configuration via `@tailwindcss/postcss` 4.2.2)
- **Framework**: Next.js 16.2.6 (App Router), React 19.2.6
- **UI Component Library**: HeroUI v3 (dot-notation API: `<Table.Header>`, `<Table.Column>`)
- **Typography**: Inter (Google Fonts `<link>` in `src/app/layout.tsx`, weights 400, 500, 600, 700) with system font fallbacks
  <!-- TODO: подключить Outfit для display, если нужен -->
- **Color Model**: Direct HEX semantic tokens in `@theme` for Seamless Light & Dark Modes
- **Animation Framework**: Framer Motion (v12.38.0) & CSS Keyframe micro-interactions

---

## 2. Semantic Color System & Design Tokens (`globals.css`)

All color applications in SMMplan **MUST** strictly utilize semantic color tokens. Raw hex colors or non-semantic Tailwind utility classes (`text-white`, `bg-black`, `bg-blue-500`) are strictly forbidden.

### `@theme` Definition Matrix (Actual HEX Implementation)

```css
@theme {
  /* ── Background & Off-white base ── */
  --color-background: #f8fafc; /* slate-50 - softer than pure white for bento backdrops */
  --color-foreground: #0f172a; /* slate-900 */

  /* ── Card ── */
  --color-card: #ffffff; /* Pure white cards stand out on slate-50 */
  --color-card-foreground: #0f172a;

  /* ── Popover ── */
  --color-popover: #ffffff;
  --color-popover-foreground: #0f172a;

  /* ── Primary (Friendly Sky Blue) ── */
  --color-primary: #0369a1; /* sky-700 - deep, trusty blue for WCAG AA compliance */
  --color-primary-foreground: #ffffff;

  /* ── Secondary (Soft Interactive Background) ── */
  --color-secondary: #e0f2fe; /* sky-100 */
  --color-secondary-foreground: #0369a1; /* sky-700 */

  /* ── Muted (slate-100 / slate-500) ── */
  --color-muted: #f1f5f9;
  --color-muted-foreground: #475569; /* slate-600 for 4.5:1 contrast on slate-50 */

  /* ── Accent ── */
  --color-accent: #f1f5f9;
  --color-accent-foreground: #0f172a;

  /* ── Destructive (rose-500) ── */
  --color-destructive: #f43f5e;
  --color-destructive-foreground: #ffffff;

  /* ── Borders & Inputs ── */
  --color-border: #e2e8f0;
  --color-input: #ffffff;

  /* ── Focus Ring ── */
  --color-ring: #bae6fd; /* sky-200 */

  /* ── Radius ── */
  --radius: 1.25rem;
}
```

### Light Theme Fact-Checked HEX Values

| Token Name | HEX Value | Description / Usage |
| --- | --- | --- |
| `background` | `#f8fafc` | Main page backdrop (Slate-50) |
| `foreground` | `#0f172a` | Primary text content (Slate-900) |
| `card` | `#ffffff` | Elevated card components |
| `card-foreground` | `#0f172a` | Card text content |
| `popover` | `#ffffff` | Popovers and dropdown menus |
| `popover-foreground` | `#0f172a` | Popover text |
| `primary` | `#0369a1` | Main brand interactive actions (Sky-700) |
| `primary-foreground` | `#ffffff` | Text on primary buttons |
| `secondary` | `#e0f2fe` | Soft interactive backgrounds (Sky-100) |
| `secondary-foreground` | `#0369a1` | Text on secondary elements (Sky-700) |
| `muted` | `#f1f5f9` | Muted backgrounds (Slate-100) |
| `muted-foreground` | `#475569` | Secondary text (Slate-600, WCAG 4.5:1) |
| `accent` | `#f1f5f9` | Hover states and subtle backgrounds |
| `accent-foreground` | `#0f172a` | Text on accent surfaces |
| `destructive` | `#f43f5e` | Danger actions and badges (Rose-500) |
| `destructive-foreground` | `#ffffff` | Text on destructive elements |
| `border` | `#e2e8f0` | Subtle component borders (Slate-200) |
| `input` | `#ffffff` | Form input backgrounds |
| `ring` | `#bae6fd` | Focus outline rings (Sky-200) |

---

## 3. Brand Identity & Logo Architecture

- **Primary Logo**: `<TenantLogo tenantId="smmplan" />`
  - **Icon**: `Zap` (⚡ Lightning bolt in `bg-primary/10` with `border-primary/20`)
  - **Typography**: Semi-bold / Extrabold `SMMplan`
- **Secondary Tenant (SMMflux)**: `<TenantLogo tenantId="flux" />`
  - **Icon**: `Heart` (💖 Heart in `bg-primary/10` with `border-primary/20`)
  - **Typography**: Extrabold `SMMflux`

---

## 4. Interaction & UX Directives

### Zero-Disabled Submit Button Policy
1. **Always Active**: Primary submission buttons ("Оплатить", "Сохранить", "Подтвердить") are **never** rendered with `disabled` states due to incomplete form fields.
2. **Interactive Guidance**: Unfilled or invalid required fields intercept `onSubmit` clicks, triggering JIT visual feedback (e.g. `animate-shake`, highlighted border) and smooth auto-scrolling (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) to the first invalid field.
3. **Error Notice Positioning**: Global server error messages are rendered immediately above the submit action button to maintain optical focal alignment.

---

## 5. Pricing Display Standards

1. **Unit Metric**: Prices presented to end-users in the UI are **ALWAYS** displayed per 1 item (`pricePerUnitRub`), formatted with the suffix `₽ / шт`.
2. **Forbidden UI Patterns**:
   - ❌ Displaying raw bulk provider rates per 1,000 units directly to users.
   - ❌ Writing `/ 1000 шт` in retail pricing labels.
3. **Beautiful Rounding Algorithm**:
   - For prices `< 1000 ₽ / 1000 шт`: Round up to nearest 10 ₽ (`Math.ceil(price / 10) * 10`).
   - For prices `≥ 1000 ₽ / 1000 шт`: Round up to nearest 100 ₽ (`Math.ceil(price / 100) * 100`).

---

## 6. Accessibility & Compliance (WCAG 2.2 AA)

- **Touch Target**: Minimum interactive area `44px x 44px`.
- **Contrast Ratio**: Minimum text-to-background contrast `4.5:1` for normal text and `3:1` for large text/icons.
- **Keyboard Navigation**: Native focus rings with `ring-offset-2 ring-primary` for interactive controls.
