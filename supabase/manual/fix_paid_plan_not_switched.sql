-- =============================================================================
-- Төлбөр төлсөн боловч багц шилжээгүй захиалгыг ID-гаар шалгаж засах
-- Paid-but-not-switched subscription repair script
-- =============================================================================
--
-- ХЭРХЭН АШИГЛАХ ВЭ (Supabase → SQL Editor):
--   1) STEP 0-д дэлгүүрийн нэрээ бичээд ажиллуулж shop_id-г ол (эсвэл аль
--      хэдийн мэдэж байгаа бол алгасаад доош shop_id-гаа тавь).
--   2) STEP 1 (диагностик)-ийг ажиллуулж, төлбөр төлчихөөд багц нь
--      шилжээгүй байгаа эсэхийг баталгаажуул.
--   3) STEP 2 (засвар)-ыг ажиллуул. Энэ нь:
--        - subscriptions  → төлсөн план руу active болгоно
--        - shops          → plan_id / subscription_plan / subscription_status
--        - user_profiles  → ижил мэдээллээр тэгшилнэ (features API үүнийг уншдаг)
--        - invoices/payments → paid болгож тэмдэглэнэ
--   4) STEP 3-аар үр дүнг дахин шалга.
--
-- ⚠️  Бүх STEP 2 нь нэг транзакцид (BEGIN/COMMIT) явагдана. Эхлээд ROLLBACK-аар
--     турших боломжтой: COMMIT-ийг ROLLBACK болгоод үр дүнг хараарай.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 0 — Дэлгүүрийг нэрээр нь олж shop_id авах ("Домбо")
-- ─────────────────────────────────────────────────────────────────────────
SELECT id AS shop_id, user_id, name, plan_id, subscription_plan, subscription_status
FROM shops
WHERE name ILIKE '%Домбо%';


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 1 — ДИАГНОСТИК: төлбөр төлсөн эсэх vs одоогийн багц
--   Доорх :shop_id-г STEP 0-оос гарсан UUID-аар солино уу.
--   (Supabase SQL Editor дээр шууд бичих бол '00000000-...' гэснийг солих.)
-- ─────────────────────────────────────────────────────────────────────────
WITH params AS (
    SELECT '00000000-0000-0000-0000-000000000000'::uuid AS shop_id
)
SELECT
    s.id              AS shop_id,
    s.name            AS shop_name,
    s.user_id         AS shop_user_id,
    s.subscription_plan      AS shop_current_plan,
    s.subscription_status    AS shop_current_status,
    p.id              AS payment_id,
    p.status          AS payment_status,
    p.amount,
    p.subscription_plan_slug AS paid_plan_slug,   -- ← хэрэглэгчийн ТӨЛСӨН план
    p.paid_at,
    p.qpay_invoice_id,
    sub.id            AS subscription_id,
    sub_plan.slug     AS subscription_plan_slug,   -- ← одоогийн subscription дахь план
    sub.status        AS subscription_status
FROM shops s
JOIN params pr ON pr.shop_id = s.id
LEFT JOIN payments p
       ON p.shop_id = s.id
      AND p.payment_type = 'subscription'
LEFT JOIN subscriptions sub
       ON sub.user_id = s.user_id
      AND sub.status IN ('active','trialing','pending','past_due')
LEFT JOIN plans sub_plan ON sub_plan.id = sub.plan_id
ORDER BY p.created_at DESC NULLS LAST;
-- Хэрэв payment_status='paid' ба paid_plan_slug нь shop_current_plan-аас
-- ӨӨР бол → багц шилжээгүй гэсэн үг. STEP 2-оор зас.


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 2 — ЗАСВАР
--   :shop_id болон сонгох төлсөн төлбөрийг тодорхойлно.
--   Default: тухайн дэлгүүрийн ХАМГИЙН СҮҮЛИЙН 'paid' subscription payment.
-- ─────────────────────────────────────────────────────────────────────────
BEGIN;

WITH target AS (
    -- 👇 Энд shop_id-гаа тавь
    SELECT '00000000-0000-0000-0000-000000000000'::uuid AS shop_id
),
paid_payment AS (
    -- Тухайн дэлгүүрийн хамгийн сүүлийн амжилттай subscription төлбөр.
    -- Хэрэв тодорхой нэг төлбөр зөв бол доорх WHERE-д
    --   AND p.id = 'PAYMENT_UUID'  гэж нэмж болно.
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
        s.user_id           AS user_id,
        pl.id               AS plan_id,
        pl.slug             AS plan_slug,
        COALESCE(pp.metadata->>'billing_cycle', 'monthly') AS billing_cycle,
        pp.id               AS payment_id,
        pp.metadata->>'invoice_id' AS invoice_id
    FROM target t
    JOIN shops s        ON s.id = t.shop_id
    JOIN paid_payment pp ON pp.shop_id = t.shop_id
    JOIN plans pl        ON pl.slug = pp.subscription_plan_slug
),
-- (a) Одоо байгаа нээлттэй subscription-г шинэ план руу шилжүүлэх
upd_existing AS (
    UPDATE subscriptions sub
    SET plan_id   = r.plan_id,
        status    = 'active',
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
-- (b) Хэрэв нээлттэй subscription байхгүй бол шинээр үүсгэх
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
-- (c) Тухайн дэлгүүрийн plan-г шинэчлэх (критик write)
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
-- (d) Хэрэглэгчийн БҮХ дэлгүүрт планыг тэгшлэх (план нь per-user)
upd_all_shops AS (
    UPDATE shops s
    SET plan_id = r.plan_id,
        subscription_plan = r.plan_slug,
        subscription_status = 'active'
    FROM resolved r
    WHERE s.user_id = r.user_id
    RETURNING s.id
),
-- (e) user_profiles snapshot (features API үүнийг уншдаг)
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
-- (f) Холбогдох invoice-г paid болгох
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

-- ⚠️ Эхлээд турших бол COMMIT-ийн оронд ROLLBACK ажиллуул.
COMMIT;


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 3 — Баталгаажуулалт (засварын дараа дахин ажиллуул)
-- ─────────────────────────────────────────────────────────────────────────
WITH params AS (
    SELECT '00000000-0000-0000-0000-000000000000'::uuid AS shop_id
)
SELECT s.id AS shop_id, s.name, s.subscription_plan, s.subscription_status,
       sub.status AS sub_status, pl.slug AS sub_plan
FROM shops s
JOIN params pr ON pr.shop_id = s.id
LEFT JOIN subscriptions sub ON sub.user_id = s.user_id
       AND sub.status IN ('active','trialing','pending','past_due')
LEFT JOIN plans pl ON pl.id = sub.plan_id;
