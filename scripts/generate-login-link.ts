import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const db = new PrismaClient();

async function generateLink(email: string, tenantId = 'smmplan') {
  const cleanEmail = email.toLowerCase().trim();
  let user = await db.user.findFirst({
    where: { email: cleanEmail, tenantId }
  });

  if (!user) {
    user = await db.user.create({
      data: {
        email: cleanEmail,
        role: 'USER',
        tenantId,
      }
    });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.authToken.create({
    data: {
      userId: user.id,
      token: hashedToken,
      tenantId,
      expiresAt,
      ipIssued: '127.0.0.1',
      userAgentIssued: 'Manual CLI Generator',
    }
  });

  const tenantParam = tenantId !== 'smmplan' ? `&tenant=${tenantId}` : '';
  const magicLink = `https://test.smmplan.pro/api/auth/verify?token=${rawToken}${tenantParam}`;
  return { email: cleanEmail, role: user.role, tenantId, magicLink, expiresAt };
}

async function main() {
  const targetEmail = process.argv[2] || 'art@artmspektr.ru';
  const tenant = process.argv[3] || 'smmplan';
  const result = await generateLink(targetEmail, tenant);

  console.log('==================================================');
  console.log('       🔗 СВЕЖАЯ ПРЯМАЯ ССЫЛКА ДЛЯ ВХОДА');
  console.log('==================================================');
  console.log(`Пользователь: ${result.email} (${result.role}, tenant: ${result.tenantId})`);
  console.log(`Действительна до: ${result.expiresAt.toLocaleTimeString('ru-RU')}`);
  console.log('\nССЫЛКА ДЛЯ ВХОДА (нажмите или скопируйте в браузер):');
  console.log(result.magicLink);
  console.log('==================================================\n');
}

main().finally(() => db.$disconnect());
