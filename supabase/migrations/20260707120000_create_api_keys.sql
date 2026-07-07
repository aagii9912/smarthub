-- ============================================
-- Public API Keys — гуравдагч талд AI чат API-г ашиглуулах
-- Migration: 20260707120000_create_api_keys.sql
--
-- Дэлгүүр эзэн өөрийн дэлгүүрт зориулж API key үүсгэж, гадны төслөөс
-- `POST /api/v1/chat` руу `Authorization: Bearer sk_live_...` толгойгоор
-- хандах боломжийг нэмнэ.
--
-- ⚠️ ЧУХАЛ: API маршрутууд service-role (supabaseAdmin) ашигладаг тул RLS
-- алгасагдана. Эрхийн ЖИНХЭНЭ хяналт нь app-layer дээр (resolveApiKey +
-- requirePermission) хийгдэнэ. Доорх RLS нь зөвхөн defense-in-depth.
--
-- ⚠️ Түлхүүрийн PLAINTEXT-ийг ХЭЗЭЭ Ч хадгалахгүй — зөвхөн SHA-256 hash.
-- ============================================

CREATE TABLE IF NOT EXISTS api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    -- Дэлгүүрийн эзэн (shops.user_id — TEXT дотор UUID). Token metering зөв
    -- хэрэглэгчийн pool руу орохын тулд эзний id-г хадгална.
    user_id      TEXT NOT NULL,
    name         TEXT NOT NULL,
    -- Түлхүүрийн эхний хэсэг (жагсаалтад таних зорилгоор, ж: "sk_live_a1b2c3").
    key_prefix   TEXT NOT NULL,
    -- Бүтэн түлхүүрийн SHA-256 (hex). Lookup нь энэ баганаар шууд хийгдэнэ.
    key_hash     TEXT NOT NULL UNIQUE,
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────
-- key_hash дээр UNIQUE аль хэдийн index үүсгэдэг ч lookup-ийг тод болгож нэмнэ.
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_shop_idx ON api_keys (shop_id);

-- ── RLS (defense-in-depth) ──────────────────────────────────────────────
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- SELECT: зөвхөн хэрэглэгчийн хандах эрхтэй дэлгүүрийн key-үүд.
-- (user_accessible_shop_ids() нь 20260616120000_shop_members_rbac.sql-д
-- тодорхойлогдсон — эзэн + active гишүүн.)
DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
CREATE POLICY "api_keys_select" ON api_keys
    FOR SELECT
    USING (shop_id IN (SELECT user_accessible_shop_ids()));

-- INSERT/UPDATE/DELETE: зөвхөн service-role-оор (API маршрут) дамжина —
-- permissive write policy нэмэхгүй (эрхийн логикийг app-layer төвлөрүүлнэ).

COMMENT ON TABLE api_keys IS
  'Гуравдагч талын public AI чат API (/api/v1/chat)-д зориулсан API key-үүд. key_hash нь SHA-256 (plaintext хадгалдаггүй). Эрхийн хяналт app-layer дээр, RLS нь defense-in-depth.';
