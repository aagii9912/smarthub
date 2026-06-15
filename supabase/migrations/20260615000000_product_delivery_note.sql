-- Per-product хүргэлтийн хугацааны тайлбар.
-- Тухайн бараанд онцлох хүргэлтийн хугацаа (shop-level delivery_policy.delivery_schedule_note-оос дээгүүр).
-- IF NOT EXISTS тул аль ч орчинд аюулгүй, давтан ажиллуулж болно.

ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_note TEXT;

-- PostgREST schema cache-ийг шинэчилж PGRST204 алдаанаас сэргийлнэ
NOTIFY pgrst, 'reload schema';
