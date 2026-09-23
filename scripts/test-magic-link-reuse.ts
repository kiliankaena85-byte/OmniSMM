import { db } from '../src/lib/db';
import crypto from 'crypto';

async function testVulnerability() {
  const email = 'victim2@example.com';
  
  let user = await db.user.findUnique({ where: { email_tenantId: { email, tenantId: 'smmplan' } } });
  if (!user) {
    user = await db.user.create({ data: { email, tenantId: 'smmplan', role: 'USER' } });
  }

  // Request token 1
  const rawToken1 = crypto.randomBytes(32).toString("hex");
  const hashedToken1 = crypto.createHash('sha256').update(rawToken1).digest('hex');
  await db.authToken.create({
    data: { userId: user.id, token: hashedToken1, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });

  // Request token 2
  const rawToken2 = crypto.randomBytes(32).toString("hex");
  const hashedToken2 = crypto.createHash('sha256').update(rawToken2).digest('hex');
  await db.authToken.create({
    data: { userId: user.id, token: hashedToken2, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });

  // Simulate verify route for token 1
  const authToken1 = await db.authToken.findUnique({ where: { token: hashedToken1 } });
  const result1 = await db.authToken.updateMany({
    where: { id: authToken1!.id, used: false },
    data: { used: true },
  });

  // Now, is token 2 still valid?
  const authToken2 = await db.authToken.findUnique({ where: { token: hashedToken2 } });
  
  console.log(`Token 1 used: ${result1.count > 0}`);
  console.log(`Token 2 is used? ${authToken2!.used}`);

  if (result1.count > 0 && !authToken2!.used) {
    console.log('VULNERABILITY CONFIRMED: Using one token does not invalidate other active tokens for the same user.');
  }
}

testVulnerability().catch(console.error).finally(() => process.exit(0));
