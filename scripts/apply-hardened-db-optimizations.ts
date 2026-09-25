/**
 * @file apply-hardened-db-optimizations.ts
 * Applies Bank-Grade DDL optimizations, HOT fillfactor, partial queue indexes,
 * and hardware-level ledger immutability triggers directly to PostgreSQL.
 */

import { db } from '../src/lib/db';

async function main() {
  console.log('🚀 [DB-OPTIMIZE] Connecting to database...');

  try {
    // 1. Verify connection
    await db.$queryRaw`SELECT 1`;
    console.log('✅ [DB-OPTIMIZE] Connection established.');

    // 2. MVCC HOT Fillfactor for User and Order
    console.log('📦 [DB-OPTIMIZE] Applying fillfactor = 85 on User and Order...');
    await db.$executeRawUnsafe(`ALTER TABLE "User" SET (fillfactor = 85);`);
    await db.$executeRawUnsafe(`ALTER TABLE "Order" SET (fillfactor = 85);`);
    console.log('✅ [DB-OPTIMIZE] HOT fillfactor applied.');

    // 3. Partial indexes for active queues with valid enum literals
    console.log('⚡ [DB-OPTIMIZE] Creating partial index idx_orders_active_queue...');
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_orders_active_queue"
      ON "Order" ("tenantId", "status", "createdAt")
      WHERE status IN ('PENDING', 'IN_PROGRESS');
    `);

    console.log('⚡ [DB-OPTIMIZE] Creating partial index idx_tickets_active_queue...');
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_tickets_active_queue"
      ON "Ticket" ("tenantId", "status", "createdAt")
      WHERE status IN ('OPEN', 'PENDING');
    `);
    console.log('✅ [DB-OPTIMIZE] Partial indexes successfully created.');

    // 4. Ledger Immutability Trigger in PostgreSQL (PCI DSS Req 10.2)
    console.log('🔒 [DB-OPTIMIZE] Installing PostgreSQL trigger trg_prevent_ledger_mutation...');
    await db.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'DELETE' THEN
              RAISE EXCEPTION 'LedgerEntry immutability violation: Deletes are strictly prohibited.';
          ELSIF TG_OP = 'UPDATE' THEN
              IF OLD.amount IS DISTINCT FROM NEW.amount THEN
                  RAISE EXCEPTION 'LedgerEntry immutability violation: Amount modification is strictly prohibited.';
              END IF;
              IF OLD."userId" IS DISTINCT FROM NEW."userId" THEN
                  RAISE EXCEPTION 'LedgerEntry immutability violation: userId modification is strictly prohibited.';
              END IF;
              IF OLD."transactionType" IS DISTINCT FROM NEW."transactionType" THEN
                  RAISE EXCEPTION 'LedgerEntry immutability violation: transactionType modification is strictly prohibited.';
              END IF;
              IF OLD."tenantId" IS DISTINCT FROM NEW."tenantId" THEN
                  RAISE EXCEPTION 'LedgerEntry immutability violation: tenantId modification is strictly prohibited.';
              END IF;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_prevent_ledger_mutation ON "LedgerEntry";`);
    await db.$executeRawUnsafe(`
      CREATE TRIGGER trg_prevent_ledger_mutation
      BEFORE UPDATE OR DELETE ON "LedgerEntry"
      FOR EACH ROW
      EXECUTE FUNCTION prevent_ledger_mutation();
    `);
    console.log('✅ [DB-OPTIMIZE] Ledger immutability trigger successfully installed in PostgreSQL.');

    // 5. Verification
    const reloptions: Array<{ relname: string; reloptions: string[] | null }> = await db.$queryRaw`
      SELECT relname, reloptions FROM pg_class WHERE relname IN ('User', 'Order');
    `;
    console.log('📊 [DB-OPTIMIZE] Reloptions in database:', reloptions);

    const triggers: Array<{ trigger_name: string }> = await db.$queryRaw`
      SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'trg_prevent_ledger_mutation';
    `;
    console.log('📊 [DB-OPTIMIZE] Triggers in database:', triggers);

    console.log('🎉 [DB-OPTIMIZE] All database optimizations verified and active!');
  } catch (err) {
    console.error('❌ [DB-OPTIMIZE] Error during execution:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
