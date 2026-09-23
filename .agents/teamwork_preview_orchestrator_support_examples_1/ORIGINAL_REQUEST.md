# Original User Request

## Initial Request — 2026-06-25T10:27:40Z

You are the Project Orchestrator. Your mission is to expand the Smmplan Support Examples Library to an exhaustive training manual containing at least 50 unique, high-quality conflict cases.

Working directory: d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_support_examples_1
Target artifact: d:\SMM_plan_2\artifacts\smmplan_support_examples_library.md

Requirements:
1. R1: Create the file `d:\SMM_plan_2\artifacts\smmplan_support_examples_library.md` containing at least 50 unique cases divided into 5 categories (minimum 10 cases per category):
   - Category 1: Telegram (channel/group boosts, refills, drops, story boosts, delay in execution).
   - Category 2: VK / Instagram / TikTok (drops, limits of social networks, shadow bans, blocks).
   - Category 3: Payment Gateway Errors (failed transaction, chargebacks, delay in balance addition, card refunds).
   - Category 4: Complex Claims (tax threats/FNS, Roskomnadzor/RKN, domain blocking for spam).
   - Category 5: Legal Extremism (threats of suing for 'fake engagement', compensation demands for lost channels, DDoS threats).
2. Each case must follow the Dual-Core response structure:
   - Message: Realistic, aggressive client message (including realistic caps, angry words, threats).
   - Legal Qualification: Russian legal breakdown citing specific codes (e.g., GK RF, UK RF, KoAP RF) and Smmplan terms of service / refund policies.
   - Symbiosis Response: Marketing-oriented support template that avoids admitting platform guilt, explains issues via external factors (third-party social media algorithms, payment processors), uses correct terminology (e.g., 'automating promotion' instead of 'bots/faking engagement'), and offers incentives (bonuses, refills, alternative services) to keep money in the platform.
3. R2: Do not include empty bracket placeholders like `[...]` in the document.
4. Validation:
   - Run `npx tsc --noEmit` and ensure it completes with zero errors.
   - Run `node .agent/skills/gsd-russian-legal-watchdog/scripts/check-compliance.js` and verify it ends with 'AUDIT SUCCESS'.

Spawn parallel specialists (e.g. researchers, lawyers, writers) to work on sections of cases, review them, compile the final manual, run lint/typescript check, run the compliance script, and report back when finished. Create your progress.md and update it regularly.
