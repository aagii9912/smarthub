-- Add bank details columns to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS account_name TEXT;

-- Notify change
COMMENT ON COLUMN shops.bank_name IS 'Name of the bank (e.g. Khan Bank)';
COMMENT ON COLUMN shops.account_number IS 'Bank account number';
COMMENT ON COLUMN shops.account_name IS 'Account holder name';
