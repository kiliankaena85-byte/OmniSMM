-- Redefine the block_ledger_mutation function to allow status updates from QUARANTINE
CREATE OR REPLACE FUNCTION block_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status = 'QUARANTINE') THEN
    -- Strict security check: only the "status" field may change
    IF (NEW.id = OLD.id AND
        NEW."userId" = OLD."userId" AND
        NEW."adminId" = OLD."adminId" AND
        NEW.amount = OLD.amount AND
        NEW.reason = OLD.reason AND
        NEW."idempotencyKey" = OLD."idempotencyKey" AND
        NEW."transactionType" = OLD."transactionType" AND
        NEW."createdAt" = OLD."createdAt") THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Financial Ledger is immutable. When status is QUARANTINE, only status updates are permitted.';
    END IF;
  END IF;
  RAISE EXCEPTION 'Financial Ledger is immutable. UPDATE and DELETE actions are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;
