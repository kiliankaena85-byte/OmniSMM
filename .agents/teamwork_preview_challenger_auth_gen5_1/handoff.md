# Handoff Report

## 1. Observation
I reviewed the Gen5 auth fallback fixes in `src/actions/auth/request-magic-link.ts`, specifically focusing on the asynchronous SMTP background task:
```typescript
    Promise.resolve().then(async () => {
      try {
        await sendMagicLink(cleanEmail, rawToken);
        if (isNewUser) {
          sendWelcomeLetter(cleanEmail).catch(console.error);
        }
      } catch (smtpError) {
        ...
        if (isNewUser) {
          try {
            await db.user.delete({ where: { id: user.id } });
          } catch (e) { ... }
        }
      }
    });
```
I ran adversarial stress tests (`test-floating-promise.ts` and `test-async-throw.ts`) simulating synchronous and asynchronous failures inside `sendMagicLink`, `sendWelcomeLetter`, and `db.user.delete`. 

- When `sendMagicLink` rejects, the error is safely caught by the `catch (smtpError)` block.
- When `db.user.delete` rejects, it is safely caught by the inner `catch (e)` block.
- When `sendWelcomeLetter` rejects (or synchronously throws within the async function), the `.catch(console.error)` handler safely intercepts it without throwing an `unhandledRejection`.

## 2. Logic Chain
1. To crash a Node.js process via an uncaught promise rejection, a promise must reject without any attached `.catch()` or `try...catch` block.
2. The `Promise.resolve().then(async () => { ... })` creates a "fire-and-forget" floating promise. If the inner `async` function threw an uncaught error, it would cause an `unhandledRejection` and crash the Node process.
3. However, the entire body of the `async` function is wrapped in a `try...catch` block. 
4. The only way an error could escape is if the `catch (smtpError)` block itself threw an error. This block only executes `log.error`, `console.error`, `log.info`, and a `db.user.delete` operation.
5. The `db.user.delete` operation is strictly wrapped in its own `try...catch (e)` block, preventing Prisma errors from escaping.
6. `log.error` and `console.error` do not throw exceptions.
7. Therefore, it is mathematically impossible for this specific floating promise to trigger an `unhandledRejection`.

## 3. Caveats
- **Serverless Execution Context**: While the Node.js process won't crash, Next.js Server Actions running in a Serverless environment (like Vercel) may freeze the execution context as soon as `return { success: true }` is executed. This means the floating promise might be abruptly terminated before sending the email. Next.js 15+ recommends using `unstable_after()` or `waitUntil()` for background tasks.
- **Race Condition / False Deletion**: If the SMTP provider (e.g., Resend) experiences high latency and times out the HTTP request, `sendMagicLink` will throw an error, triggering the user deletion logic. However, the email might still be delivered a few seconds later. If the user clicks the link, their account will already be deleted.

## 4. Conclusion
**PASS.** 
There are NO uncaught promise rejections in the asynchronous SMTP background task that could crash the Next.js Node process. The error handling boundaries are completely sealed. The system correctly isolates SMTP failures and prevents them from leaking unhandled rejections into the Node.js event loop.

## 5. Verification Method
1. To verify the safety of the floating promise, run the adversarial script located at `test-floating-promise.ts` and `test-async-throw.ts` in the project root.
2. Observe that Node.js gracefully exits without throwing `UnhandledPromiseRejectionWarning` or terminating with a non-zero exit code.
3. Command: `npx tsx test-floating-promise.ts` and `npx tsx test-async-throw.ts`.
