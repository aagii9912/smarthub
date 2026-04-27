-- Allow super-admin to override the per-plan AI tool list from the database.
-- When NULL, AIRouter falls back to the hardcoded PLAN_CONFIGS in
-- src/lib/ai/config/plans.ts (existing behavior).

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS enabled_tools TEXT[];

COMMENT ON COLUMN plans.enabled_tools IS
  'Optional per-plan AI tool override. When NULL, AIRouter uses the hardcoded enabledTools from src/lib/ai/config/plans.ts. When set, this list replaces the hardcoded one entirely.';
