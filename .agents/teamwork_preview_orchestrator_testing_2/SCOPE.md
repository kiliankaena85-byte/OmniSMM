# Scope: SMMplan Critical Flows E2E Testing

## Architecture
The E2E testing verifies the core user flows of SMMplan in the local production environment (http://localhost:3000) using Playwright.
- **Client flow**: Registration, login, new order placement using a Vexboost service, checking balance deduction and order state.
- **Support flow**: Ticket creation by client, operator login (`support@smmplan.test` / `SupportPassword2026!`), unified workspace navigation, SSE real-time reply, status close.
- **Loss prevention flow**: Cancel active order with `isCancelEnabled = false` blocked with warning, support refund limit verification.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Client Registration & Ordering Flow | Register/Login user, place order, verify balance decrement and status | None | PLANNED |
| 2 | Ticket Support & SSE Flow | Create ticket, operator login, reply via SSE, close ticket | M1 | PLANNED |
| 3 | Loss Prevention & Support Limits Verification | Block order cancellation, support compensation limit check | M2 | PLANNED |

## Interface Contracts
- Tests must target http://localhost:3000.
- Browser videos/screenshots must be saved in `d:/SMM_plan_2/artifacts`.
- A structured walkthrough report `E2E_WALKTHROUGH.md` must be produced.
