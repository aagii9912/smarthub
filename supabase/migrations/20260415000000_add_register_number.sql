-- Add register_number and merchant_type columns to shops table
-- Required for QPay merchant registration (company/individual register number)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS register_number TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS merchant_type TEXT DEFAULT 'person' CHECK (merchant_type IN ('person', 'company'));
COMMENT ON COLUMN shops.register_number IS 'Company or individual register number (РД) - required for QPay';
COMMENT ON COLUMN shops.merchant_type IS 'QPay merchant type: person (individual) or company';
