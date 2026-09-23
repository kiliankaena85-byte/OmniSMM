# Handoff Report: Password Registration & Email Verification Strategy

## 1. Observation
1. **Current UI state**: The file `src/app/(auth)/login/login-form.tsx` currently contains three tabs: "Войти по паролю", "Войти по ссылке", and "Регистрация". The Registration tab is fully implemented UI-wise.
2. **Current Backend state**: The action `src/actions/auth/password-register.ts` exists and successfully creates a new user with a hashed password, logging them in immediately.
3. **Existing Users limitation**: In `password-register.ts` (lines 45-47), if an email already exists (e.g., a user who previously logged in via Magic Link but has no password), the registration action returns: `"Пользователь с таким email уже зарегистрирован. Пожалуйста, войдите."`
4. **Settings functionality**: The file `src/actions/auth/password-settings.ts` already contains a `setPasswordAction` allowing a logged-in user to set a password if they don't have one.
5. **Schema limitation**: The `schema.prisma` `User` model currently lacks an `emailVerified` flag, meaning all users are inherently trusted once created.

## 2. Logic Chain
1. **UI Location**: The "Register" tab in `login-form.tsx` is an appropriate place for *new* users. However, for *existing* Magic Link users wanting to set a password, they cannot use this tab (they hit the "User already exists" error). They must log in via Magic Link and use the Settings page.
2. **Backend Actions**: `password-register.ts` correctly handles creating new users and hashing passwords. `password-settings.ts` correctly handles existing users.
3. **Email Verification Problem**: The auditor requested Password Auth so users can sign up/in when SMTP is down. If SMTP is down, we *cannot* verify emails. However, allowing unverified registrations means an attacker can register an account with a victim's email, set a password, and lock the victim out (or spy on their account).
4. **Conclusion on Email Verification**: To balance security and the "SMTP is down" fallback requirement, we must allow unverified registrations but restrict account takeover. If an attacker registers `victim@email.com` and later the victim uses a Magic Link to log in, the Magic Link action must be allowed to override or reset the unverified password, or we must implement an `emailVerified` flag. Since `schema.prisma` cannot be modified without a migration, the simplest immediate strategy is to allow registration but acknowledge the risk.

## 3. Caveats
- We assume that the primary goal of adding Password Registration is to bypass SMTP outages.
- If we do not add an `emailVerified` column, we treat password-registered users identically to magic-link-registered users.
- An attacker squatting on an email could be a vector for social engineering or receiving the victim's order receipts.

## 4. Conclusion & Fix Strategy
### Answer to Q1: Where should the UI live?
- **For New Users:** Keep the "Регистрация" tab in `src/app/(auth)/login/login-form.tsx`.
- **For Existing Magic Link Users:** They should NOT use the Registration tab. Add a text hint to the Registration tab stating: *"Если вы уже входили по ссылке, войдите в аккаунт и установите пароль в Настройках."* The flow for existing users is to log in via Magic Link and use the Dashboard Settings.

### Answer to Q2: What backend actions are needed?
- `src/actions/auth/password-register.ts` is already present but must be tracked in git. It securely hashes and stores the password for new users.
- `src/actions/auth/password-settings.ts` is already present for existing users.
- No new actions are needed, just wiring them up securely.

### Answer to Q3: Do we need to verify their email?
- **Strictly speaking, YES.** However, if the business requirement is to allow signups *when SMTP is down*, you **cannot** verify the email.
- **Recommended Strategy (To implement by Worker):**
  1. Allow password registration without email verification (satisfies the SMTP fallback requirement).
  2. **Security Mitigation:** In `request-magic-link.ts` and `password-login.ts`, if a user logs in successfully via Magic Link, this proves they own the email. We should consider any Magic Link login as implicit verification. If we ever add an `emailVerified` field, Magic Link sets it to `true`. For now, we accept the minor risk of email squatting to ensure availability during SMTP downtime.

## 5. Verification Method
- **UI check:** Run `npm run dev` and navigate to `/login`. Verify the "Регистрация" tab is visible and has the hint for existing users.
- **New User Test:** Try registering a new email/password. Ensure it logs in and creates a DB record.
- **Existing User Test:** Create a user via Magic Link. Try registering with that same email. Verify it shows the "User already exists" error. Then log in and set the password in the dashboard settings.
- **Test Commands:** Run Vitest tests `npm run test` to ensure both `password-register.ts` and `password-settings.ts` pass all authentication flow tests.
