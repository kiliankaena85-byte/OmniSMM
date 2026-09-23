# 💎 Admin Panel Premium Audit (v3.1)

## 📌 Context
The Smmplan "Infinite Chat" (Support) was recently upgraded to a Premium UI/UX standard (Glassmorphism, Framer Motion, Semantic Tokens). However, the rest of the 8-tab Admin Panel still contains "cheap" design patterns and hardcoded colors from the MVP phase. 
This audit applies the `gsd-premium-audit` framework to the `src/app/admin` and `src/components/admin` directories.

---

## 🛠️ Matrix of Deficiencies

### 1. Semantic Tonal Consistency (Light/Dark Mode Support)
**Issue:** The Admin Panel uses hardcoded colors (`bg-slate-900`, `text-sky-400`, `bg-emerald-500/15`) instead of HeroUI semantic tokens (`bg-content1`, `text-primary`, `bg-success/15`). This breaks consistency when switching between Light and Dark modes.
*   `layout.tsx`: Mobile nav uses `bg-slate-900`. Test mode banner uses `from-amber-500 via-orange-500`.
*   `sidebar.tsx`: Heavily hardcoded with `bg-slate-950/98`, `hover:bg-sky-500/20`, `text-emerald-400`.
*   **Resolution:** Migrate all hardcoded colors to semantic tokens (`bg-primary`, `bg-warning`, `text-foreground`, `bg-content2`).

### 2. Loading States & Transitions (Skeleton Framework)
**Issue:** Transitioning between heavy tabs (e.g., from Orders to Finance) lacks smooth `useTransition` loading states. Data often "pops" in, shifting the layout.
*   **Resolution:** Introduce `React.Suspense` boundaries with premium `<Skeleton className="rounded-xl" />` or `motion.div` loaders for data tables in the main layout.

### 3. Empty States & Microcopy
**Issue:** Empty tables (like in `catalog-table-v2.tsx`) use basic SVG icons (`<ShoppingCart className="opacity-20" />`) with generic text "Нет услуг".
*   **Resolution:** Implement a unified `PremiumEmptyState` component using Glassmorphism (`bg-content1/50 backdrop-blur`), Lucide React icons, and actionable, emotionally intelligent microcopy.

### 4. TanStack Table Refinement
**Issue:** Tables may have hard 1px borders (`border-b border-border`) instead of using tonal contrast (e.g., striped backgrounds or hover highlights) to separate rows. Pagination controls often look standard.
*   **Resolution:** Ensure all tables use `border-transparent` row separators with `hover:bg-content2` and rounded cell edges (`first:rounded-l-lg last:rounded-r-lg`).

### 5. Dialogs and Modals (Framer Motion)
**Issue:** Modals (e.g., User Edit, Quarantine Actions) may rely on native HTML dialogs or un-animated HeroUI defaults.
*   **Resolution:** Wrap crucial modals in `<AnimatePresence>` for spring-based scale-in/scale-out animations.

---

## 🚀 Execution Plan

1.  **Phase 1: Token Migration** 
    *   Refactor `sidebar.tsx` and `layout.tsx` to use HeroUI semantic tokens.
2.  **Phase 2: Empty States** 
    *   Create a `<PremiumEmptyState />` component and apply it to Catalog, Orders, and Clients.
3.  **Phase 3: Suspense Skeletons** 
    *   Add `loading.tsx` to major routes in `/admin` with `framer-motion` pulse effects.
4.  **Phase 4: Component Polish**
    *   Update buttons, alerts, and badges across the admin panel to remove "flat" designs and add subtle `box-shadow` or `backdrop-blur`.

*Status: Pending Execution*
