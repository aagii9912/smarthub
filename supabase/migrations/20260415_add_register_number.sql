-- Add register_number column to shops table
-- Required for QPay merchant registration (company/individual register number)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS register_number TEXT;
COMMENT ON COLUMN shops.register_number IS 'Company or individual register number (РД) - required for QPay';
