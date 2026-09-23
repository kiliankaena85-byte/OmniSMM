/**
 * (c) 2026 OmniSMM 1.0 Platform (SMMplan / SMMflux)
 * Key Rotation Migration CLI Utility.
 * Re-encrypts all database records to the current primary encryption key.
 * Usage: npx tsx scripts/rotate-encryption-keys.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';
import { reEncrypt } from '../src/lib/crypto/encryption';

const db = new PrismaClient();

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`\n======================================================`);
  console.log(`🔐 OmniSMM 1.0 Encryption Key Migration & Rotation CLI`);
  console.log(`======================================================`);
  if (isDryRun) {
    console.log(`[INFO] Running in DRY-RUN mode. No database records will be modified.\n`);
  }

  let totalScanned = 0;
  let totalMigrated = 0;
  let totalErrors = 0;

  // 1. Providers (apiKey)
  console.log(`--> Scanning Providers (apiKey)...`);
  const providers = await db.provider.findMany({
    select: { id: true, name: true, apiKey: true },
  });
  for (const p of providers) {
    totalScanned++;
    if (p.apiKey) {
      try {
        const upgraded = reEncrypt(p.apiKey);
        if (upgraded !== p.apiKey) {
          totalMigrated++;
          if (!isDryRun) {
            await db.provider.update({
              where: { id: p.id },
              data: { apiKey: upgraded },
            });
          }
          console.log(`  [UPDATED] Provider "${p.name}" (${p.id}) re-encrypted.`);
        }
      } catch (err) {
        totalErrors++;
        console.error(`  [ERROR] Failed to re-encrypt Provider ${p.name} (${p.id}):`, err);
      }
    }
  }

  // 2. SystemSettings (Payment gateways, SMTP, AI API keys)
  console.log(`\n--> Scanning SystemSettings...`);
  const settingsList = await db.systemSettings.findMany();
  for (const s of settingsList) {
    totalScanned++;
    const updates: Record<string, string> = {};
    const fieldsToMigrate = [
      'yookassaSecretKey',
      'yookassaTestSecretKey',
      'yookassaWebhookSecret',
      'cryptoBotToken',
      'smtpPassword',
      'robokassaPassword',
      'robokassaWebhookPassword',
      'geminiApiKeys',
      'resendApiKey',
      'telegramWebhookSecret',
    ] as const;

    for (const field of fieldsToMigrate) {
      const val = (s as unknown as Record<string, unknown>)[field];
      if (typeof val === 'string' && val.trim()) {
        try {
          const upgraded = reEncrypt(val);
          if (upgraded !== val) {
            updates[field] = upgraded;
          }
        } catch (err) {
          totalErrors++;
          console.error(`  [ERROR] Failed to re-encrypt SystemSettings field "${field}" for tenant "${s.tenantId}":`, err);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      totalMigrated += Object.keys(updates).length;
      if (!isDryRun) {
        await db.systemSettings.update({
          where: { id: s.id },
          data: updates,
        });
      }
      console.log(`  [UPDATED] SystemSettings for tenant "${s.tenantId}" re-encrypted ${Object.keys(updates).length} fields:`, Object.keys(updates));
    }
  }

  // 3. Users (PII legalAddress, geminiApiKey, twoFactorSecret)
  console.log(`\n--> Scanning Users (legalAddress, geminiApiKey, twoFactorSecret)...`);
  const users = await db.user.findMany({
    where: {
      OR: [
        { legalAddress: { not: null } },
        { geminiApiKey: { not: null } },
        { twoFactorSecret: { not: null } },
      ],
    },
    select: { id: true, email: true, legalAddress: true, geminiApiKey: true, twoFactorSecret: true },
  });

  for (const u of users) {
    totalScanned++;
    const userUpdates: Record<string, string> = {};
    if (u.legalAddress) {
      try {
        const upgraded = reEncrypt(u.legalAddress);
        if (upgraded !== u.legalAddress) userUpdates.legalAddress = upgraded;
      } catch (err) {
        totalErrors++;
        console.error(`  [ERROR] Failed to re-encrypt legalAddress for User ${u.id}:`, err);
      }
    }
    if (u.geminiApiKey) {
      try {
        const upgraded = reEncrypt(u.geminiApiKey);
        if (upgraded !== u.geminiApiKey) userUpdates.geminiApiKey = upgraded;
      } catch (err) {
        totalErrors++;
        console.error(`  [ERROR] Failed to re-encrypt geminiApiKey for User ${u.id}:`, err);
      }
    }
    if (u.twoFactorSecret) {
      try {
        const upgraded = reEncrypt(u.twoFactorSecret);
        if (upgraded !== u.twoFactorSecret) userUpdates.twoFactorSecret = upgraded;
      } catch (err) {
        totalErrors++;
        console.error(`  [ERROR] Failed to re-encrypt twoFactorSecret for User ${u.id}:`, err);
      }
    }

    if (Object.keys(userUpdates).length > 0) {
      totalMigrated += Object.keys(userUpdates).length;
      if (!isDryRun) {
        await db.user.update({
          where: { id: u.id },
          data: userUpdates,
        });
      }
      console.log(`  [UPDATED] User ${u.id} re-encrypted ${Object.keys(userUpdates).length} fields.`);
    }
  }

  // 4. ProviderProxy (passwordEncrypted)
  console.log(`\n--> Scanning ProviderProxy (passwordEncrypted)...`);
  const proxies = await db.providerProxy.findMany({
    where: { passwordEncrypted: { not: null } },
    select: { id: true, label: true, passwordEncrypted: true },
  });
  for (const pr of proxies) {
    totalScanned++;
    if (pr.passwordEncrypted) {
      try {
        const upgraded = reEncrypt(pr.passwordEncrypted);
        if (upgraded !== pr.passwordEncrypted) {
          totalMigrated++;
          if (!isDryRun) {
            await db.providerProxy.update({
              where: { id: pr.id },
              data: { passwordEncrypted: upgraded },
            });
          }
          console.log(`  [UPDATED] ProviderProxy "${pr.label}" (${pr.id}) re-encrypted.`);
        }
      } catch (err) {
        totalErrors++;
        console.error(`  [ERROR] Failed to re-encrypt ProviderProxy ${pr.label} (${pr.id}):`, err);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 Migration Summary:`);
  console.log(`   - Total Records Scanned:  ${totalScanned}`);
  console.log(`   - Fields Migrated to Key: ${totalMigrated}`);
  console.log(`   - Errors Encountered:     ${totalErrors}`);
  console.log(`======================================================\n`);

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('[FATAL] Migration script crashed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
