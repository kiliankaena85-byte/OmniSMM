const Redis = require('ioredis');

async function clear() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://smmplan_lite_prod_redis:6379');
  try {
    console.log('Fetching keys for next-cache-tags:settings...');
    const keys = await redis.smembers('next-cache-tags:settings');
    console.log('Keys to delete:', keys);
    if (keys.length > 0) {
      const pipeline = redis.pipeline();
      for (const key of keys) {
        pipeline.del(`next-cache:${key}`);
      }
      pipeline.del('next-cache-tags:settings');
      await pipeline.exec();
      console.log('Successfully deleted settings cache keys.');
    } else {
      console.log('No keys found for settings tag.');
    }

    // Also let's inspect if there are any other next-cache keys
    const allKeys = await redis.keys('next-cache:*');
    console.log('All next-cache keys in Redis:', allKeys);
    if (allKeys.length > 0) {
      console.log(`Deleting all ${allKeys.length} next-cache keys...`);
      const pipeline = redis.pipeline();
      for (const k of allKeys) {
        pipeline.del(k);
      }
      await pipeline.exec();
      console.log('Done.');
    }
  } catch (err) {
    console.error('Error clearing cache:', err);
  } finally {
    redis.disconnect();
  }
}

clear();
