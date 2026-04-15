-- ============================================
-- Fix Supabase Security Linter Issues
-- Run this in Supabase SQL Editor
-- ============================================

-- ─── 1. Fix: RLS Disabled on public tables ───
-- Enable RLS on tables missing it

ALTER TABLE public.customer_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sentiment ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for these tables (service role only - backend access)
CREATE POLICY "Service role access customer_memory"
    ON public.customer_memory FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role access conversation_summaries"
    ON public.conversation_summaries FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role access conversation_sentiment"
    ON public.conversation_sentiment FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ─── 2. Fix: Security Definer View ───
-- Change v_conversation_analytics to SECURITY INVOKER
ALTER VIEW public.v_conversation_analytics SET (security_invoker = on);

-- ─── 3. Fix: Function search_path mutable ───
-- Set explicit search_path for functions

ALTER FUNCTION public.increment_shop_token_usage SET search_path = public;
ALTER FUNCTION public.update_customer_memory_timestamp SET search_path = public;
ALTER FUNCTION public.get_shop_token_usage SET search_path = public;

-- ─── 4. Fix: payment_audit_logs RLS policy too permissive ───
-- Drop the overly permissive policy and create proper one
DROP POLICY IF EXISTS "Service role full access to audit logs" ON public.payment_audit_logs;

CREATE POLICY "Service role audit logs access"
    ON public.payment_audit_logs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ─── 5. Also add 'paid' to order_status enum if not exists ───
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'paid' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
    ) THEN
        ALTER TYPE order_status ADD VALUE 'paid';
    END IF;
END $$;

-- ─── 6. Add merchant_type column to shops ───
ALTER TABLE shops ADD COLUMN IF NOT EXISTS register_number TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS merchant_type TEXT DEFAULT 'person';

SELECT 'Security linter fixes applied ✅' as result;
