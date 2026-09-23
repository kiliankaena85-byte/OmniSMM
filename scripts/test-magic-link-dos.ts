import { db } from '../src/lib/db';
import crypto from 'crypto';

async function testAttack() {
  const email = 'victim@example.com';
  
  // Create victim
  let user = await db.user.findUnique({ where: { email_tenantId: { email, tenantId: 'smmplan' } } });
  if (!user) {
    user = await db.user.create({ data: { email, role: 'USER', tenantId: 'smmplan' } });
  }

  // Simulate attacker requesting 50 tokens (bypassing IP limit)
  for (let i = 0; i < 50; i++) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // This is the code from request-magic-link.ts
    await db.authToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
    await db.authToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt,
      },
    });
  }

  const tokenCount = await db.authToken.count({ where: { userId: user.id } });
  console.log(`Active tokens for ${email}: ${tokenCount}`);
  
  if (tokenCount === 50) {
    console.log('VULNERABILITY CONFIRMED: Unbounded active tokens per user.');
  }
}

testAttack().catch(console.error).finally(() => process.exit(0));
