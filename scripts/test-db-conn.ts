import { PrismaClient } from '@prisma/client';

async function testConn() {
  const p = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:postgres@127.0.0.1:5433/postgres',
      },
    },
  });

  try {
    await p.$connect();
    console.log('✅ CONNECTED TO 127.0.0.1:5433/postgres SUCCESS!');
  } catch (err) {
    console.error('❌ CONNECTION ERROR:', err);
  } finally {
    await p.$disconnect();
  }
}

testConn();
