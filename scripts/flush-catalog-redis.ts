import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://:SmmP1anR3dis2026Secure!@localhost:6379');

async function main() {
  const keys = await redis.keys('*');
  console.log(`Total Redis keys: ${keys.length}`);
  const catalogKeys = keys.filter(k => k.startsWith('catalog:'));
  console.log(`Found ${catalogKeys.length} catalog keys in Redis:`);
  console.log(catalogKeys);

  if (catalogKeys.length > 0) {
    await redis.del(...catalogKeys);
    console.log('✅ Deleted all catalog keys from Redis.');
  }

  // Also check if guest-bundle is cached
  const guestKeys = keys.filter(k => k.includes('guest') || k.includes('bundle'));
  console.log('Guest bundle keys:', guestKeys);
  if (guestKeys.length > 0) {
    await redis.del(...guestKeys);
  }
}

main().catch(console.error).finally(() => redis.disconnect());
