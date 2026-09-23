/**
 * Generate a magic-link token for the first OWNER user found in DB.
 * Usage: npx tsx scripts/gen-admin-token.ts
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const db = new PrismaClient();

async function main() {
  // Find first OWNER
  let owner = await db.user.findFirst({ where: { role: 'OWNER' } });
  
  if (!owner) {
    // Create owner if none exists
    owner = await db.user.create({
      data: { email: 'admin@smmplan.test', role: 'OWNER' }
    });
    console.log('Created OWNER user:', owner.email);
  } else {
    console.log('Found OWNER user:', owner.email);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.authToken.create({
    data: {
      userId: owner.id,
      token: hashedToken,
      expiresAt,
    },
  });

  const url = `http://localhost:3000/api/auth/verify?token=${rawToken}`;
  console.log('\n=== MAGIC LINK (valid 1 hour) ===');
  console.log(url);
  console.log('================================\n');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
