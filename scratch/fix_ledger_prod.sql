-- Step 1: Diagnostic - show entries that need fixing
SELECT id, amount, reason, "transactionType", "createdAt"
FROM "LedgerEntry"
WHERE "transactionType" = 'PAYMENT'
  AND amount > 0
  AND (
    reason ILIKE '%возврат%'
    OR reason ILIKE '%отмена%'
    OR reason ILIKE '%Fail-Fast%'
    OR reason ILIKE '%refund%'
    OR reason ILIKE '%DLQ%'
    OR reason ILIKE '%Store Credit%'
  );

-- Step 2: Temporarily disable immutability trigger
ALTER TABLE "LedgerEntry" DISABLE TRIGGER no_update_delete_ledger;

-- Step 3: Fix misclassified refunds
UPDATE "LedgerEntry"
SET "transactionType" = 'REFUND', "updatedAt" = NOW()
WHERE "transactionType" = 'PAYMENT'
  AND amount > 0
  AND (
    reason ILIKE '%возврат%'
    OR reason ILIKE '%отмена%'
    OR reason ILIKE '%Fail-Fast%'
    OR reason ILIKE '%refund%'
    OR reason ILIKE '%DLQ%'
    OR reason ILIKE '%Store Credit%'
  );

-- Step 4: Re-enable immutability trigger
ALTER TABLE "LedgerEntry" ENABLE TRIGGER no_update_delete_ledger;

-- Step 5: Verify fix
SELECT "transactionType", COUNT(*), SUM(amount) as total_cents
FROM "LedgerEntry"
GROUP BY "transactionType"
ORDER BY "transactionType";
