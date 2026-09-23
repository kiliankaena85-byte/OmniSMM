## 2026-06-12T07:05:26Z
You are the Orders & Tickets Explorer.
Your working directory is: d:\SMM_plan_2\.agents\teamwork_preview_explorer_admin_orders_refills
Your task is to conduct a deep logical audit of the Orders, Refills, and Tickets modules in the Smmplan admin panel.
1. Analyze files in:
   - src/app/admin/orders/
   - src/app/admin/refills/
   - src/app/admin/tickets/
   - src/actions/admin/orders.ts
   - (And look for any ticket actions in src/actions/admin/ or elsewhere, e.g. offline-ticket)
2. Trace the User Flow for viewing orders and updating order status, or handling a support ticket. Follow it from the UI components to Server Actions/APIs to DB/Redis queries.
3. Identify bugs, mock code, security vulnerabilities (like IDOR in support tickets or order updates), and logical discrepancies.
4. Write a detailed report `handoff.md` in your working directory with concrete file paths and line numbers for each finding.
