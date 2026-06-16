-- ============================================
-- Shop-level RBAC: Team Members
-- Migration: 20260616120000_shop_members_rbac.sql
--
-- Дэлгүүрийн эзэн (shops.user_id) ажилтнуудаа урьж, эрхийн түвшинтэйгээр
-- (owner / admin / staff) dashboard руу нэвтрүүлэх боломжийг нэмнэ.
--
-- ⚠️ ЧУХАЛ: API маршрутууд бараг бүгд service-role (supabaseAdmin) ашигладаг
-- бөгөөд service-role нь RLS-ийг алгасдаг. Тиймээс эрхийн ЖИНХЭНЭ хяналт нь
-- app-layer дээр (src/lib/auth/membership.ts -> requirePermission) хийгдэнэ.
-- Доорх RLS нь зөвхөн defense-in-depth (user-context client ашиглах цөөн зам)
-- бөгөөд role ялгаа (admin vs staff бичих эрх) хийдэггүй — түүнийг app-layer хийнэ.
-- ============================================

-- ── Enums ───────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_member_role') THEN
        CREATE TYPE shop_member_role AS ENUM ('owner', 'admin', 'staff');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_member_status') THEN
        CREATE TYPE shop_member_status AS ENUM ('pending', 'active', 'revoked');
    END IF;
END$$;

-- ── Table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_members (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    -- accept хийх хүртэл NULL; accept дээр нэвтэрсэн хэрэглэгчийн id холбогдоно
    user_id      UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    email        TEXT NOT NULL,                  -- урьсан имэйл (доод үсгээр хадгална)
    role         shop_member_role NOT NULL DEFAULT 'staff',
    status       shop_member_status NOT NULL DEFAULT 'pending',
    invite_token TEXT,                           -- санамсаргүй token, accept дээр NULL болно
    invited_by   UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    accepted_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Эзэн нь implicit (shops.user_id). shop_members-д owner role оруулахыг хориглоно.
    CONSTRAINT shop_members_no_owner_role CHECK (role <> 'owner')
);

-- ── Indexes ─────────────────────────────────────────────────────────────
-- Нэг дэлгүүрт нэг имэйл дээр зэрэг идэвхтэй/хүлээгдэж буй гишүүнчлэл нэг л байна
-- (revoke хийсний дараа дахин урих боломжтой).
CREATE UNIQUE INDEX IF NOT EXISTS shop_members_shop_email_uniq
    ON shop_members (shop_id, lower(email))
    WHERE status <> 'revoked';
CREATE UNIQUE INDEX IF NOT EXISTS shop_members_shop_user_uniq
    ON shop_members (shop_id, user_id)
    WHERE user_id IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS shop_members_user_active_idx
    ON shop_members (user_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS shop_members_token_uniq
    ON shop_members (invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS shop_members_shop_idx ON shop_members (shop_id);

-- updated_at автомат шинэчлэл (одоо байгаа helper-ийг ашиглана)
DROP TRIGGER IF EXISTS shop_members_updated_at ON shop_members;
CREATE TRIGGER shop_members_updated_at
    BEFORE UPDATE ON shop_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ── Helper functions ────────────────────────────────────────────────────
-- Хэрэглэгчийн нэвтрэх боломжтой бүх дэлгүүрийн id (эзэн + active гишүүн).
-- ⚠️ shops.user_id нь TEXT төрөлтэй тул auth.uid() (uuid)-ийг ::text болгож харьцуулна.
-- shop_members.user_id нь UUID тул auth.uid()-тэй шууд харьцуулна.
CREATE OR REPLACE FUNCTION user_accessible_shop_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT id FROM shops WHERE user_id = auth.uid()::text
    UNION
    SELECT shop_id FROM shop_members
      WHERE user_id = auth.uid() AND status = 'active';
$$;

-- get_user_shop_id()-ийг гишүүнчлэлийг ойлгодог болгож шинэчилнэ. Энэ функцийг
-- одоо байгаа олон хүснэгтийн RLS policy ашигладаг тул нэг газар шинэчилснээр
-- active гишүүн эзний дэлгүүрийн мөрүүдийг (defense-in-depth) уншиж чадна.
-- Хуучин зан төлөв (нэг UUID буцаах) хадгалагдана.
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT id FROM shops WHERE user_id = auth.uid()::text
    UNION
    SELECT shop_id FROM shop_members
      WHERE user_id = auth.uid() AND status = 'active'
    LIMIT 1;
$$;

-- ── RLS on shop_members ─────────────────────────────────────────────────
ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;

-- SELECT: өөрийн гишүүнчлэлийн мөр ЭСВЭЛ эзэмшиж буй дэлгүүрийн гишүүд.
-- shops.user_id нь TEXT тул auth.uid()::text-ээр харьцуулна.
DROP POLICY IF EXISTS "shop_members_select" ON shop_members;
CREATE POLICY "shop_members_select" ON shop_members
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()::text)
    );

-- INSERT/UPDATE/DELETE: зөвхөн service-role-оор (API маршрут) дамжина —
-- permissive write policy нэмэхгүй (эрх дэвших логикийг нэг газар төвлөрүүлнэ).

COMMENT ON TABLE shop_members IS
  'Дэлгүүрийн түвшний RBAC гишүүд. Эзэн нь implicit (shops.user_id), энд owner role оруулдаггүй. Эрхийн хяналт нь app-layer (requirePermission) дээр, RLS нь defense-in-depth.';
