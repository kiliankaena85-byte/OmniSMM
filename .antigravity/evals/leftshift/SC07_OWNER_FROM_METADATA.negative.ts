// SC07 Negative Fixture: Verified payment.userId in WalletOps
import { WalletOps } from '@/services/financial/wallet-ops';

export async function processTopup(payment: { userId: string }, amount: bigint) {
  await WalletOps.credit({
    userId: payment.userId,
    amount,
    idempotencyKey: 'key'
  });
}
