// SC05 Negative Fixture: WalletOps.refund with required idempotencyKey
import { WalletOps } from '@/services/financial/wallet-ops';

export async function processRefund(userId: string, amount: bigint, orderId: string, idempotencyKey: string) {
  await WalletOps.refund({
    userId,
    amount,
    orderId,
    reason: 'Partial cancel',
    idempotencyKey
  });
}
