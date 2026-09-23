import { PrismaClient } from '@prisma/client';

async function check() {
  const p = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:postgres@127.0.0.1:5433/smmplan_lite?schema=public'
      }
    }
  });
  
  try {
    const nw = await p.network.count();
    const cat = await p.category.count();
    const srv = await p.service.count();
    const active = await p.service.count({ where: { isActive: true } });
    console.log('smmplan_lite (public schema):', { nw, cat, srv, active });
  } catch (err) {
    console.error('Error connecting to smmplan_lite:', err);
  } finally {
    await p.$disconnect();
  }
}

check();
