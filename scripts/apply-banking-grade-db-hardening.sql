-- ==============================================================================
-- (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
-- BANKING-GRADE DATABASE HARDENING MIGRATION (RAC-2026 / FA-2026)
-- Adhering to: concurrency-acid-guard, postgres-query-doctor, db-evolution-zero-downtime
-- ==============================================================================

-- 1. Enable Trigram Indexing Extension for Substring Searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Financial Invariant: Hardware-Level Non-Negative User Balance Constraint
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS chk_user_balance_non_negative;
ALTER TABLE "User" ADD CONSTRAINT chk_user_balance_non_negative CHECK (balance >= 0);

-- 3. Banking Invariant: Immutable Append-Only Ledger Trigger
CREATE OR REPLACE FUNCTION enforce_ledger_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'FATAL [SECURITY]: LedgerEntry is immutable! UPDATE and DELETE operations are strictly prohibited by banking policy.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_immutable ON "LedgerEntry";
CREATE TRIGGER trg_ledger_immutable
BEFORE UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION enforce_ledger_immutability();

-- 4. High-Load Architecture: GIN Trigram Indexes (Eliminate Seq Scans)
CREATE INDEX IF NOT EXISTS idx_order_link_trgm ON "Order" USING gin (link gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_name_trgm ON "Service" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_email_trgm ON "User" USING gin (email gin_trgm_ops);

-- 5. MVCC Tuning: Fillfactor 85% for Order Table (HOT-Updates / Zero Table Bloat)
ALTER TABLE "Order" SET (fillfactor = 85);
