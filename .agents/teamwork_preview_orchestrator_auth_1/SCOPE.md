# Scope: Authentication Fix & Password Fallback

## Architecture
- `schema.prisma`: Needs `passwordHash` field on the User model.
- Auth routing: Updates to NextAuth options or custom auth handlers to accept password credentials.
- UI: Login form updates to allow password input.
- Tests: Vitest tests for both auth mechanisms.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Magic Link Fix | Fix the "something went wrong" error in magic link login. | none | DONE |
| 2 | Password Auth | Add password fields and backend logic. | none | DONE |
| 3 | Automated Testing | Write Vitest tests for auth logic. | M1, M2 | DONE |

## Interface Contracts
### Auth API
- Accepts email/password for credentials login.
- Accepts email for magic link login.
