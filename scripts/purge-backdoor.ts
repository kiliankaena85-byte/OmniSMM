import { db } from '../src/lib/db';
import fs from 'fs';

async function purge() {
  console.log('🔥 Purging backdoor routes and sessions...');

  // 1. Delete dev login route completely
  const devLoginPath = 'd:/SMM_plan_2/src/app/api/dev/login-direct/route.ts';
  if (fs.existsSync(devLoginPath)) {
    fs.unlinkSync(devLoginPath);
    console.log('✅ Completely removed src/app/api/dev/login-direct/route.ts');
  }

  const devDir = 'd:/SMM_plan_2/src/app/api/dev';
  if (fs.existsSync(devDir)) {
    fs.rmSync(devDir, { recursive: true, force: true });
    console.log('✅ Removed src/app/api/dev directory');
  }

  // 2. Revoke all pentest sessions from DB
  const deleted = await db.session.deleteMany({
    where: {
      id: {
        in: ['cmtdtxrx5000512xd8fq92q3f', 'cmtdwnc1n000912xdhqh2b2k0']
      }
    }
  });
  console.log('✅ Deleted pentest sessions from DB:', deleted.count);

  await db.$disconnect();
  console.log('🎉 Backdoor purged successfully!');
}

purge().catch(console.error);
