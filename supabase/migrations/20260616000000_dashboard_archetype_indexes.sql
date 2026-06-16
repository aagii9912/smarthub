-- Dashboard archetype-аас үүссэн шинэ query загваруудыг хурдасгах индексүүд.
--
-- Эдгээр нь /api/dashboard/stats болон /api/dashboard/reports-д нэмэгдсэн
-- capability-driven блокуудыг (lead pipeline, follow-up дараалал, cart funnel)
-- production-д хурдан ажиллуулахад зориулагдсан. Шинэ хүснэгт/багана нэмэхгүй —
-- зөвхөн индекс. `appointments(shop_id, scheduled_at)` аль хэдийн индекстэй тул
-- booking блокт нэмэлт индекс шаардлагагүй.
--
-- Тэмдэглэл: migration нь транзакцид ажилладаг тул CREATE INDEX CONCURRENTLY
-- ашиглахгүй (бусад migration-уудын хэв маягтай нийцүүлэв).

-- Lead архетип: тухайн дэлгүүрийн period доторх / сүүлийн lead-үүд
--   customers WHERE shop_id = ? AND created_at >= ?  /  ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_customers_shop_created
  ON customers (shop_id, created_at DESC);

-- Follow-up дараалал: утастай ч захиалгагүй, удаан холбогдоогүй lead-үүд
--   customers WHERE shop_id = ? AND last_contact_at < ?  ORDER BY last_contact_at ASC
CREATE INDEX IF NOT EXISTS idx_customers_shop_last_contact
  ON customers (shop_id, last_contact_at);

-- Commerce архетип: cart funnel — period доторх сагсны төлвийн задаргаа
--   carts WHERE shop_id = ? AND created_at >= ?
CREATE INDEX IF NOT EXISTS idx_carts_shop_created
  ON carts (shop_id, created_at);
