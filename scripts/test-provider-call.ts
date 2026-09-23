import { db } from '@/lib/db';
import { ProviderBalanceService } from '@/services/admin/provider-balance.service';

async function main() {
  const provider = await db.provider.findUnique({
    where: { id: 'cmswm47y60000hqrkoljy8wde' }
  });

  if (!provider) {
    console.log('Provider not found');
    return;
  }

  console.log('Testing ProviderBalanceService.getBalance for:', provider.name, provider.apiUrl);
  try {
    const res = await ProviderBalanceService.getBalance(provider, true);
    console.log('Balance result:', res);
  } catch (err: any) {
    console.error('Balance error:', err.message, err.stack);
  }
}

main().finally(() => process.exit(0));
