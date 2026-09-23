import * as dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/lib/db';

async function checkErrors() {
  const logs = await (db as any).telegramErrorLog?.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' }
  }).catch((e: any) => {
    console.error('Error fetching logs:', e.message);
    return [];
  });
  console.log('=== RECENT TELEGRAM ERROR LOGS ===');
  console.log('Count:', logs?.length || 0);
  if (logs && logs.length > 0) {
    for (const log of logs) {
      console.log(`[${log.createdAt?.toISOString()}] [${log.level}] ${log.errorMessage}`);
      if (log.stackTrace) console.log('   Stack:', log.stackTrace.substring(0, 200));
    }
  }
}

checkErrors().finally(() => db.$disconnect());
