import { PrismaClient } from '@prisma/client';
import { VaultService } from '../src/lib/vault';

const db = new PrismaClient();

function isAlreadyEncrypted(val: string): boolean {
  if (!val || typeof val !== 'string' || !val.trim()) return true;
  try {
    VaultService.decrypt(val.trim());
    return true; // Successfully decrypted with current key
  } catch {
    return false; // Plaintext or encrypted with old key
  }
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const isDryRun = !isApply;

  console.log(`🔒 Starting re-encryption tool (Mode: ${isDryRun ? 'DRY-RUN (default, no DB changes)' : 'APPLY (writing to DB)'})...`);

  await db.$transaction(async (tx) => {
    // 1. Re-encrypt Provider credentials (apiKey)
    const providers = await tx.provider.findMany();
    for (const p of providers) {
      const updates: { apiKey?: string } = {};
      if (p.apiKey && !isAlreadyEncrypted(p.apiKey)) {
        console.log(`[DRY-RUN: ${isDryRun}] Re-encrypting unencrypted provider apiKey for: ${p.name}`);
        updates.apiKey = VaultService.encrypt(p.apiKey.trim());
      }
      if (isApply && Object.keys(updates).length > 0) {
        await tx.provider.update({
          where: { id: p.id },
          data: updates,
        });
      }
    }

    // 2. Re-encrypt SystemSettings payment and API secrets
    const settings = await tx.systemSettings.findMany();
    for (const s of settings) {
      const fields = [
        'yookassaSecretKey',
        'yookassaTestSecretKey',
        'cryptoBotToken',
        'robokassaPassword',
        'robokassaWebhookPassword',
        'smtpPassword',
        'resendApiKey',
        'inboundEmailWebhookSecret',
        'geminiApiKeys',
      ] as const;

      const updateData: Record<string, string> = {};
      for (const field of fields) {
        const val = s[field as keyof typeof s];
        if (val && typeof val === 'string' && val.trim() !== '' && !isAlreadyEncrypted(val)) {
          console.log(`[DRY-RUN: ${isDryRun}] Re-encrypting SystemSettings field ${field} for tenant ${s.id}`);
          updateData[field] = VaultService.encrypt(val.trim());
        }
      }
      if (isApply && Object.keys(updateData).length > 0) {
        await tx.systemSettings.update({ where: { id: s.id }, data: updateData });
      }
    }
  });

  console.log(`✅ Re-encryption scan complete (${isDryRun ? 'DRY-RUN: run with --apply to commit' : 'Applied'})`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
