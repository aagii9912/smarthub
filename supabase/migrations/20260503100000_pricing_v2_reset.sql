-- Reset pricing JSONB to empty for any landing_content row that still has the old shape.
-- After this runs, the API GET fallback (which now requires `business` + `eyebrowNum` keys)
-- serves the defaults from src/lib/landing/defaults.ts until an admin re-saves the section.
-- Idempotent: only matches rows lacking the new `business` key.

UPDATE landing_content
SET pricing = '{}'::jsonb,
    updated_at = NOW()
WHERE pricing IS NOT NULL
  AND NOT (pricing ? 'business');
