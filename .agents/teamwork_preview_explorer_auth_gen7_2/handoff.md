# Handoff Report: Password Registration Investigation

## 1. Observation
- `src/app/(auth)/login/login-form.tsx` already contains a "Register" tab that submits an email and password to `registerWithPasswordAction`.
- `src/actions/auth/password-register.ts` currently exists and processes the registration. It hashes the password using `hashPassword` and creates a `User` with `isActive: true`, immediately creating a session.
- The `User` model in `prisma/schema.prisma` does not have an `emailVerified` flag. It has an `isActive` flag, which defaults to `true`.
- In `src/actions/auth/request-magic-link.ts`, if SMTP fails for a *new* user, the user is deleted to prevent dead unverified accounts.

## 2. Logic Chain
- **Where should the UI live?**
  - For **new users**, the existing "Register" tab in `login-form.tsx` is the correct placement.
  - For **existing users** who previously logged in via Magic Link and have no password, they need a way to set one. Since they are already authenticated, the most secure place is within the authenticated dashboard (e.g., `src/app/dashboard/profile/page.tsx` or a dedicated modal prompt).
- **What backend actions are needed?**
  - We have `registerWithPasswordAction`, but it currently logs the user in immediately without verifying the email. This is a vulnerability as it allows malicious actors to claim arbitrary email addresses.
  - We need a new action: `setPasswordAction` for existing authenticated users. It would accept a new password, hash it, and update their `passwordHash`.
  - We need a `verifyEmailAction` (or reuse the Magic Link verification logic) to handle the verification token click after a password registration.
- **Do we need to verify their email?**
  - **Yes, absolutely.** Allowing password registration without email verification is a severe security risk. An attacker could register the email of an administrator or a legitimate API client.
  - **Implementation using existing schema:** `registerWithPasswordAction` should create the user with `isActive: false` and generate an `AuthToken`. It should then send a verification email containing the token link. Once the token is clicked, we set `isActive: true` and authenticate them.
  - **The SMTP Downtime Paradox:** The plan implies we want users to sign up when SMTP is down. However, if SMTP is down, users fundamentally cannot verify email ownership. We cannot securely bypass email verification just because SMTP is down. If SMTP is down, new user registration must fail gracefully. To protect existing users from SMTP downtime, we must proactively prompt them to set a password via the Dashboard *while SMTP is operational*.

## 3. Caveats
- I did not modify code, as instructed.
- Adding `isActive: false` upon registration assumes the authentication flows (e.g., `password-login.ts`) respect the `isActive` flag and block login for inactive users.
- If business logic strictly demands allowing signups during SMTP downtime despite security risks, we would need to implement an "unverified" state (by modifying `schema.prisma` to add `isEmailVerified`), restrict their permissions, and prompt for verification later. However, without schema changes, we must rely on `isActive: false` and enforce verification.

## 4. Conclusion
1. **UI Placement**: Keep the "Register" tab in `login-form.tsx` for new users. Add a "Set Password" form in the Dashboard (`/dashboard/profile`) for existing users.
2. **Backend Actions**:
   - Refactor `registerWithPasswordAction` to create the user with `isActive: false` and send a verification email via `AuthToken`.
   - Create `setPasswordAction` (protected) for authenticated users to set their `passwordHash`.
3. **Email Verification**: Email verification is **mandatory** for new password registrations to prevent account hijacking. If SMTP is down, new registrations cannot be securely completed.

## 5. Verification Method
- **To verify UI**: Inspect `src/app/(auth)/login/login-form.tsx` for the existing register tab.
- **To verify Backend Vulnerability**: Review `src/actions/auth/password-register.ts` and confirm it lacks email verification and sets `isActive: true`.
- **To verify Logic**: Try registering a fake email via the UI and observe that the account is created and logged in immediately without verification.
