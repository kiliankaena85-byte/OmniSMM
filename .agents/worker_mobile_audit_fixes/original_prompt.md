## 2026-06-09T12:16:26Z
You are teamwork_preview_worker.
Your working directory is d:\SMM_plan_2\.agents\worker_mobile_audit_fixes\ (please write your plans, progress, and handoff there).
Your role is: Mobile Visual Audit Fixes Implementer.

Your mission is to implement style and layout fixes for Smmplan's mobile layout visual audit task (Milestone 2 and 3).
Here is the scope of fixes you must perform:

1. Table Header Contrast in Light Mode:
- In `src/app/dashboard/orders/page.tsx` line 186, change the muted table header text color class to a semantic variable that provides a contrast ratio >= 4.5:1 on light background. For example, use `text-foreground/75` instead of `text-muted-foreground`.
- In `src/components/dashboard/transactions/TransactionsClient.tsx` line 336 and 402, adjust the muted header text classes (e.g. from `text-muted-foreground` to a higher-contrast semantic token like `text-foreground/75` or similar).

2. Touch Target Sizing (minimum 44x44px):
- In `src/app/dashboard/orders/[id]/page.tsx` line 66-72, modify the Back Button (which currently uses `w-10 h-10`) to have a size of at least `w-11 h-11` (44px) or `w-12 h-12` (48px) and ensure its interior elements/padding match.
- In `src/app/dashboard/smart-drip/smart-client.tsx` line 201-217, modify the Play/Pause button container/button class (currently `h-8`) to be at least `h-11 w-11` (or `min-h-[44px] min-w-[44px]`) with a flex centering layout so that the touch target is at least 44x44px.
- In `src/components/dashboard/transactions/TransactionsClient.tsx` line 234-267, increase the padding/height of the Type Filters tab buttons (currently `py-1.5`) to at least `min-h-[44px]` (or `py-2.5 px-4 text-sm font-bold`) so they have a proper touch target height of at least 44px.
- In `src/components/dashboard/transactions/TransactionsClient.tsx` line 274, 295, 302, ensure the Date Selector, Search Input bar, and Statement Printer button have height/touch targets >= 44px (e.g. `h-11` or `min-h-[44px]`).
- In `src/components/dashboard/transactions/TransactionsClient.tsx` line 310-324, ensure the Accountant Mode toggle button and its parent container have hit targets >= 44px (e.g. height `h-11`).

3. Mobile Layout Table Scroll:
- In `src/components/dashboard/transactions/TransactionsClient.tsx`, build a responsive card-based mobile transaction list component named `MobileTransactionList` which dynamically renders each transaction entry (different properties for user mode and accountant mode).
- Hide the desktop tables on mobile viewports using `hidden md:block` and display the `MobileTransactionList` using `md:hidden` (or block).
- Ensure this eliminates any horizontal scrolling or container overflows on viewports from 320px to 480px width.

4. Tooling Portability & Configuration Fixes:
- In `scripts/synthetic-ux-lab/visual-audit-cli.ts` line 5, replace the hardcoded absolute path `C:/Users/Артём/.gemini/antigravity/brain/f32ad398-9c40-4383-8245-6568e47faf97` with a portable alternative, e.g. `process.env.AUDIT_OUTPUT_DIR || path.join(process.cwd(), 'visual_audit_assets')`.
- In `scripts/generate-all-audit-assets.ts` line 24, update the breakpoints array so that it specifically captures the target breakpoints: `320px` (320x568), `390px` (390x844), and `430px` (430x932). Ensure they are properly captured in standard and grayscale.

5. Enforce Design Conventions:
- Adhere strictly to the Zero-Defect Execution Protocol and design conventions from AGENTS.md.
- Never use inline/hardcoded hex colors or standard color names (like text-white, text-blue-500). Use only semantic HSL tokens (e.g. `text-foreground`, `text-primary`, `bg-background`).
- Respect Cyrillic typography rules (+15-20% text expansion padding for buttons, `leading-relaxed` or line-height 1.5-1.6).
- Only Light Mode fixes must be implemented. Dark Mode findings are marked as [OUT OF SCOPE].

6. Build, Typecheck, and Test Verification:
- Once fixes are implemented, compile and verify the project using these commands:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run build`
- Run the visual asset generator `npx tsx scripts/generate-all-audit-assets.ts` to capture the new mobile viewport screenshots (standard and grayscale) and save them under `visual_audit_assets/`.
- Ensure all Playwright visual tests run and pass cleanly: `npx playwright test e2e/visual-regression.spec.ts`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please load and consult the `d:\SMM_plan_2\.agent\skills\delivery-engineer-v3\SKILL.md` skill to execute this task. Write a detailed handoff report in your folder `handoff.md` and send us a message when done with paths to findings and verification logs.
