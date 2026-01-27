-- Security Fixes Migration
-- Fixes Supabase Security Advisor warnings for Search Path Mutable functions
-- Date: 2026-01-27

-- ============================================
-- FIX 1: Secure Search Path for Trigger Functions
-- ============================================

-- Fix notify_insert_monthly_message_count function
CREATE OR REPLACE FUNCTION public.notify_insert_monthly_message_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- Secure search path
AS $$
BEGIN
    PERFORM pg_notify('monthly_message_count_insert', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$;

-- Fix notify_threesman_customer_message_count function
CREATE OR REPLACE FUNCTION public.notify_threesman_customer_message_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM pg_notify('customer_message_count_update', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$;

-- Fix notify_update_product_reserved_stock function
CREATE OR REPLACE FUNCTION public.notify_update_product_reserved_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM pg_notify('product_stock_update', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$;

-- Fix notify_update_cmbbal_sales_updated_at function
CREATE OR REPLACE FUNCTION public.notify_update_cmbbal_sales_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Fix notify_get_ai_metrics_summary function
CREATE OR REPLACE FUNCTION public.notify_get_ai_metrics_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM pg_notify('ai_metrics_update', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$;

-- Fix notify_realtime function (for realtime notifications)
CREATE OR REPLACE FUNCTION public.notify_realtime()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM pg_notify(TG_TABLE_NAME::text, row_to_json(NEW)::text);
    RETURN NEW;
END;
$$;

-- ============================================
-- FIX 2: Update update_customer_stats_manual with secure search path
-- ============================================
CREATE OR REPLACE FUNCTION public.update_customer_stats_manual(
    p_customer_id uuid,
    p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.customers
    SET 
        total_orders = COALESCE(total_orders, 0) + 1,
        total_spent = COALESCE(total_spent, 0) + p_amount,
        updated_at = NOW()
    WHERE id = p_customer_id;
END;
$$;

-- ============================================
-- FIX 3: Update decrement_product_stock with secure search path
-- ============================================
CREATE OR REPLACE FUNCTION public.decrement_product_stock(
    p_product_id uuid,
    p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.products
    SET 
        stock = GREATEST(0, COALESCE(stock, 0) - p_quantity),
        reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - p_quantity),
        updated_at = NOW()
    WHERE id = p_product_id;
END;
$$;

-- ============================================
-- FIX 4: Update reserve_product_stock with secure search path
-- ============================================
CREATE OR REPLACE FUNCTION public.reserve_product_stock(
    p_product_id uuid,
    p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.products
    SET 
        reserved_stock = COALESCE(reserved_stock, 0) + p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;
END;
$$;

-- ============================================
-- FIX 5: Update unreserve_product_stock with secure search path
-- ============================================
CREATE OR REPLACE FUNCTION public.unreserve_product_stock(
    p_product_id uuid,
    p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.products
    SET 
        reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - p_quantity),
        updated_at = NOW()
    WHERE id = p_product_id;
END;
$$;

-- ============================================
-- FIX 6: Ensure admin user check is secure
-- ============================================
CREATE OR REPLACE FUNCTION public.check_admin_user(user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    is_admin boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE clerk_user_id = user_id 
        AND is_active = true
    ) INTO is_admin;
    RETURN is_admin;
END;
$$;

-- ============================================
-- VALIDATION: Grant execute permissions
-- ============================================
GRANT EXECUTE ON FUNCTION public.update_customer_stats_manual(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_product_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unreserve_product_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_admin_user(text) TO authenticated;
