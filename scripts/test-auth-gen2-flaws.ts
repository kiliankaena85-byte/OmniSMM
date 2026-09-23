import { requestMagicLink } from '../src/actions/auth/request-magic-link';
import { db } from '../src/lib/db';
import { RateLimitService } from '../src/services/core/rate-limit.service';
import crypto from 'crypto';

async function testInfoDisclosure() {
  console.log("--- Testing Information Disclosure ---");
// 1. Omitted RateLimitService.reset() as it doesn't exist

  // 2. Exhaust register IP limit (3 reqs)
  for (let i = 0; i < 3; i++) {
    const formData = new FormData();
    formData.append('email', `fake${i}@smmplan.local`);
    await requestMagicLink(null, formData);
  }

  // 3. Test a non-existent email (should be blocked by register limit)
  const fdNonExist = new FormData();
  fdNonExist.append('email', 'nonexistent@smmplan.local');
  const resNonExist = await requestMagicLink(null, fdNonExist);
  console.log("Non-existent email response:", resNonExist.error); // Expected: "Превышен лимит регистраций..."

  // 4. Create an existing user
  const existingEmail = 'existing@smmplan.local';
  await db.user.upsert({
    where: { email_tenantId: { email: existingEmail, tenantId: 'smmplan' } },
    update: {},
    create: { email: existingEmail, role: 'USER', tenantId: 'smmplan' }
  });

  // 5. Test the existing email (should succeed, proving enumeration)
  const fdExist = new FormData();
  fdExist.append('email', existingEmail);
  const resExist = await requestMagicLink(null, fdExist);
  console.log("Existing email response success:", resExist.success); // Expected: true

  if (resNonExist.error && resExist.success) {
    console.log("-> VULNERABILITY CONFIRMED: Information Disclosure / Enumeration possible.");
  }
}

async function testOrphanedEmailBypass() {
  console.log("\n--- Testing Orphaned Email Bypass (AuthToken Error) ---");
  const testEmail = `orphan_${crypto.randomBytes(4).toString('hex')}@smmplan.local`;
  
  // Mock db.authToken.create to throw an error
  const originalAuthTokenCreate = db.authToken.create;
  // @ts-ignore
  db.authToken.create = async () => { throw new Error("Mock DB Error during token creation"); };

  const formData = new FormData();
  formData.append('email', testEmail);

  const res = await requestMagicLink(null, formData);
  console.log("Action response:", res.error); // Expected: "Произошла ошибка при обработке запроса"

  // Check if user was left in DB
  const user = await db.user.findUnique({ where: { email_tenantId: { email: testEmail, tenantId: 'smmplan' } } });
  if (user) {
    console.log(`-> VULNERABILITY CONFIRMED: User ${testEmail} created but not deleted (Zombie/Orphaned).`);
  } else {
    console.log("-> User properly cleaned up.");
  }

  // Restore mock
  db.authToken.create = originalAuthTokenCreate;
}

async function main() {
  await testInfoDisclosure();
  await testOrphanedEmailBypass();
  process.exit(0);
}

main().catch(console.error);
