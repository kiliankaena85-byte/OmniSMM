import { db } from '../src/lib/db';
import crypto from 'crypto';

export async function revokeQASessions() {
  console.log('🔒 Running revoke-qa-sessions script...');

  // 1. Explicitly revoke specific pentest session IDs
  const targetSessionIds = [
    'cmtdtxrx5000512xd8fq92q3f',
    'cmtdwnc1n000912xdhqh2b2k0'
  ];

  const deletedExplicit = await db.session.deleteMany({
    where: {
      id: { in: targetSessionIds }
    }
  });
  console.log(`✅ Deleted explicit target sessions: ${deletedExplicit.count}`);

  // 2. Revoke all sessions for QA / pentest emails
  const targetEmails = [
    'admin@smmplan.pro',
    'client@smmplan.pro',
    'pentest@smmplan.pro',
    'attacker@test.com',
    'test@test.com',
    'testuser@smmplan.local',
    'infosokoloff@yandex.ru'
  ];

  const deletedByEmail = await db.session.deleteMany({
    where: {
      user: {
        email: { in: targetEmails }
      }
    }
  });
  console.log(`✅ Deleted sessions for QA/test accounts: ${deletedByEmail.count}`);

  // 3. Reset/Scramble passwords of QA accounts to prevent password replay attacks
  for (const email of ['admin@smmplan.pro', 'client@smmplan.pro']) {
    const user = await db.user.findFirst({ where: { email } });
    if (user) {
      const randomPasswordHash = crypto.randomBytes(32).toString('hex');
      await db.user.update({
        where: { id: user.id },
        data: {
          passwordHash: randomPasswordHash
        }
      });
      console.log(`✅ Scrambled and locked password for account: ${email}`);
    }
  }

  console.log('🎉 QA session revocation complete and all sessions invalidated.');
}

if (require.main === module || process.argv[1]?.includes('revoke-qa-sessions')) {
  revokeQASessions()
    .catch((err) => {
      console.error('❌ Failed to revoke QA sessions:', err);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
