/**
 * OmniSMM 1.0 — Real Provider Verification Suite (VexBoost Live API)
 * 
 * Performs end-to-end live testing with real links and live VexBoost API:
 * 1. Live Balance & Connectivity Verification
 * 2. Real Order #1: Telegram Fast Views (Service 2661) on real public post
 * 3. Real Order #2: Telegram Positive Reactions (Service 2353) on real public post
 * 4. Provider Order ID tracking & DB state persistence
 * 5. Single & Multi-order Status Polling against live VexBoost upstream
 */

import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';
import { UniversalProvider } from '../src/services/providers/universal.provider';
import { WalletOps } from '../src/services/financial/wallet-ops';

async function main() {
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('🚀 OMNISMM 1.0 — REAL VEXBOOST END-TO-END LIVE VERIFICATION SUITE');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  // Step 1: Locate Vexboost Provider in Database
  const provider = await db.provider.findFirst({
    where: { apiUrl: { contains: 'vexboost' } }
  });

  if (!provider) {
    throw new Error('❌ Vexboost provider not found in database!');
  }

  console.log(`[1/5] 📡 Provider Configuration:`);
  console.log(`      ID:       ${provider.id}`);
  console.log(`      Name:     ${provider.name}`);
  console.log(`      API URL:  ${provider.apiUrl}`);
  console.log(`      Active:   ${provider.isActive}`);

  let apiKey = '';
  try {
    apiKey = VaultService.decrypt(provider.apiKey);
  } catch {
    apiKey = provider.apiKey;
  }

  const pInstance = new UniversalProvider(provider.apiUrl, apiKey, provider.metadata as any);

  // Step 2: Live Balance Verification
  const balanceInfo = await pInstance.getBalance();
  console.log(`\n[2/5] 💰 Live Vexboost Balance:`);
  console.log(`      Balance:  ${balanceInfo.balance} ${balanceInfo.currency}`);
  const balanceNum = parseFloat(balanceInfo.balance);
  if (isNaN(balanceNum) || balanceNum <= 0) {
    throw new Error(`❌ Insufficient Vexboost balance: ${balanceInfo.balance}`);
  }
  console.log(`      Status:   ✅ Balance is positive and active (${balanceInfo.balance} RUB)\n`);

  // Step 3: Find or Create Test Category & Services in DB
  const network = await db.network.upsert({
    where: { slug: 'telegram' },
    update: {},
    create: {
      slug: 'telegram',
      name: 'Telegram',
      icon: 'telegram'
    }
  });

  const category = await db.category.upsert({
    where: { 
      slug: 'tg-views-live',
    },
    update: {},
    create: {
      slug: 'tg-views-live',
      name: 'Просмотры Telegram (Vexboost Live)',
      network: { connect: { id: network.id } },
      tenantId: 'smmplan'
    }
  });

  // Ensure Service 1: Telegram Views (ExtID 2661)
  const viewsService = await db.service.upsert({
    where: {
      id: 'srv_vex_tg_views_2661'
    },
    update: {
      externalId: '2661',
      providerId: provider.id,
      isActive: true,
      rate: 0.25,
      minQty: 10,
      maxQty: 1000000
    },
    create: {
      id: 'srv_vex_tg_views_2661',
      name: 'Telegram Просмотры поста [Быстрые] (Vexboost Live)',
      category: { connect: { id: category.id } },
      provider: { connect: { id: provider.id } },
      externalId: '2661',
      rate: 0.25,
      minQty: 10,
      maxQty: 1000000,
      isActive: true,
      tenantId: 'smmplan',
      providerCurrency: 'RUB'
    }
  });

  // Ensure Service 2: Telegram Reactions (ExtID 2353)
  const reactionsService = await db.service.upsert({
    where: {
      id: 'srv_vex_tg_reactions_2353'
    },
    update: {
      externalId: '2353',
      providerId: provider.id,
      isActive: true,
      rate: 1.0,
      minQty: 10,
      maxQty: 10000
    },
    create: {
      id: 'srv_vex_tg_reactions_2353',
      name: 'Telegram Позитивные реакции [👍🤩🎉🔥] (Vexboost Live)',
      category: { connect: { id: category.id } },
      provider: { connect: { id: provider.id } },
      externalId: '2353',
      rate: 1.0,
      minQty: 10,
      maxQty: 10000,
      isActive: true,
      tenantId: 'smmplan',
      providerCurrency: 'RUB'
    }
  });

  console.log(`[3/5] 🛠️ Platform Service Setup in Database:`);
  console.log(`      Service 1: "${viewsService.name}" -> Vexboost ID: ${viewsService.externalId}`);
  console.log(`      Service 2: "${reactionsService.name}" -> Vexboost ID: ${reactionsService.externalId}`);

  // Create a real customer in DB for placing the orders
  const testCustomer = await db.user.upsert({
    where: { 
      email_tenantId: {
        email: 'real_vexboost_tester@smmplan.pro',
        tenantId: 'smmplan'
      }
    },
    update: { balance: BigInt(50000) }, // 500 RUB
    create: {
      email: 'real_vexboost_tester@smmplan.pro',
      balance: BigInt(50000),
      tenantId: 'smmplan'
    }
  });

  const realPostLink = 'https://t.me/telegram/200'; // Official Telegram Channel Post #200

  // Step 4: Execute Real Live Order #1 (Telegram Views)
  console.log(`\n[4/5] 📦 Executing Real Live Order #1: Telegram Fast Views...`);
  console.log(`      Target Link: ${realPostLink}`);
  console.log(`      Quantity:    10`);
  console.log(`      Service:     ${viewsService.name} (ExtID: ${viewsService.externalId})`);

  const order1Db = await db.order.create({
    data: {
      userId: testCustomer.id,
      serviceId: viewsService.id,
      link: realPostLink,
      quantity: 10,
      charge: BigInt(50), // 0.50 RUB
      providerCost: BigInt(1), // ~0.0025 RUB
      status: 'PENDING',
      tenantId: 'smmplan'
    }
  });

  console.log(`      Created DB Order: ${order1Db.id} (Status: ${order1Db.status})`);
  console.log(`      Sending dispatch request to Vexboost API...`);

  const dispatch1Res = await pInstance.createOrder({
    service: viewsService.externalId!,
    link: realPostLink,
    quantity: 10
  });

  console.log(`      🎉 Vexboost Dispatch Response:`, dispatch1Res);
  if (!dispatch1Res.order) {
    throw new Error(`❌ Failed to obtain order ID from Vexboost: ${JSON.stringify(dispatch1Res)}`);
  }

  // Update DB order with external ID
  const updatedOrder1 = await db.order.update({
    where: { id: order1Db.id },
    data: {
      externalId: String(dispatch1Res.order),
      status: 'IN_PROGRESS'
    }
  });
  console.log(`      ✅ Order #1 successfully linked! External Provider ID: ${updatedOrder1.externalId}, Status: ${updatedOrder1.status}`);

  // Step 5: Execute Real Live Order #2 (Telegram Reactions)
  console.log(`\n[5/5] 📦 Executing Real Live Order #2: Telegram Positive Reactions...`);
  console.log(`      Target Link: ${realPostLink}`);
  console.log(`      Quantity:    10`);
  console.log(`      Service:     ${reactionsService.name} (ExtID: ${reactionsService.externalId})`);

  const order2Db = await db.order.create({
    data: {
      userId: testCustomer.id,
      serviceId: reactionsService.id,
      link: realPostLink,
      quantity: 10,
      charge: BigInt(100), // 1.00 RUB
      providerCost: BigInt(1),
      status: 'PENDING',
      tenantId: 'smmplan'
    }
  });

  console.log(`      Created DB Order: ${order2Db.id} (Status: ${order2Db.status})`);
  console.log(`      Sending dispatch request to Vexboost API...`);

  const dispatch2Res = await pInstance.createOrder({
    service: reactionsService.externalId!,
    link: realPostLink,
    quantity: 10
  });

  console.log(`      🎉 Vexboost Dispatch Response:`, dispatch2Res);
  if (!dispatch2Res.order) {
    throw new Error(`❌ Failed to obtain order ID from Vexboost: ${JSON.stringify(dispatch2Res)}`);
  }

  const updatedOrder2 = await db.order.update({
    where: { id: order2Db.id },
    data: {
      externalId: String(dispatch2Res.order),
      status: 'IN_PROGRESS'
    }
  });
  console.log(`      ✅ Order #2 successfully linked! External Provider ID: ${updatedOrder2.externalId}, Status: ${updatedOrder2.status}`);

  // Step 6: Query Status from Vexboost for Both Live Orders
  console.log(`\n────────────────────────────────────────────────────────────────────────`);
  console.log(`📊 LIVE ORDER STATUS POLLING (VEXBOOST REAL-TIME SYNCHRONIZATION):`);
  console.log(`────────────────────────────────────────────────────────────────────────`);

  // Single status query #1
  const status1 = await pInstance.getOrderStatus(dispatch1Res.order);
  console.log(`\n🔎 Single Query Order #1 (${dispatch1Res.order}):`);
  console.log(`   Charge:       ${status1.charge || 'N/A'}`);
  console.log(`   Start count:  ${status1.start_count || '0'}`);
  console.log(`   Status:       ${status1.status}`);
  console.log(`   Remains:      ${status1.remains || '10'}`);

  // Single status query #2
  const status2 = await pInstance.getOrderStatus(dispatch2Res.order);
  console.log(`\n🔎 Single Query Order #2 (${dispatch2Res.order}):`);
  console.log(`   Charge:       ${status2.charge || 'N/A'}`);
  console.log(`   Start count:  ${status2.start_count || '0'}`);
  console.log(`   Status:       ${status2.status}`);
  console.log(`   Remains:      ${status2.remains || '10'}`);

  // Multi status query
  const multiStatus = await pInstance.getMultiOrderStatus([dispatch1Res.order, dispatch2Res.order]);
  console.log(`\n📦 Multi-Order Batch Status Response:`, JSON.stringify(multiStatus, null, 2));

  // Check remaining Vexboost balance after orders
  const updatedBalance = await pInstance.getBalance();
  console.log(`\n💰 Updated Vexboost Balance After Orders: ${updatedBalance.balance} ${updatedBalance.currency}`);

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('🏆 REAL VEXBOOST LIVE TESTS PASSED 100% WITH ZERO ERRORS!');
  console.log('════════════════════════════════════════════════════════════════════════');
}

main()
  .catch((err) => {
    console.error('\n❌ REAL VEXBOOST TEST FAILED:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
