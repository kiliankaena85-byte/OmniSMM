-- DropIndex
DROP INDEX "LedgerEntry_idempotencyKey_key";

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "transactionType" TEXT NOT NULL DEFAULT 'PAYMENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isKycVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_transactionType_key" ON "LedgerEntry"("idempotencyKey", "transactionType");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneHash_key" ON "User"("phoneHash");

-- Create Ledger mutation blocking function
CREATE OR REPLACE FUNCTION block_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Financial Ledger is immutable. UPDATE and DELETE actions are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

-- Bind trigger to LedgerEntry table
CREATE TRIGGER no_update_delete_ledger
BEFORE UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW
EXECUTE FUNCTION block_ledger_mutation();
