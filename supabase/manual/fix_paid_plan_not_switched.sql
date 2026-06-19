-- =============================================================================
-- Төлбөр төлсөн боловч багц шилжээгүй захиалгыг засах (нэрээр нь автоматаар)
-- Paid-but-not-switched subscription repair — keyed by SHOP NAME (no UUID edit)
-- =============================================================================
--
-- ХЭРХЭН АШИГЛАХ ВЭ (Supabase → SQL Editor):
--   • Доорх блокуудыг шууд copy/paste хийгээд ажиллуул.
--   • Дэлгүүрийн нэрийг 'Домбо' гэж бичсэн тул ID гараар солих шаардлагагүй.
--   • Хэрэв нэр давхцаж байвал доош тайлбарласан "тодорхой нэг дэлгүүр" хувилбарыг
--     ашиглаж shop_id-г шууд өг.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 1 — ДИАГНОСТИК (copy → run)
-- Төлбөр төлсөн эсэх vs одоогийн багцыг харьцуулна.
-- ─────────────────────────────────────────────────────────────────────────
WITH target AS (
    SELECT id AS shop_id, user_id
    FROM shops
    WHERE name ILIKE '%Домбо%'
)
SELECT
    s.name                   AS shop_name,
    s.subscription_plan      AS shop_current_plan,    -- одоогийн багц
    s.subscription_status    AS shop_current_status,
    p.status                 AS payment_status,
    p.subscription_plan_slug AS paid_plan_slug,        -- ТӨЛСӨН план
    p.amount, p.paid_at, p.qpay_invoice_id,
    pl.slug                  AS subscription_plan_slug, -- subscription дахь план
    sub.status               AS subscription_status
FROM target t
JOIN shops s ON s.id = t.shop_id
LEFT JOIN payments p
       ON p.shop_id = t.shop_id AND p.payment_type = 'subscription'
LEFT JOIN subscriptions sub
       ON sub.user_id = t.user_id
      AND sub.status IN ('active','trialing','pending','past_due')
LEFT JOIN plans pl ON pl.id = sub.plan_id
ORDER BY p.created_at DESC NULLS LAST;
-- payment_status='paid' атлаа paid_plan_slug ≠ shop_current_plan бол → STEP 2.


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 2 — ЗАСВАР (copy → run). Бүгд нэг транзакцид.
-- Туршихыг хүсвэл хамгийн доорх COMMIT-ийг ROLLBACK болго.
-- ─────────────────────────────────────────────────────────────────────────
BEGIN;

WITH target AS (
    SELECT id AS shop_id, user_id
    FROM shops
    WHERE name ILIKE '%Домбо%'
    LIMIT 1
),
paid_payment AS (
    -- Тухайн дэлгүүрийн хамгийн сүүлийн амжилттай subscription төлбөр
    SELECT p.*
    FROM payments p
    JOIN target t ON t.shop_id = p.shop_id
    WHERE p.payment_type = 'subscription'
      AND p.status = 'paid'
      AND p.subscription_plan_slug IS NOT NULL
    ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
    LIMIT 1
),
resolved AS (
    SELECT
        t.shop_id,
        s.user_id,
        pl.id   AS plan_id,
        pl.slug AS plan_slug,
        COALESCE(pp.metadata->>'billing_cycle', 'monthly') AS billing_cycle,
        pp.metadata->>'invoice_id' AS invoice_id
    FROM target t
    JOIN shops s         ON s.id = t.shop_id
    JOIN paid_payment pp ON pp.shop_id = t.shop_id
    JOIN plans pl        ON pl.slug = pp.subscription_plan_slug
),
upd_existing AS (
    UPDATE subscriptions sub
    SET plan_id = r.plan_id,
        status  = 'active',
        billing_cycle = r.billing_cycle,
        current_period_start = NOW(),
        current_period_end   = NOW() + (CASE WHEN r.billing_cycle = 'yearly'
                                             THEN INTERVAL '12 months'
                                             ELSE INTERVAL '1 month' END),
        period_anchor_at     = NOW(),
        tokens_used_in_period = 0,
        updated_at = NOW()
    FROM resolved r
    WHERE sub.user_id = r.user_id
      AND sub.status IN ('active','trialing','pending','past_due')
    RETURNING sub.id
),
ins_new AS (
    INSERT INTO subscriptions
        (user_id, shop_id, plan_id, status, billing_cycle,
         current_period_start, current_period_end, period_anchor_at, tokens_used_in_period)
    SELECT r.user_id, r.shop_id, r.plan_id, 'active', r.billing_cycle,
           NOW(),
           NOW() + (CASE WHEN r.billing_cycle = 'yearly'
                         THEN INTERVAL '12 months' ELSE INTERVAL '1 month' END),
           NOW(), 0
    FROM resolved r
    WHERE NOT EXISTS (SELECT 1 FROM upd_existing)
    RETURNING id
),
upd_shop AS (
    UPDATE shops s
    SET plan_id = r.plan_id,
        subscription_plan = r.plan_slug,
        subscription_status = 'active',
        setup_completed = true
    FROM resolved r
    WHERE s.id = r.shop_id
    RETURNING s.id
),
upd_all_shops AS (
    UPDATE shops s
    SET plan_id = r.plan_id,
        subscription_plan = r.plan_slug,
        subscription_status = 'active'
    FROM resolved r
    WHERE s.user_id = r.user_id
    RETURNING s.id
),
upd_profile AS (
    UPDATE user_profiles up
    SET plan_id = r.plan_id,
        subscription_plan = r.plan_slug,
        subscription_status = 'active',
        updated_at = NOW()
    FROM resolved r
    WHERE up.id = r.user_id
    RETURNING up.id
),
upd_invoice AS (
    UPDATE invoices i
    SET status = 'paid', paid_at = COALESCE(i.paid_at, NOW())
    FROM resolved r
    WHERE r.invoice_id IS NOT NULL
      AND i.id = r.invoice_id::uuid
    RETURNING i.id
)
SELECT
    (SELECT count(*) FROM upd_existing)  AS subscriptions_updated,
    (SELECT count(*) FROM ins_new)       AS subscriptions_inserted,
    (SELECT count(*) FROM upd_shop)      AS shop_updated,
    (SELECT count(*) FROM upd_all_shops) AS all_user_shops_updated,
    (SELECT count(*) FROM upd_profile)   AS user_profile_updated,
    (SELECT count(*) FROM upd_invoice)   AS invoices_marked_paid,
    (SELECT plan_slug FROM resolved)     AS switched_to_plan;

COMMIT;   -- туршихыг хүсвэл: ROLLBACK;


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 3 — БАТАЛГААЖУУЛАЛТ (copy → run)
-- ─────────────────────────────────────────────────────────────────────────
WITH target AS (
    SELECT id AS shop_id, user_id FROM shops WHERE name ILIKE '%Домбо%'
)
SELECT s.name, s.subscription_plan, s.subscription_status,
       sub.status AS sub_status, pl.slug AS sub_plan
FROM target t
JOIN shops s ON s.id = t.shop_id
LEFT JOIN subscriptions sub ON sub.user_id = t.user_id
       AND sub.status IN ('active','trialing','pending','past_due')
LEFT JOIN plans pl ON pl.id = sub.plan_id;


-- =============================================================================
-- ХУВИЛБАР: тодорхой нэг дэлгүүрийг shop_id-гаар (нэр давхцвал)
--   Дээрх блок болгонд:
--     WHERE name ILIKE '%Домбо%'
--   гэснийг дараахаар сольж ажиллуул:
--     WHERE id = 'ЭНД-SHOP-UUID-ТАВИНА'::uuid
-- =============================================================================
