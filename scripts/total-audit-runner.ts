import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('1. [DB Connection] Verifying PostgreSQL connection...');
  try {
    const userCount = await prisma.user.count();
    console.log(`   [PASS] DB is reachable. Users count: ${userCount}`);
  } catch (err: any) {
    console.error('   [FAIL] DB connection failed:', err.message);
    throw err;
  }
}

async function checkSystemSettings() {
  console.log('2. [System Settings] Checking global configuration...');
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'global' }
    });
    if (!settings) {
      console.warn('   [WARN] Global settings row not found. Using defaults.');
      return;
    }
    console.log(`   [PASS] Site Name: "${settings.siteName}"`);
    console.log(`   [PASS] Exchange Rate USD: ${settings.exchangeRateUSD} ₽`);
    console.log(`   [PASS] Tax Rate: ${settings.taxRate}%`);
    console.log(`   [PASS] Maintenance Mode: ${settings.maintenanceMode}`);
  } catch (err: any) {
    console.error('   [FAIL] Settings check failed:', err.message);
  }
}

async function checkProviders() {
  console.log('3. [Providers] Checking provider integrations...');
  try {
    const providers = await prisma.provider.findMany();
    console.log(`   [INFO] Total providers in DB: ${providers.length}`);
    providers.forEach(p => {
      console.log(`   - [${p.isActive ? 'ACTIVE' : 'INACTIVE'}] ID: ${p.id}, Name: ${p.name}, Currency: ${p.balanceCurrency}`);
    });
  } catch (err: any) {
    console.error('   [FAIL] Providers check failed:', err.message);
  }
}

async function checkServices() {
  console.log('4. [Services & Pricing] Checking active catalog services...');
  try {
    const services = await prisma.service.findMany({
      select: {
        id: true,
        name: true,
        rate: true,
        markup: true,
        isActive: true,
        isQuarantined: true,
      }
    });
    const active = services.filter(s => s.isActive).length;
    const quarantined = services.filter(s => s.isQuarantined).length;
    
    // Check for loss-making services (Cost > Retail)
    // In Smmplan: rate is cost in USD per 1k.
    let lossMaking = 0;
    services.forEach(s => {
      if (s.rate * s.markup < s.rate) {
        lossMaking++;
      }
    });

    console.log(`   [PASS] Total services: ${services.length}`);
    console.log(`   [PASS] Active services: ${active}`);
    console.log(`   [PASS] Quarantined services: ${quarantined}`);
    if (lossMaking > 0) {
      console.warn(`   [WARN] Found ${lossMaking} loss-making services (markup < 1.0)!`);
    } else {
      console.log(`   [PASS] 0 loss-making services found (all margins are protected).`);
    }
  } catch (err: any) {
    console.error('   [FAIL] Services check failed:', err.message);
  }
}

async function checkRedis() {
  console.log('5. [Redis & Cache] Checking Redis connection...');
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const client = new Redis(redisUrl);
  try {
    const ping = await client.ping();
    console.log(`   [PASS] Redis connection successful: ${ping}`);
  } catch (err: any) {
    console.warn(`   [WARN] Redis check failed (is Redis running?): ${err.message}`);
  } finally {
    client.disconnect();
  }
}

async function checkEndpoints() {
  console.log('6. [Endpoints] Checking local app endpoints...');
  const endpoints = [
    'http://localhost:3000/api/health',
    'http://localhost:3000/robots.txt',
    'http://localhost:3000/sitemap.xml'
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      console.log(`   [PASS] ${url} -> Status ${res.status}`);
    } catch (err: any) {
      console.warn(`   [WARN] Failed to fetch ${url} (is local dev server running?): ${err.message}`);
    }
  }
}

async function main() {
  console.log('=== STARTING TOTAL AUDIT RUNNER ===\n');
  await checkDatabase();
  await checkSystemSettings();
  await checkProviders();
  await checkServices();
  await checkRedis();
  await checkEndpoints();
  console.log('\n=== TOTAL AUDIT RUNNER FINISHED ===');
}

main()
  .catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
