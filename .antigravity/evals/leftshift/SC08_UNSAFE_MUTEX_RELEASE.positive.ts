// SC08 Positive Fixture: Unsafe redis del without ownership token
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function releaseLock(redis: any, key: string) {
  await redis.del(key);
}
