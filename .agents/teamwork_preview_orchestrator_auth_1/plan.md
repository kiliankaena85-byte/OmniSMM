# Iteration 7 Plan: Password Registration & Fallback

## Goal
Address the Victory Auditor's rejection regarding the incomplete Password Auth architecture.

## Findings from Auditor
1. Password Registration is missing. Users cannot sign up if SMTP is down.
2. Existing users without passwords cannot log in when SMTP is down.
3. Magic Link fix was previously deceptive (this was addressed by the worker in Iteration 6).

## Steps
1. Dispatch an Explorer to investigate how to implement Password Registration (adding a signup form) and how to handle existing users without a password when SMTP is down.
2. Dispatch a Worker to implement the Password Registration flow, update the UI (e.g., `register` page or tab), update the backend action (`register-password.ts`), and update tests.
3. Dispatch Reviewers to verify the implementation.
4. Gate check and claim victory.
