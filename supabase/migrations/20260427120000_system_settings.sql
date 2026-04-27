-- system_settings: single-row JSONB blob for admin-configurable system settings.
-- Uses a singleton row keyed by `id = 1` so we always upsert/update one row.

CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT system_settings_singleton CHECK (id = 1)
);

-- Seed defaults if empty.
INSERT INTO system_settings (id, settings)
VALUES (
    1,
    jsonb_build_object(
        'general', jsonb_build_object(
            'site_name', 'Syncly',
            'support_email', 'support@smarthub.mn',
            'default_currency', 'MNT'
        ),
        'notifications', jsonb_build_object(
            'email_enabled', true,
            'push_enabled', true,
            'sms_enabled', false
        ),
        'billing', jsonb_build_object(
            'trial_days', 3,
            'grace_period_days', 7,
            'auto_suspend', true
        ),
        'ai', jsonb_build_object(
            'default_provider', 'gemini',
            'default_model', 'gemini-3.1-flash-lite-preview',
            'max_tokens', 4096,
            'temperature', 0.7
        )
    )
)
ON CONFLICT (id) DO NOTHING;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON system_settings;
CREATE TRIGGER trg_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_system_settings_updated_at();

-- RLS: service-role only (admin-managed)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE system_settings IS 'Admin-configurable system-wide settings (single-row table, id=1)';
COMMENT ON COLUMN system_settings.settings IS 'JSONB blob: { general, notifications, billing, ai }';
