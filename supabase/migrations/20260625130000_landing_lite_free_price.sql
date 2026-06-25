-- ============================================
-- Landing CMS: Lite планы үнийг ҮНЭГҮЙ болгох
-- ============================================
-- Background:
--   The public landing page renders pricing from the `landing_content` table
--   when a row exists, falling back to src/lib/landing/defaults.ts otherwise
--   (see /api/dashboard/landing-content GET). The defaults were updated to make
--   Lite a free tier, but any admin-edited `landing_content.pricing` row still
--   shows the old ₮89,000 / 5,000-credit Lite card. This migration rewrites the
--   stored Lite pricing node + the comparison row to match the new free tier.
--
-- Idempotent: re-running writes the same values. Guarded so environments with
--   no `landing_content` row (defaults already correct) are a no-op.

-- ── (a) pricing.lite → free freemium tier ───────────────────────────────────
UPDATE landing_content
SET pricing = jsonb_set(
        pricing,
        '{lite}',
        '{
            "tag": "LITE",
            "desc": "Үнэгүй эхлэх",
            "accent": "warm",
            "credit": {
                "icon": "⚡",
                "headline": "1,000 AI credit/сар",
                "lines": ["1 Facebook/Instagram хуудас", "Тусгай борлуулагч Agent (Basic)"]
            },
            "price": {
                "monthly": { "value": "Үнэгүй", "per": "" },
                "annual": { "value": "Үнэгүй", "per": "" }
            },
            "cta": { "text": "Үнэгүй эхлэх", "href": "/auth/register?plan=lite" },
            "features": [
                { "kind": "ok", "text": "1 Facebook/Instagram хуудас" },
                { "kind": "ok", "text": "1,000 AI credit/сар" },
                { "kind": "ok", "text": "Тусгай борлуулагч Agent (Basic)" },
                { "kind": "no", "text": "Зураг таних (Vision)" },
                { "kind": "no", "text": "QPay холболт" },
                { "kind": "no", "text": "Тайлан, аналитик" },
                { "kind": "no", "text": "AI санах ой" }
            ]
        }'::jsonb,
        true
    ),
    updated_at = NOW()
WHERE pricing ? 'lite';

-- ── (b) comparison «Сарын AI credit» мөрийн lite утга 5,000 → 1,000 ─────────
UPDATE landing_content
SET comparison = (
        SELECT jsonb_agg(
            CASE
                WHEN elem->>'name' = 'Сарын AI credit'
                    THEN jsonb_set(elem, '{lite}', '"1,000"'::jsonb)
                ELSE elem
            END
            ORDER BY ord
        )
        FROM jsonb_array_elements(comparison) WITH ORDINALITY AS t(elem, ord)
    ),
    updated_at = NOW()
WHERE comparison IS NOT NULL
  AND jsonb_typeof(comparison) = 'array';
