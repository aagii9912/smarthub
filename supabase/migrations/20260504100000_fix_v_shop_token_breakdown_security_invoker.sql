-- ============================================================
-- Fix: SECURITY DEFINER view → SECURITY INVOKER
-- ============================================================
-- v_shop_token_breakdown was created in 20260428_token_feature_breakdown.sql
-- without security_invoker, triggering the security_definer_view linter
-- (lint 0010). Switch it to invoker semantics so the view enforces the
-- *querying* user's RLS, matching every other view in this project.

ALTER VIEW public.v_shop_token_breakdown SET (security_invoker = on);
