# Project: Smmplan Support Examples Library

## Architecture
This project is an expansion of the support training documentation. The goal is to generate a comprehensive, 50-case support manual covering common conflict areas in Smmplan.
The final file must be saved at: `d:\SMM_plan_2\artifacts\smmplan_support_examples_library.md`

## Milestones
| # | Milestone Name | Scope | Workers / Subagents | Status |
|---|----------------|-------|---------------------|--------|
| 1 | Category 1 Cases | Telegram (10 cases) | Worker 1 (Conv: 2b5b156e-b1ac-4df7-abc1-f986d43084c7) | DONE |
| 2 | Category 2 Cases | VK / Instagram / TikTok (10 cases) | Worker 2 (Conv: 7e0923cc-da66-4ced-9cd3-ad83c13441f8) | DONE |
| 3 | Category 3 Cases | Payment Gateways (10 cases) | Worker 3 (Conv: 4fff9257-70a4-43b5-966c-e793fc3fc7ae) | DONE |
| 4 | Category 4 Cases | Complex Claims (10 cases) | Worker 4 (Conv: fd44fea7-7443-4ce5-b25a-272d4a1db0a3) | DONE |
| 5 | Category 5 Cases | Legal Extremism (10 cases) | Worker 5 (Conv: 4d37ca46-e8b8-46eb-9663-4f38d513c2af) | DONE |
| 6 | Aggregation & Audit | Compile all, run npx tsc, run check-compliance.js | Worker 6 (Conv: 0eaa605e-6d85-44af-90e6-06bb125757f3) | DONE |

## Case Structure
Each case must have:
1. **Message**: A realistic, angry client message (Russian, CAPS, punctuation, aggressive words, threats).
2. **Legal Qualification**: Detailed analysis citing specific RF laws (e.g. GK RF, UK RF, KoAP RF, Law on Consumer Rights Protection / ZoZPP, 152-FZ, 54-FZ) and Smmplan Terms / Refund policies.
3. **Symbiosis Response**: A response combining marketing (empathy, professional terminology: "автоматизация продвижения показателей", "корректировка показателей", "применение защитных алгоритмов со стороны третьей стороны", no admission of guilt, offers refill/bonus/discount) and legal firmness.

## Key Constraints
- NO empty bracket placeholders like `[...]` or `<...>` in the text. All names, URLs, IDs, and dates must be realistic and complete.
- Verify with `npx tsc --noEmit` and `node .agent/skills/gsd-russian-legal-watchdog/scripts/check-compliance.js`.
