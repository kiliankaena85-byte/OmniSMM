import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  console.log('=== SEARCHING FOR VEXBOOST AND PRIMELIKE IN DB ===\n');

  // 1. Check Providers
  const providers = await db.provider.findMany({
    where: {
      OR: [
        { name: { contains: 'vexboost', mode: 'insensitive' } },
        { name: { contains: 'primelike', mode: 'insensitive' } },
      ]
    }
  });

  console.log(`Found ${providers.length} matching providers:`);
  for (const p of providers) {
    console.log(`- [${p.id}] "${p.name}" (apiUrl: ${p.apiUrl})`);
    // Rename provider name to neutral
    await db.provider.update({
      where: { id: p.id },
      data: { name: 'Основной Поставщик (API 1)' }
    });
    console.log(`  ➔ Renamed to "Основной Поставщик (API 1)"`);
  }

  // 2. Check Services
  const services = await db.service.findMany({
    where: {
      OR: [
        { name: { contains: 'vexboost', mode: 'insensitive' } },
        { name: { contains: 'primelike', mode: 'insensitive' } },
        { description: { contains: 'vexboost', mode: 'insensitive' } },
        { description: { contains: 'primelike', mode: 'insensitive' } },
      ]
    }
  });

  console.log(`\nFound ${services.length} matching services:`);
  for (const s of services) {
    console.log(`- [${s.id}] "${s.name}"`);
    const cleanName = s.name.replace(/vexboost/gi, '').replace(/primelike/gi, '').replace(/\(Live\s*\)/gi, '').trim();
    const cleanDesc = s.description ? s.description.replace(/vexboost/gi, '').replace(/primelike/gi, '').trim() : s.description;
    await db.service.update({
      where: { id: s.id },
      data: { name: cleanName, description: cleanDesc }
    });
    console.log(`  ➔ Cleaned name: "${cleanName}"`);
  }

  // 3. Check Categories
  const categories = await db.category.findMany({
    where: {
      OR: [
        { name: { contains: 'vexboost', mode: 'insensitive' } },
        { name: { contains: 'primelike', mode: 'insensitive' } },
      ]
    }
  });

  console.log(`\nFound ${categories.length} matching categories:`);
  for (const c of categories) {
    console.log(`- [${c.id}] "${c.name}"`);
    const cleanName = c.name.replace(/vexboost/gi, '').replace(/primelike/gi, '').trim();
    await db.category.update({
      where: { id: c.id },
      data: { name: cleanName }
    });
    console.log(`  ➔ Cleaned name: "${cleanName}"`);
  }

  // 4. Check SystemSettings
  const settings = await db.systemSetting.findMany({
    where: {
      OR: [
        { key: { contains: 'vexboost', mode: 'insensitive' } },
        { key: { contains: 'primelike', mode: 'insensitive' } },
        { value: { contains: 'vexboost', mode: 'insensitive' } },
        { value: { contains: 'primelike', mode: 'insensitive' } },
      ]
    }
  });

  console.log(`\nFound ${settings.length} matching system settings:`);
  for (const st of settings) {
    console.log(`- [${st.id}] Key: "${st.key}", Value: "${st.value}"`);
    const cleanVal = st.value.replace(/vexboost/gi, '').replace(/primelike/gi, '').trim();
    await db.systemSetting.update({
      where: { id: st.id },
      data: { value: cleanVal }
    });
  }

  console.log('\n✅ DATABASE CLEANUP COMPLETED!');
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
