import { providerService } from '../src/services/providers/provider.service';
import { db } from '../src/lib/db';

async function main() {
  const provider = await db.provider.findFirst({
    where: { name: 'Основной Поставщик (API 1)' }
  });
  console.log('Testing provider:', provider?.name, 'URL:', provider?.apiUrl);
  if (!provider) return;

  try {
    const inst = await providerService.getWorkerProviderInstance(provider);
    const balance = await inst.getBalance();
    console.log('Balance check SUCCESS:', balance);
  } catch (e: any) {
    console.error('Provider connection ERROR:', e.message);
  }
  await db.$disconnect();
}

main().catch(console.error);
