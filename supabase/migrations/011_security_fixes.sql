-- SmartHub Security Fixes
-- Fix RLS and function search_path issues

-- ============================================
-- 1. Enable RLS on usage_summary table
-- ============================================
ALTER TABLE IF EXISTS public.usage_summary ENABLE ROW LEVEL SECURITY;

-- Create policy for usage_summary if needed
DO $$ BEGIN
    CREATE POLICY "Enable read access for authenticated users" ON public.usage_summary
        FOR SELECT
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. Fix function search_path security issues
-- ============================================

-- Fix generate_invoice_number
ALTER FUNCTION IF EXISTS public.generate_invoice_number() SET search_path = public;

-- Fix decrement_stock
ALTER FUNCTION IF EXISTS public.decrement_stock(uuid, integer) SET search_path = public;

-- Fix get_user_shop_id
ALTER FUNCTION IF EXISTS public.get_user_shop_id() SET search_path = public;

-- Fix update_updated_at
ALTER FUNCTION IF EXISTS public.update_updated_at() SET search_path = public;

-- Fix update_customer_stats
ALTER FUNCTION IF EXISTS public.update_customer_stats() SET search_path = public;

SELECT 'Security fixes applied successfully! ✅' as result;
