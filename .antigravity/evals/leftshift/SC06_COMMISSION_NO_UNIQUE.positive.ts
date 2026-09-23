// SC06 Positive Fixture: Commission create without unique / upsert
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function award(db: any, orderId: string, referrerId: string, amount: bigint) {
  await db.commission.create({
    data: { orderId, referrerId, amount }
  });
}
