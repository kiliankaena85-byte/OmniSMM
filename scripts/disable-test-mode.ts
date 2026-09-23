import { SettingsProvider } from '../src/lib/settings';
import { db } from '../src/lib/db';

async function main() {
  await SettingsProvider.setTestMode(false);
  console.log("Test mode disabled via SettingsProvider (Cache invalidated).");
}

main().catch(console.error).finally(async () => {
  await db.$disconnect();
  process.exit(0);
});
