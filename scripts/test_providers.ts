import { PrismaClient } from '@prisma/client';
import { checkProviderConnection } from '../src/actions/admin/providers/crud';

const prisma = new PrismaClient();

async function runTests() {
  console.log('--- STARTING PROVIDER TESTS ---');

  // 1. Connection Test (Invalid URL)
  console.log('[Test 1] Connection with Invalid URL');
  try {
    const res1 = await checkProviderConnection('invalid_id_not_exist');
    console.log('  Result:', res1.success ? 'FAIL (should have thrown)' : 'PASS');
  } catch (e) {
    console.log('  Result: PASS');
  }

  // 2. Fetch Providers directly from DB
  console.log('[Test 2] Querying Providers from DB');
  const providers = await prisma.provider.findMany();
  console.log(`  Found ${providers.length} providers.`);
  if (providers.length > 0) {
    console.log(`  First provider: ${providers[0].name} (Currency: ${providers[0].balanceCurrency})`);
  }

  console.log('--- ALL TESTS COMPLETED ---');
}

runTests()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
