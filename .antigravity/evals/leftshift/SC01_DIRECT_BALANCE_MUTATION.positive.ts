// SC01 Positive Fixture: Direct Balance Mutation Anti-Pattern
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function directBalanceIncrement(db: any, userId: string, amount: number) {
  await db.user.update({
    where: { id: userId },
    data: { balance: { increment: amount } }
  });
}
