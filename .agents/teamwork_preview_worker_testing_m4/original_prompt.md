## 2026-06-08T04:34:40Z

You are a Teamwork Worker. Your task is to fix the issues in Milestone 4 (R3: Playwright E2E User Flow Tests).

1. Kill stale node processes to free `.next/lock`:
   - Run taskkill or Stop-Process to terminate any stale node processes holding `.next/lock` (e.g. PID 15780 or any other stale node build processes).
   - Clear the `.next` directory if needed.
   - Clean/rebuild the application under the test environment:
     ```bash
     npx dotenv -e .env.test -- npm run build
     ```

2. Fix the test cases in `e2e/user-flow.spec.ts`:
   - **Fix 1 (Likes Tab)**: In the test 'should enforce link targetType validations (CHANNEL vs POST) and show validation errors', select the category 'E2E Telegram Likes' and select service 'E2E Likes Service' *before* filling in the invalid channel link (`https://t.me/durov`). This ensures the tab doesn't get filtered out when the channel link is detected.
   - **Fix 2 (Subscribers Tab)**: In the same test, also select the category 'E2E Telegram Subscribers' and service 'E2E Subscribers Service' *before* filling in the invalid post link (`https://t.me/durov/123`).
   - **Fix 3 (Instagram Stories Link)**: In the test 'should enforce link targetType validations (STORY vs CUSTOM) and show validation errors', Case A, use an Instagram post link (like `https://instagram.com/p/abc/` or `https://www.instagram.com/p/C0f9g4xN8a9/`) instead of `https://t.me/durov`. This ensures the platform remains Instagram (doesn't trigger auto-switch to Telegram) while triggering the profile validation error for story services.

3. Verification:
   - Run the Playwright tests to verify that they pass:
     ```bash
     npx playwright test e2e/user-flow.spec.ts
     ```
   - Ensure that `npx tsc --noEmit` and `npm run lint` pass cleanly with zero errors.

4. Handoff:
   - Document your changes, files modified/created, test execution results, and build success in `d:\SMM_plan_2\.agents\teamwork_preview_worker_testing_m4\handoff.md`.
   - Send a message to the parent orchestrator when done.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your working directory for agent metadata is: `d:\SMM_plan_2\.agents\teamwork_preview_worker_testing_m4`
