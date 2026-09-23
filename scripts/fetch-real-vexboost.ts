import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';

async function main() {
  const provider = await db.provider.findFirst({
    where: { name: 'Vexboost' }
  });

  if (!provider) {
    console.error('Vexboost provider not found in DB');
    return;
  }

  let apiKey = '';
  try {
    apiKey = VaultService.decrypt(provider.apiKey);
  } catch {
    apiKey = provider.apiKey;
  }

  console.log(`Querying Vexboost API: ${provider.apiUrl}...`);
  const res = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key: apiKey, action: 'services' })
  });

  if (!res.ok) {
    console.error(`HTTP error: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.error('Response:', text);
    return;
  }

  const rawServices = await res.json();
  if (!Array.isArray(rawServices)) {
    console.error('API Error or unexpected response:', rawServices);
    return;
  }

  console.log(`Fetched ${rawServices.length} REAL services from Vexboost!`);
  
  // Show sample 5 services
  console.log('\nSample 5 services:');
  console.log(JSON.stringify(rawServices.slice(0, 5), null, 2));

  // Also check balance
  const balanceRes = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key: apiKey, action: 'balance' })
  });
  const balanceData = await balanceRes.json();
  console.log('\nProvider Balance:', balanceData);
}

main().finally(() => db.$disconnect());
