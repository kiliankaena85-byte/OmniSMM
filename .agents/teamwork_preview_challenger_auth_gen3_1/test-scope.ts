import { db } from '../../src/lib/db';
import crypto from 'crypto';

async function main() {
  console.log("Starting transaction scope test...");
  
  const email = `scope-${Date.now()}@test.com`;
  
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(db.$transaction(async (tx) => {
      let isNewUser = false;
      let user = await tx.user.findUnique({ where: { email } });

      if (!user) {
        isNewUser = true;
        user = await tx.user.create({ data: { email, role: "USER" } });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await tx.authToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt,
        },
      });

      return { type: 'success' as const, user, isNewUser, rawToken };
    }, { isolationLevel: 'Serializable' }));
  }
  
  try {
    const results = await Promise.allSettled(promises);
    let p2002Count = 0;
    results.forEach(res => {
      if (res.status === 'rejected' && res.reason.message.includes('P2002')) {
        p2002Count++;
      }
    });
    console.log(`P2002 errors: ${p2002Count}`);
    console.log(results);
  } catch (e) {
    console.error(e);
  }
}

main();
