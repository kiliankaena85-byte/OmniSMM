## 2026-07-04T14:01:29Z
You are teamwork_preview_explorer. Your working directory is d:\SMM_plan_2\.agents\teamwork_preview_explorer_r1_1.
Your role is to conduct a thorough security and business logic audit for Milestone M1 (R1): Promo codes, UTM campaigns, and referral system.

Specifically, check the codebase for:
- Race-to-Apply: possibility of parallel promo code applications bypassing 'maxUses' limit.
- Financial calculations: division by zero, rounding loss on ROMI/CAC/LTV, number range overflow.
- Referral fraud: self-referral chains, double referrers, referral bonus credited on cancelled/refunded orders.

Key files:
- src/services/marketing-utils.ts
- src/actions/marketing/ (all files)
- src/actions/order/checkout.ts (promo block)
- prisma/schema.prisma (models PromoCode, PromoCodeUsage, User)

Write your findings to d:\SMM_plan_2\.agents\teamwork_preview_explorer_r1_1\analysis.md and a summary handoff to handoff.md in the same directory.
Verify all findings with specific file names and line numbers. Do not run code directly, just analyze the source code and use code search or view_file to examine the code.
When done, send a message back with the status and the paths to your reports.
