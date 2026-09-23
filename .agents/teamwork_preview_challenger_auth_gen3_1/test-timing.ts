import { requestMagicLink } from '../../src/actions/auth/request-magic-link';

async function measureTime(email: string): Promise<number> {
  const formData = new FormData();
  formData.append('email', email);
  
  const start = performance.now();
  await requestMagicLink(null, formData);
  const end = performance.now();
  
  return end - start;
}

async function main() {
  console.log("Starting timing attack test...");
  
  const existingEmail = "admin@smmplan.ru"; // Use a known existing email or create one
  const nonExistingEmail = `nonexist-${Date.now()}@test.com`;
  
  // Warmup
  await measureTime(existingEmail);
  await measureTime(nonExistingEmail);
  
  const existingTimes = [];
  const nonExistingTimes = [];
  
  for (let i = 0; i < 10; i++) {
    existingTimes.push(await measureTime(existingEmail));
    nonExistingTimes.push(await measureTime(`nonexist-${Date.now()}-${i}@test.com`));
  }
  
  const avgExisting = existingTimes.reduce((a, b) => a + b, 0) / existingTimes.length;
  const avgNonExisting = nonExistingTimes.reduce((a, b) => a + b, 0) / nonExistingTimes.length;
  
  console.log(`Average time for existing email: ${avgExisting}ms`);
  console.log(`Average time for non-existing email: ${avgNonExisting}ms`);
  console.log(`Difference: ${Math.abs(avgExisting - avgNonExisting)}ms`);
}

main();
