/**
 * @file migrate-ledger-types.ts
 * @description Миграция исторических записей LedgerEntry с общих типов PAYMENT/REFUND на детальные 7 типов
 */

import { db } from '../src/lib/db';

async function migrateLedgerTypes() {
  console.log('🔄 Starting LedgerEntry transactionType migration...');

  // 1. Пополнения баланса (amount > 0 + ключевые слова пополнения / topup / yookassa)
  const topupRes = await db.$executeRawUnsafe(`
    UPDATE "LedgerEntry"
    SET "transactionType" = 'TOPUP'
    WHERE "transactionType" = 'PAYMENT'
      AND "amount" > 0
      AND ("reason" ILIKE '%пополнение%' OR "reason" ILIKE '%topup%' OR "reason" ILIKE '%yookassa%' OR "reason" ILIKE '%юkassa%');
  `);
  console.log(`✅ Updated TOPUP entries: ${topupRes}`);

  // 2. Оплата заказов (amount < 0 + слова оплата / списание / charge)
  const chargeRes = await db.$executeRawUnsafe(`
    UPDATE "LedgerEntry"
    SET "transactionType" = 'ORDER_CHARGE'
    WHERE "transactionType" = 'PAYMENT'
      AND "amount" < 0
      AND ("reason" ILIKE '%оплата%' OR "reason" ILIKE '%списание%' OR "reason" ILIKE '%charge%' OR "reason" ILIKE '%заказ%')
      AND "reason" NOT ILIKE '%перезапуск%';
  `);
  console.log(`✅ Updated ORDER_CHARGE entries: ${chargeRes}`);

  // 3. Перезапуск заказов (REROUTE)
  const rerouteRes = await db.$executeRawUnsafe(`
    UPDATE "LedgerEntry"
    SET "transactionType" = 'REROUTE'
    WHERE "reason" ILIKE '%перезапуск%';
  `);
  console.log(`✅ Updated REROUTE entries: ${rerouteRes}`);

  // 4. Ручные отмены администратором (ORDER_CANCEL)
  const cancelRes = await db.$executeRawUnsafe(`
    UPDATE "LedgerEntry"
    SET "transactionType" = 'ORDER_CANCEL'
    WHERE "transactionType" = 'REFUND'
      AND "reason" ILIKE '%отмена заказа%';
  `);
  console.log(`✅ Updated ORDER_CANCEL entries: ${cancelRes}`);

  // 5. Авто-возвраты провайдера / системы (REFUND)
  const autoRefundRes = await db.$executeRawUnsafe(`
    UPDATE "LedgerEntry"
    SET "transactionType" = 'REFUND'
    WHERE "transactionType" = 'REFUND'
      AND ("reason" ILIKE '%авто-возврат%' OR "reason" ILIKE '%fail-fast%' OR "reason" ILIKE '%dlq%');
  `);
  console.log(`✅ Updated/confirmed auto REFUND entries: ${autoRefundRes}`);

  // 6. Ручные корректировки оператора (ADJUSTMENT)
  const adjustmentRes = await db.$executeRawUnsafe(`
    UPDATE "LedgerEntry"
    SET "transactionType" = 'ADJUSTMENT'
    WHERE "adminId" IS NOT NULL
      AND "transactionType" IN ('PAYMENT', 'COMPENSATION')
      AND "reason" NOT ILIKE '%бонус%'
      AND "reason" NOT ILIKE '%компенсац%';
  `);
  console.log(`✅ Updated ADJUSTMENT entries: ${adjustmentRes}`);

  // 7. Все оставшиеся положительные PAYMENT без явного типа -> TOPUP
  const fallbackTopup = await db.$executeRawUnsafe(`
    UPDATE "LedgerEntry"
    SET "transactionType" = 'TOPUP'
    WHERE "transactionType" = 'PAYMENT' AND "amount" > 0;
  `);
  console.log(`✅ Fallback positive PAYMENT -> TOPUP: ${fallbackTopup}`);

  // 8. Все оставшиеся отрицательные PAYMENT -> ORDER_CHARGE
  const fallbackCharge = await db.$executeRawUnsafe(`
    UPDATE "LedgerEntry"
    SET "transactionType" = 'ORDER_CHARGE'
    WHERE "transactionType" = 'PAYMENT' AND "amount" < 0;
  `);
  console.log(`✅ Fallback negative PAYMENT -> ORDER_CHARGE: ${fallbackCharge}`);

  // Распределение после миграции
  const distribution = await db.$queryRawUnsafe<{ transactionType: string; count: bigint }[]>(`
    SELECT "transactionType", COUNT(*) as count
    FROM "LedgerEntry"
    GROUP BY "transactionType"
    ORDER BY count DESC;
  `);

  console.log('\n📊 LedgerEntry distribution after migration:');
  for (const row of distribution) {
    console.log(`  - ${row.transactionType}: ${row.count.toString()}`);
  }

  await db.$disconnect();
  console.log('\n🎉 Migration completed successfully!');
}

migrateLedgerTypes().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
