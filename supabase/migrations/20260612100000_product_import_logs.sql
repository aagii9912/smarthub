-- Бүтээгдэхүүний импортын audit log
-- Хэн, хэзээ, ямар файлаас хэдэн бараа импортолсон, хэдэн мөр яагаад алгасагдсаныг бүртгэнэ.

CREATE TABLE IF NOT EXISTS product_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID,
  file_name TEXT,
  file_size INTEGER,
  -- parse: файл уншсан (DB бичээгүй) | import: бараа DB-д орсон
  action TEXT NOT NULL DEFAULT 'import' CHECK (action IN ('parse', 'import')),
  -- ai | rules | docx | manual_fallback | preview_confirm
  source TEXT NOT NULL DEFAULT 'ai',
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  -- [{ "row": 3, "name": "...", "reason": "Үнэ буруу" }]
  skipped_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_import_logs_shop
  ON product_import_logs(shop_id, created_at DESC);

ALTER TABLE product_import_logs ENABLE ROW LEVEL SECURITY;

-- Дэлгүүрийн эзэн өөрийн импортын түүхийг харна (бичилт service role-оор хийгдэнэ)
DROP POLICY IF EXISTS "Shop owners can view own import logs" ON product_import_logs;
CREATE POLICY "Shop owners can view own import logs" ON product_import_logs
  FOR SELECT
  USING (
    shop_id IN (
      SELECT id FROM public.shops WHERE user_id::text = (SELECT auth.uid())::text
    )
  );
