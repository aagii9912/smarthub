-- Promotions: admin-managed campaigns (currently single "1 жил төлж 2 жил" bonus_year)
-- Yearly subscriptions get +bonus_months extra when an active promo includes the plan slug.

-- ============================================
-- promotions: campaign config (single-row in v1)
-- ============================================

CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    type VARCHAR(30) NOT NULL DEFAULT 'bonus_year',
    bonus_months INT NOT NULL DEFAULT 12,
    eligible_billing_cycles TEXT[] NOT NULL DEFAULT ARRAY['yearly'],
    eligible_plan_slugs TEXT[] NOT NULL DEFAULT ARRAY['lite', 'starter', 'pro'],
    is_active BOOLEAN NOT NULL DEFAULT false,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_promotions_bonus_months_positive CHECK (bonus_months > 0),
    CONSTRAINT chk_promotions_window CHECK (
        starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at
    )
);

-- ============================================
-- promotion_redemptions: audit log (idempotent on webhook retry)
-- ============================================

CREATE TABLE IF NOT EXISTS promotion_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES promotions(id),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    payment_id UUID,
    plan_slug VARCHAR(50) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL,
    bonus_months_granted INT NOT NULL,
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id, promotion_id, payment_id)
);

CREATE INDEX IF NOT EXISTS idx_promotions_active
    ON promotions(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_shop
    ON promotion_redemptions(shop_id);

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_redeemed_at
    ON promotion_redemptions(redeemed_at DESC);

-- ============================================
-- updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promotions_updated_at ON promotions;
CREATE TRIGGER trg_promotions_updated_at
    BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION update_promotions_updated_at();

-- ============================================
-- Seed: одоогоор зөвхөн "1 жил төлж 2 жил" promo (анхдагч төлөв: idle)
-- ============================================

INSERT INTO promotions (code, name, description, type, bonus_months,
    eligible_billing_cycles, eligible_plan_slugs, is_active)
VALUES (
    'one_year_bonus',
    '1 жил төлж 2 жил',
    'Жилийн захиалгад нэмэлт 12 сар үнэгүй ашиглах урамшуулал.',
    'bonus_year',
    12,
    ARRAY['yearly'],
    ARRAY['lite', 'starter', 'pro'],
    false
)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- RLS: service-role only (admin-managed)
-- ============================================

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_redemptions ENABLE ROW LEVEL SECURITY;

-- No PUBLIC SELECT/INSERT/UPDATE policies — only service-role bypasses RLS.
-- /api/subscription/plans болон /api/admin/promotions endpoints нь service-role
-- дээр ажиллах ба тэр нь л RLS-г bypass хийнэ.

COMMENT ON TABLE promotions IS 'Admin-managed promotional campaigns (one-row design for v1)';
COMMENT ON TABLE promotion_redemptions IS 'Promo redemption audit log (idempotent via UNIQUE constraint)';
COMMENT ON COLUMN promotions.bonus_months IS 'Additional months added to current_period_end on yearly subscription';
COMMENT ON COLUMN promotions.eligible_billing_cycles IS 'Which billing cycles trigger the bonus (default: yearly only)';
COMMENT ON COLUMN promotions.eligible_plan_slugs IS 'Plans this promo applies to (subset of plans.slug values)';
