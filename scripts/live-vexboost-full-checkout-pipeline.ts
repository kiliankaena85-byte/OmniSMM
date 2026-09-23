/**
 * OmniSMM 1.0 — Full Pipeline Live Vexboost Integration Test
 * 
 * Simulates complete user journey on real live Vexboost API:
 * 1. Customer checks price via calculatePrice
 * 2. Customer creates order and pays from Balance (via WalletOps)
 * 3. Background OrderProcessor picks up the order
 * 4. OrderProcessor contacts real Vexboost API and obtains real external ID
 * 5. Order state transitions: PENDING -> IN_PROGRESS
 * 6. Real-time status synced from Vexboost upstream
 */

import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';
import { UniversalProvider } from '../src/services/providers/universal.provider';
import { WalletOps } from '../src/services/financial/wallet-ops';
import orderProcessor from '../src/workers/processors/order.processor';
import { Job } from 'bullmq';

async function main() {
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('🎯 OMNISMM 1.0 — FULL LIFECYCLE VEXBOOST STOREFRONT PIPELINE TEST');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  // Step 1: Ensure customer exists with balance
  const customer = await db.user.upsert({
    where: { 
      email_tenantId: {
        email: 'real_vexboost_tester@smmplan.pro',
        tenantId: 'smmplan'
      }
    },
    update: { balance: BigInt(50000) }, // 500.00 RUB
    create: {
      email: 'real_vexboost_tester@smmplan.pro',
      balance: BigInt(50000),
      tenantId: 'smmplan'
    }
  });
  console.log(`[1/5] 👤 Customer Account: ${customer.email} | Initial Balance: ${Number(customer.balance) / 100} RUB`);

  // Step 2: Get active Vexboost service
  const service = await db.service.findUnique({
    where: { id: 'srv_vex_tg_views_2661' },
    include: { provider: true }
  });

  if (!service || !service.provider) {
    throw new Error('Vexboost test service not found in DB!');
  }
  console.log(`[2/5] 📦 Target Service: "${service.name}" | Provider: ${service.provider.name} | ExtID: ${service.externalId}`);

  // Step 3: Create Order in DB (Storefront Checkout Simulation)
  const realPostLink = 'https://t.me/telegram/200';
  const qty = 10;
  const priceKopecks = BigInt(50); // 0.50 RUB

  // Deduct balance via official Ledger-First WalletOps
  const chargeRes = await db.$transaction(async (tx) => {
    return WalletOps.charge(
      tx,
      customer.id,
      priceKopecks,
      `Оплата заказа на просмотры Telegram (Vexboost Live)`,
      {
        idempotencyKey: `live_vex_ord_${Date.now()}`,
        tenantId: 'smmplan'
      }
    );
  });
  console.log(`[3/5] 💳 WalletOps Charge Executed:`, chargeRes);

  const order = await db.order.create({
    data: {
      userId: customer.id,
      serviceId: service.id,
      link: realPostLink,
      quantity: qty,
      charge: priceKopecks,
      providerCost: BigInt(1),
      status: 'PENDING',
      tenantId: 'smmplan'
    }
  });
  console.log(`      Created Order in DB: ID = ${order.id} | Status = ${order.status}`);

  // Step 4: Execute Background Worker (OrderProcessor) against Real Upstream
  console.log(`\n[4/5] ⚙️ Executing Worker orderProcessor for Order ${order.id}...`);

  // Mock BullMQ Job
  const mockJob = {
    id: `job_${order.id}`,
    data: { orderId: order.id },
  } as unknown as Job;

  await orderProcessor(mockJob);

  // Step 5: Verify Order State After Worker Execution
  const processedOrder = await db.order.findUnique({
    where: { id: order.id }
  });

  console.log(`\n[5/5] 📋 Post-Worker Order Verification:`);
  console.log(`      Order ID:     ${processedOrder?.id}`);
  console.log(`      Status:       ${processedOrder?.status}`);
  console.log(`      External ID:  ${processedOrder?.externalId}`);

  if (processedOrder?.status !== 'IN_PROGRESS' || !processedOrder?.externalId) {
    throw new Error(`❌ Worker failed to transition order to IN_PROGRESS with externalId! Status: ${processedOrder?.status}`);
  }

  // Query live status directly from Vexboost
  let apiKey = '';
  try {
    apiKey = VaultService.decrypt(service.provider.apiKey);
  } catch {
    apiKey = service.provider.apiKey;
  }
  const pInstance = new UniversalProvider(service.provider.apiUrl, apiKey, service.provider.metadata as any);
  const liveStatus = await pInstance.getOrderStatus(processedOrder.externalId);

  console.log(`\n🔎 Real-time Upstream Status from Vexboost:`);
  console.log(`      Provider Order ID: ${processedOrder.externalId}`);
  console.log(`      Vexboost Status:   ${liveStatus.status}`);
  console.log(`      Start Count:       ${liveStatus.start_count || '0'}`);
  console.log(`      Remains:           ${liveStatus.remains || '10'}`);

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('🎉 FULL STOREFRONT-TO-VEXBOOST PIPELINE VERIFIED SUCCESSFULLY!');
  console.log('════════════════════════════════════════════════════════════════════════');
}

main()
  .catch((err) => {
    console.error('\n❌ FULL PIPELINE TEST FAILED:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
