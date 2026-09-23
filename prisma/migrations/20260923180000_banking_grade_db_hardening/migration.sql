-- ==============================================================================
-- (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
-- BANKING-GRADE DATABASE HARDENING MIGRATION (RAC-2026 / FA-2026)
-- Adhering to: concurrency-acid-guard, postgres-query-doctor, db-evolution-zero-downtime
-- ==============================================================================

-- 1. Enable Trigram Indexing Extension for High-Performance Search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Hardware-Level Non-Negative User Balance Constraint
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS chk_user_balance_non_negative;
ALTER TABLE "User" ADD CONSTRAINT chk_user_balance_non_negative CHECK (balance >= 0);

-- 3. Resolve Trigger Conflict & Enforce Ledger Immutability with Multi-Tenant Guard
-- Drop competing blocking trigger if it was previously applied manually
DROP TRIGGER IF EXISTS trg_ledger_immutable ON "LedgerEntry";
DROP FUNCTION IF EXISTS enforce_ledger_immutability();

-- Update canonical ledger protection function to include tenantId protection
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

DROP TRIGGER IF EXISTS trg_prevent_ledger_mutation ON "LedgerEntry";
CREATE TRIGGER trg_prevent_ledger_mutation
BEFORE UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_mutation();

-- 4. High-Load GIN Trigram Indexes (Eliminates Sequential Scans)
CREATE INDEX IF NOT EXISTS idx_order_link_trgm ON "Order" USING gin (link gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_name_trgm ON "Service" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_email_trgm ON "User" USING gin (email gin_trgm_ops);

-- 5. MVCC Tuning: Fillfactor 85% for Order Table (HOT-Updates / Zero Table Bloat)
ALTER TABLE "Order" SET (fillfactor = 85);
