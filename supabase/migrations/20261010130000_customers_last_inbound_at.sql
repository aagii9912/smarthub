-- customers.last_inbound_at — үйлчлүүлэгч хамгийн сүүлд ӨӨРӨӨ DM/postback
-- илгээсэн хугацаа.
--
-- Meta-гийн 24 цагийн мессежийн цонхыг тооцоход зориулав. `last_contact_at`
-- нь эзний гар хариулт (chat_history.message = '') болон comment-ийн мөрөөр
-- ч шинэчлэгддэг тул цонх тооцоход найдваргүй. Operator runtime-ийн deliver()
-- энэ баганаар "энгийн мессеж / Utility Message / эзэнд даалгавар" сонгоно.
--
-- Тэмдэглэл: process-messages cron-оор batch хийгдсэн мессеж cron ажилласан
-- цагаар бичигддэг тул энэ утга бодит цагаас хожуу байж болно. deliver() нь
-- Meta-гийн цонхны алдааг барьж эзэнд даалгавар болгон буцдаг тул аюулгүй.
--
-- Idempotent: дахин ажиллуулахад аюулгүй.

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_shop_last_inbound
  ON public.customers (shop_id, last_inbound_at);

CREATE OR REPLACE FUNCTION public.update_customer_last_inbound()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_at TIMESTAMPTZ := COALESCE(NEW.created_at, now());
BEGIN
    IF NEW.customer_id IS NOT NULL
       AND NEW.message IS NOT NULL
       AND NEW.message <> ''
       AND NEW.message NOT LIKE '[FB Comment]%'
       AND NEW.message NOT LIKE '[IG Comment]%' THEN
        UPDATE public.customers
           SET last_inbound_at = GREATEST(COALESCE(last_inbound_at, v_at), v_at)
         WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_last_inbound ON public.chat_history;
CREATE TRIGGER trigger_update_last_inbound
    AFTER INSERT ON public.chat_history
    FOR EACH ROW
    EXECUTE FUNCTION public.update_customer_last_inbound();

-- Backfill: одоо байгаа chat_history-оос
UPDATE public.customers c
   SET last_inbound_at = h.last_at
  FROM (
    SELECT customer_id, MAX(created_at) AS last_at
      FROM public.chat_history
     WHERE customer_id IS NOT NULL
       AND message IS NOT NULL
       AND message <> ''
       AND message NOT LIKE '[FB Comment]%'
       AND message NOT LIKE '[IG Comment]%'
     GROUP BY customer_id
  ) h
 WHERE c.id = h.customer_id
   AND c.last_inbound_at IS NULL;

-- Verify after applying:
--   SELECT count(*) FILTER (WHERE last_inbound_at IS NOT NULL) FROM public.customers;
--   INSERT INTO public.chat_history (shop_id, customer_id, message, response)
--     VALUES ('<shop>', '<customer>', 'test', NULL);  -- → last_inbound_at ≈ now()
