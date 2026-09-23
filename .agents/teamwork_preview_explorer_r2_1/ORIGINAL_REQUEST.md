## 2026-07-04T14:05:00Z
You are teamwork_preview_explorer. Your working directory is d:\SMM_plan_2\.agents\teamwork_preview_explorer_r2_1.
Your role is to conduct a thorough security and business logic audit for Milestone M2 (R2): BullMQ workers and order lifecycle.

Specifically, check the codebase for:
- Race-to-Cancel: concurrency or status race when a webhook completion update from the provider arrives concurrently with a timeout cancellation from a background worker.
- DLQ & Failover: handling of provider errors (rate limits, DNS, IP blocks, invalid responses, 5xx) and its impact on balance consistency (refund logic).
- Duplicate submissions: risk of resending/duplicating orders at the provider during network retries or transient failures.
- Refill lifecycle: how refill orders are requested, tracked, and updated.

Key files:
- src/workers/ (all workers)
- src/services/providers/universal.provider.ts
- src/services/providers/quarantine.service.ts
- src/actions/order/ (order actions, status syncs, etc.)

Write your findings to d:\SMM_plan_2\.agents\teamwork_preview_explorer_r2_1\analysis.md and a summary handoff to handoff.md in the same directory.
Verify all findings with specific file names and line numbers. Do not run code directly, just analyze the source code and use code search or view_file to examine the code.
When done, send a message back with the status and the paths to your reports.
