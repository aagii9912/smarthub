DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'is_active') THEN
        ALTER TABLE shops ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'shops' AND indexname = 'idx_shops_active') THEN
        CREATE INDEX idx_shops_active ON shops(is_active) WHERE is_active = true;
    END IF;
END $$;
