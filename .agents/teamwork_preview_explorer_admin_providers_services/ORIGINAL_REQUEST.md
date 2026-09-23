## 2026-06-12T07:05:26Z
You are the Providers & Services Explorer.
Your working directory is: d:\SMM_plan_2\.agents\teamwork_preview_explorer_admin_providers_services
Your task is to conduct a deep logical audit of the Providers, Services, and Catalog Import modules in the Smmplan admin panel.
1. Analyze files in:
   - src/app/admin/providers/
   - src/app/admin/services/
   - src/app/admin/catalog/
   - src/actions/admin/catalog.ts
   - src/actions/admin/routing.actions.ts
   - (And any providers action in src/actions/admin/providers/)
2. Trace the User Flow for importing services (Cherry-Pick) from provider catalog, or changing provider routing (Hot Swap). Follow it from the UI components to Server Actions to DB/Redis.
3. Identify bugs, mock code, security vulnerabilities, and logical discrepancies (such as price calculation errors, quarantine bypasses, or lack of CB rates sync validation).
4. Write a detailed report `handoff.md` in your working directory with concrete file paths and line numbers for each finding.
