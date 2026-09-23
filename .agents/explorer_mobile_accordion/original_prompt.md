## 2026-06-10T04:40:12Z
You are teamwork_preview_explorer. Your working directory is d:\SMM_plan_2\.agents\explorer_mobile_accordion.
Please perform the following exploration tasks:
1. Run GraphRAG query to find context: run command `npx tsx scripts/query-rag.ts "MobileWizard progressive disclosure and accordion wizard"` and read the response.
2. Run the plan density linter on d:\SMM_plan_2\.agents\orchestrator_mobile_accordion\plan.md using the python script in the plan-re-evaluation skill:
   `python d:\SMM_plan_2\.agent\skills\gsd-plan-re-evaluation\scripts\plan_density_linter.py d:\SMM_plan_2\.agents\orchestrator_mobile_accordion\plan.md`
   Report the output of this script.
3. Explore the layout and imports in src/components/landing/order-engine/MobileWizard.tsx and verify if they match design system tokens.
Write your findings to handoff.md in your working directory and notify the parent orchestrator with the details.
