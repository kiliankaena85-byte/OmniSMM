import { db } from '../src/lib/db';

async function checkAllSettings() {
  const all = await db.systemSettings.findMany();
  console.log('Найдено записей SystemSettings:', all.length);
  for (const s of all) {
    console.log(`ID: ${s.id}, Provider: ${s.emailProvider}, SMTP: ${s.smtpHost}:${s.smtpPort}, User: ${s.smtpUser}, Domain: ${s.supportEmailDomain}`);
  }
}

checkAllSettings().catch(console.error).finally(() => process.exit(0));
