// SC02 Negative Fixture: Stable Idempotency Key Usage
import { IdempotencyKeys } from '@/services/financial/idempotency-keys';

export function makeKey(orderId: string) {
  const idempotencyKey = IdempotencyKeys.forOrderCharge(orderId);
  return idempotencyKey;
}
