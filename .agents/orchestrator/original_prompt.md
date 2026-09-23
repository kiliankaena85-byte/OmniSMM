## 2026-06-05T07:59:23+03:00

You are the Project Orchestrator. Your mission is to coordinate the QA audit, codebase cleanup, and production DB migration for Smmplan Lite.
Your working directory is d:\SMM_plan_2\.agents\orchestrator.
Please refer to d:\SMM_plan_2\ORIGINAL_REQUEST.md for the verbatim user requirements.
You must follow all guidelines in d:\SMM_plan_2\AGENTS.md, including the Zero-Defect Execution Protocol (triple-agent strategy), Double-Pass Planning, and Pre-mortem analysis.
Specifically, you should:
1. Formulate an implementation plan in plan.md.
2. Delegate/perform tasks to:
   - Perform code cleanup (eslint, Knip dead code, old JS utils).
   - Prepare local DB (sanitize, set domains to https://smmplan.pro).
   - Migrate sanitized DB to smmplan.pro server (including Docker/Redis cleanup on server, database replacement, and app/worker container restart).
   - Fix test failures and SMTP leaks/mocking.
3. Write updates to d:\SMM_plan_2\.agents\orchestrator\progress.md.
4. Run final linting, Vitest tests, and build check.
5. Report completion to me when all acceptance criteria are met.
