-- ============================================
-- Feature Gating Schema Expansion
-- Expands the features JSONB to include all plan features
-- ============================================

-- Update existing plans with expanded features structure
UPDATE plans 
SET features = features || jsonb_build_object(
    'ai_model', CASE 
        WHEN slug IN ('professional', 'enterprise') THEN 'gpt-4o'
        ELSE 'gpt-4o-mini'
    END,
    'sales_intelligence', slug IN ('professional', 'enterprise'),
    'ai_memory', slug IN ('professional', 'enterprise'),
    'cart_system', CASE 
        WHEN slug = 'enterprise' THEN 'full'
        WHEN slug IN ('professional', 'starter') THEN 'basic'
        ELSE 'none'
    END,
    'payment_integration', slug IN ('professional', 'enterprise'),
    'crm_analytics', CASE 
        WHEN slug = 'enterprise' THEN 'full'
        WHEN slug = 'professional' THEN 'advanced'
        WHEN slug = 'starter' THEN 'basic'
        ELSE 'none'
    END,
    'auto_tagging', slug IN ('professional', 'enterprise'),
    'appointment_booking', slug = 'enterprise',
    'bulk_marketing', slug = 'enterprise',
    'excel_export', slug IN ('starter', 'professional', 'enterprise'),
    'custom_branding', slug = 'enterprise',
    'comment_reply', slug IN ('starter', 'professional', 'enterprise')
)
WHERE slug IN ('free', 'starter', 'professional', 'enterprise');

-- Add enabled_features column to shops for per-shop overrides
ALTER TABLE shops ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT '{}';

-- Add limit_overrides column for VIP shops
ALTER TABLE shops ADD COLUMN IF NOT EXISTS limit_overrides JSONB DEFAULT '{}';

-- Create function to get effective features for a shop
CREATE OR REPLACE FUNCTION get_shop_features(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_features JSONB;
    v_shop_overrides JSONB;
BEGIN
    -- Get plan features
    SELECT p.features INTO v_plan_features
    FROM shops s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.id = p_shop_id;
    
    -- Get shop-level overrides
    SELECT COALESCE(enabled_features, '{}') INTO v_shop_overrides
    FROM shops WHERE id = p_shop_id;
    
    -- Merge: shop overrides take precedence
    RETURN COALESCE(v_plan_features, '{}') || COALESCE(v_shop_overrides, '{}');
END;
$$;

-- Create function to get effective limits for a shop
CREATE OR REPLACE FUNCTION get_shop_limits(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_limits JSONB;
    v_shop_overrides JSONB;
BEGIN
    -- Get plan limits
    SELECT p.limits INTO v_plan_limits
    FROM shops s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.id = p_shop_id;
    
    -- Get shop-level overrides
    SELECT COALESCE(limit_overrides, '{}') INTO v_shop_overrides
    FROM shops WHERE id = p_shop_id;
    
    -- Merge: shop overrides take precedence
    RETURN COALESCE(v_plan_limits, '{}') || COALESCE(v_shop_overrides, '{}');
END;
$$;

SELECT 'Feature gating schema expanded successfully!' as result;
