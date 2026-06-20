-- Repair: re-assert the CRM columns on `customers`.
--
-- The remote migration history records 20260113130003_add_crm_columns as applied,
-- but the columns it adds are missing on the production DB (history ↔ schema
-- drift). The dashboard-archetype index migration (20260616000000) builds an
-- index on customers.last_contact_at and aborts the whole `db push` without it.
--
-- Ordered just before that migration so the column exists when it runs. Every
-- statement is idempotent (ADD COLUMN / CREATE INDEX IF NOT EXISTS), so this is a
-- no-op wherever the columns already exist.
--
-- NOTE: the original migration's auto-maintenance triggers are intentionally
-- omitted here — one targets a `chat_history` table that does not exist in this
-- schema (messaging lives in conversations/messages), and would re-break the
-- push. Re-add them separately against the correct tables if needed.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent DECIMAL(12,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_customers_tags ON customers USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_customers_last_contact ON customers (last_contact_at DESC);

-- Light, dependency-free backfill so the column is queryable (uses only customers.created_at).
UPDATE customers SET last_contact_at = created_at WHERE last_contact_at IS NULL;
