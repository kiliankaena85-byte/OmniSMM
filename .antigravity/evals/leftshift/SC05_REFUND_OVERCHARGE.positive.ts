// SC05 Positive Fixture: WalletOps.refund without idempotencyKey
import { WalletOps } from '@/services/financial/wallet-ops';

export async function processRefund(userId: string, amount: bigint, orderId: string) {
  await WalletOps.refund({
    userId,
    amount,
    orderId,
    reason: 'Partial cancel'
  });
}
