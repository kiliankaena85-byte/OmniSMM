// SC01 Negative Fixture: Safe WalletOps Usage
import { WalletOps } from '@/services/financial/wallet-ops';

export async function safeBalanceIncrement(userId: string, amount: bigint, key: string) {
  await WalletOps.credit({
    userId,
    amount,
    idempotencyKey: key,
    reason: 'Topup'
  });
}
