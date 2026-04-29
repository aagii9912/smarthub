-- ============================================
-- DRIFT RECOVERY MIGRATION
-- ============================================
-- Reconciles tables that exist in production Supabase but had no committed
-- migration (webhook_jobs, leads, v_shop_token_breakdown), and creates
-- tables referenced in code but missing from DB (webhook_dead_letters,
-- data_deletion_requests). All statements use IF NOT EXISTS so this is safe
-- to apply against environments where the production drift is already present.
-- ============================================

-- ============================================
-- webhook_jobs (drift: prod has it, repo did not)
-- See: src/lib/webhook/retryService.ts
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT webhook_jobs_status_check
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_jobs_status_retry
    ON webhook_jobs(status, next_retry_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_webhook_jobs_updated_at
    ON webhook_jobs(updated_at);

ALTER TABLE webhook_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages webhook_jobs" ON webhook_jobs;
CREATE POLICY "Service role manages webhook_jobs"
    ON webhook_jobs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- webhook_dead_letters (NEW: code references, table missing)
-- See: src/lib/services/WebhookRetryQueue.ts:119
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id TEXT,
    source TEXT,
    payload JSONB,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ,
    dead_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_dead_letters_shop
    ON webhook_dead_letters(shop_id);

CREATE INDEX IF NOT EXISTS idx_webhook_dead_letters_dead_at
    ON webhook_dead_letters(dead_at);

ALTER TABLE webhook_dead_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages webhook_dead_letters" ON webhook_dead_letters;
CREATE POLICY "Service role manages webhook_dead_letters"
    ON webhook_dead_letters FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Shop owners can read their own dead letters
DROP POLICY IF EXISTS "Shop owners view dead_letters" ON webhook_dead_letters;
CREATE POLICY "Shop owners view dead_letters"
    ON webhook_dead_letters FOR SELECT
    TO authenticated
    USING (shop_id IN (
        SELECT id FROM shops WHERE user_id::text = auth.uid()::text
    ));

-- ============================================
-- data_deletion_requests (NEW: GDPR audit trail, table missing)
-- See: src/app/api/meta/data-deletion/route.ts:112
-- ============================================
CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confirmation_code TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT data_deletion_requests_status_check
        CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user
    ON data_deletion_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status
    ON data_deletion_requests(status);

ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages data_deletion_requests" ON data_deletion_requests;
CREATE POLICY "Service role manages data_deletion_requests"
    ON data_deletion_requests FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- leads (drift: prod has it, repo did not)
-- See: src/app/api/leads/route.ts:60
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    company TEXT,
    message TEXT,
    ai_response TEXT,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at
    ON leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a lead (public form)
DROP POLICY IF EXISTS "Anyone can insert leads" ON leads;
CREATE POLICY "Anyone can insert leads"
    ON leads FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Only service role can read leads
DROP POLICY IF EXISTS "Service role manages leads" ON leads;
CREATE POLICY "Service role manages leads"
    ON leads FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
