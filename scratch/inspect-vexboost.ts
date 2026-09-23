import { PrismaClient } from '@prisma/client';
import { VaultService } from './src/lib/vault';

const prisma = new PrismaClient();

async function inspectAndFixVexboost() {
  console.log('--- Inspecting & Fixing Vexboost Provider ---');
  
  // 1. Find the provider
  const providers = await prisma.provider.findMany();
  let vexboost = providers.find(p => p.name.toLowerCase().includes('vexboost'));
  
  if (!vexboost) {
    console.error('❌ Vexboost provider not found in database!');
    return;
  }
  
  console.log(`ℹ️ Current Vexboost configuration in DB:`);
  console.log(`   - Name: ${vexboost.name}`);
  console.log(`   - ID: ${vexboost.id}`);
  console.log(`   - API URL: ${vexboost.apiUrl}`);
  console.log(`   - Balance Currency: ${vexboost.balanceCurrency}`);
  
  // Decrypt API key
  let decryptedKey = '';
  try {
    decryptedKey = VaultService.decrypt(vexboost.apiKey);
    console.log(`✅ API Key successfully decrypted: ${decryptedKey.substring(0, 8)}...`);
  } catch (err: any) {
    console.error(`❌ API Key decryption failed! ${err.message}`);
    decryptedKey = vexboost.apiKey; // fallback
  }
  
  // 2. Query DB service stats for this provider
  const totalServices = await prisma.service.count({ where: { providerId: vexboost.id } });
  const activeServices = await prisma.service.count({ where: { providerId: vexboost.id, isActive: true } });
  const inactiveServices = await prisma.service.count({ where: { providerId: vexboost.id, isActive: false } });

  console.log(`\n📊 Database Catalog Statistics for Vexboost:`);
  console.log(`   - Total Services: ${totalServices}`);
  console.log(`   - Active (In Sale): ${activeServices}`);
  console.log(`   - Inactive: ${inactiveServices}`);

  // 3. Test API Connectivity to vexboost.ru with decrypted key
  console.log(`\n🔌 Testing API Connectivity to ${vexboost.apiUrl} (using Decrypted API Key)...`);
  const startTime = Date.now();
  try {
    const res = await fetch(vexboost.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: decryptedKey, action: 'balance' })
    });
    const duration = Date.now() - startTime;
    const responseText = await res.text();
    
    console.log(`ℹ️ HTTP Status Code: ${res.status} ${res.statusText}`);
    console.log(`ℹ️ Response duration: ${duration}ms`);
    console.log(`💬 API Response Body:`, responseText);
    
    if (res.ok) {
      const data = JSON.parse(responseText);
      if (data.balance !== undefined) {
        console.log(`💵 Real Vexboost Balance: ${data.balance} ${data.currency || 'USD'}`);
      } else if (data.error) {
        console.log(`❌ Vexboost API returned error: ${data.error}`);
      }
    }
  } catch (err: any) {
    console.error(`❌ API Connection Failed!`);
    console.error(`   Error message: ${err.message}`);
  }

  // 4. Test fetch services list
  console.log(`\n📦 Fetching Services List from Vexboost...`);
  try {
    const res = await fetch(vexboost.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: decryptedKey, action: 'services' })
    });
    const responseText = await res.text();
    
    if (res.ok) {
      const data = JSON.parse(responseText);
      if (Array.isArray(data)) {
        console.log(`✅ Successfully fetched ${data.length} services from Vexboost API!`);
        if (data.length > 0) {
          console.log(`   First service preview:`, JSON.stringify(data[0]));
        }
      } else {
        console.log(`❌ Unexpected response format for services:`, responseText.substring(0, 200));
      }
    } else {
      console.log(`❌ Failed to fetch services list: HTTP ${res.status}`);
    }
  } catch (err: any) {
    console.error(`❌ Failed to fetch services list: ${err.message}`);
  }
}

inspectAndFixVexboost()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
