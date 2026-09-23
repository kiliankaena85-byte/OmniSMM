const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

async function check() {
  console.log('--- DB settings:');
  const prisma = new PrismaClient();
  try {
    const settings = await prisma.systemSettings.findFirst();
    console.log(JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Error reading DB settings:', err);
  } finally {
    await prisma.$disconnect();
  }

  console.log('--- Redis settings:');
  const redis = new Redis(process.env.REDIS_URL || 'redis://smmplan_lite_prod_redis:6379');
  try {
    const maintenance = await redis.get('settings:maintenanceMode');
    console.log('Redis settings:maintenanceMode =', maintenance);
  } catch (err) {
    console.error('Error reading Redis:', err);
  } finally {
    redis.disconnect();
  }
}

check();
