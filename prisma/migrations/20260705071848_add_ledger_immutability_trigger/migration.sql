-- ВНИМАНИЕ: Данный триггер защищает записи LedgerEntry от удаления и изменения критических полей (amount).
-- Это предотвращает компрометацию балансов даже при уязвимостях в Prisma Client или при использовании deleteMany.

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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ledger_mutation ON "LedgerEntry";

CREATE TRIGGER trg_prevent_ledger_mutation
BEFORE UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_mutation();
