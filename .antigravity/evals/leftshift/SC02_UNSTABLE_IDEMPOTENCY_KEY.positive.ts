// SC02 Positive Fixture: Unstable Idempotency Key Anti-Pattern
export function makeKey(orderId: string) {
  const idempotencyKey = `charge-${orderId}-${Date.now()}`;
  return idempotencyKey;
}
