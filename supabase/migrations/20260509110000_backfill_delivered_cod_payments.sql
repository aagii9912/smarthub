-- =====================================================================
-- Аль хэдийн 'delivered' болсон COD захиалгуудын payment_status-ийг
-- буцаан 'paid' болгох (one-shot backfill).
-- =====================================================================
-- 20260509100000_cash_on_delivery.sql migration нь шинэ захиалгуудад
-- COD flow-ийг идэвхжүүлсэн боловч аль хэдийн delivered болсон захиалга-
-- уудын payment_status-ийг buцаан "paid" болгож амжаагүй (триггер нь
-- зөвхөн status өөрчлөгдөх МӨЧИД ажилладаг).
--
-- Тиймээс хүргэгдсэн захиалгуудыг "төлөгдсөн" гэж тэмдэглэнэ:
--   - status = 'delivered'
--   - payment_method ∈ ('cod', NULL) — QPay/bank-ийг хөндөхгүй
--   - payment_status ≠ 'paid'
-- =====================================================================

UPDATE orders
SET
    payment_status = 'paid',
    paid_at = COALESCE(paid_at, updated_at, created_at, NOW()),
    delivered_at = COALESCE(delivered_at, updated_at, created_at, NOW())
WHERE status = 'delivered'::order_status
  AND COALESCE(payment_method, 'cod') = 'cod'
  AND COALESCE(payment_status, 'pending') <> 'paid';

-- Хамаарах payments хүснэгтийн pending COD бичлэгүүдийг paid болгох
UPDATE payments p
SET
    status = 'paid'::payment_status,
    paid_at = COALESCE(p.paid_at, NOW())
FROM orders o
WHERE p.order_id = o.id
  AND o.status = 'delivered'::order_status
  AND COALESCE(o.payment_method, 'cod') = 'cod'
  AND p.status = 'pending'::payment_status;

SELECT 'Historical delivered COD orders backfilled to paid ✅' as result;
