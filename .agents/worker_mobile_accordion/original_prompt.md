## 2026-06-10T04:43:54Z
You are teamwork_preview_worker. Your working directory is d:\SMM_plan_2\.agents\worker_mobile_accordion.

Your objective is to:
1. Redesign the mobile order wizard in `src/components/landing/order-engine/MobileWizard.tsx` into a progressive collapsible accordion-wizard flow.
   - Introduce `activeStep` (1, 2, 3, or 4) and `lastResolvedUrl` states.
   - Set up the auto-advance useEffect hook to advance only when the url changes and is valid.
   - Refactor the component into 4 collapsible panels: Step 1 (URL), Step 2 (Category), Step 3 (Tariff), Step 4 (Checkout Parameters).
   - Display a collapsed card for Steps 1, 2, and 3 when they are not the active step and have selected values. The Step 1 collapsed card MUST contain the label "Ссылка:" so it can be located by tests.
   - Fix the design system violation on lines 220-224 by replacing `bg-white/20 text-white` with `bg-current/20 text-current`.
   - Add back buttons: in Step 3 to go to Step 2, and in Step 4 to go to Step 3.
2. Update the visual regression mobile test `9. Mobile UX Warning Block and Validation Checkbox` in `e2e/visual-regression.spec.ts`:
   - Locate and click the collapsed Step 1 card (e.g., button containing "Ссылка:") to expand Step 1 before filling `https://t.me/durov/12`.
3. Verify all changes:
   - Run compilation check: `npx tsc --noEmit`
   - Run ESLint lint check: `npm run lint`
   - Run visual regression tests: `npm run test:visual` (specifically verify that test 9 passes).
4. Write your execution results and verification command outputs to handoff.md in your working directory and notify the Project Orchestrator when done.
