// SC08 Negative Fixture: Mutex release with Lua token ownership check
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function releaseLock(redis: any, key: string, token: string) {
  const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
  await redis.eval(lua, 1, key, token);
}
