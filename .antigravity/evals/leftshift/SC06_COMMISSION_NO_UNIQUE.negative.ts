// SC06 Negative Fixture: Idempotent Commission Upsert
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function award(db: any, orderId: string, referrerId: string, amount: bigint) {
  await db.commission.upsert({
    where: { orderId_referrerId: { orderId, referrerId } },
    update: { amount },
    create: { orderId, referrerId, amount }
  });
}
