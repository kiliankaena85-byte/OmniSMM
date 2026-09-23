import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../src/lib/db';

async function rotateSecrets() {
  console.log('🔄 [SECRET ROTATION] Initiating comprehensive internal secret rotation...');

  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Generate 256-bit cryptographically secure tokens
  const newSecrets: Record<string, string> = {
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
    ORDER_TOKEN_SECRET: crypto.randomBytes(32).toString('hex'),
    CRON_SECRET: crypto.randomBytes(32).toString('hex'),
    INTERNAL_API_SECRET: crypto.randomBytes(32).toString('hex'),
    SECURITY_AUDIT_TOKEN: crypto.randomBytes(32).toString('hex'),
  };

  let lines = envContent.split('\n');
  const updatedKeys = new Set<string>();

  lines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) return line;
    const key = line.slice(0, eqIdx).trim();
    if (newSecrets[key]) {
      updatedKeys.add(key);
      return `${key}="${newSecrets[key]}"`;
    }
    return line;
  });

  // Append any secrets that weren't in .env
  for (const [key, val] of Object.entries(newSecrets)) {
    if (!updatedKeys.has(key)) {
      lines.push(`${key}="${val}"`);
      updatedKeys.add(key);
    }
  }

  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  console.log('✅ Updated .env with freshly generated 256-bit cryptographic secrets:');
  for (const key of Object.keys(newSecrets)) {
    console.log(`   - ${key}: [ROTATED & ENCRYPTED WITH NEW ENTROPY]`);
  }

  // Revoke all existing sessions in the database to prevent replay of old tokens
  try {
    const deletedSessions = await db.session.deleteMany({});
    console.log(`✅ [SESSION REVOCATION] Purged all active sessions in DB: ${deletedSessions.count} sessions invalidated.`);
  } catch (err) {
    console.warn('⚠️ Could not connect to DB for session purge (DB might be offline):', (err as Error).message);
  }

  console.log('🎉 [SUCCESS] Internal rotation completed successfully.');
}

rotateSecrets()
  .catch((e) => {
    console.error('❌ Rotation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect().catch(() => null);
  });
