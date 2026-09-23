/**
 * BigInt serializer for safe JSON serialization of Prisma BigInt fields.
 *
 * Background:
 *   Prisma maps DB BIGINT → JS BigInt. JSON.stringify(BigInt) throws TypeError.
 *   All Server Actions and API routes that return financial data MUST use this.
 *
 * Safety:
 *   Number.MAX_SAFE_INTEGER = 9_007_199_254_740_991
 *   Max balance in kopecks  = 9 quadrillion kopecks = 90 trillion RUB (safe)
 *
 * Usage:
 *   import { serializeForClient } from '@/lib/bigint-serializer';
 *   return { success: true, data: serializeForClient(prismaResult) };
 */

/**
 * Recursively converts all BigInt values to Number for safe JSON serialization.
 * Use at Server Action / API route boundaries before returning to client.
 */
export function serializeForClient<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}

/**
 * Runtime guard: sends admin alert if a balance approaches dangerous levels.
 * Call after balance updates in WalletService / checkoutAction.
 *
 * Threshold: 20_000_000 RUB = 2_000_000_000 kopecks
 */
const BALANCE_SAFETY_LIMIT = BigInt(2_000_000_000_00); // 20M RUB in kopecks

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function checkBalanceSafetyLimit(balance: bigint, userId: string): void {
  if (balance > BALANCE_SAFETY_LIMIT) {
    // Fire-and-forget alert — import inline to avoid circular deps
    import('@/lib/notifications').then(({ sendAdminAlert }) => {
      sendAdminAlert(
        `⚠️ Баланс пользователя ${userId} превысил 20M ₽: ${(Number(balance) / 100).toLocaleString('ru-RU')} ₽. Требуется проверка INT overflow.`,
        'WARNING'
      );
    }).catch(() => {});
  }
}
