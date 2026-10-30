-- Operator runtime — идэвхтэй (proactive) агентуудын хамгийн бага суурь.
--
-- docs/architecture/UNIFIED_AGENT_GARDEN_ARCHITECTURE.md-ийн нэршлийг дагана:
--   shop_agents — дэлгүүр бүрийн асаасан automation, горим, тохиргоо
--   agent_runs  — нэг дор: ажлын дараалал + аудит лог + эзний зөвшөөрлийн inbox
--
-- agent_slug = '<pack>.<automation>' (жишээ: 'beauty.reminder_24h').
-- Automation-ы логик кодод (src/lib/operator/automations/); энд зөвхөн төлөв.
--
-- Давхардлаас хамгаалалт:
--   * idempotency_key UNIQUE — нэг subject-д нэг цонхонд нэг л run (ON CONFLICT DO NOTHING)
--   * claim_agent_runs() — FOR UPDATE SKIP LOCKED; хоёр cron tick зэрэг ажилласан ч
--     нэг run-ийг хоёр удаа авахгүй. 10 минутаас удаан 'running' байгаа (timeout-д
--     унасан) run-ийг дахин авна.
--
-- Бичих нь зөвхөн service role-оор (dispatcher, dashboard API). Эзэн уншина.
-- Idempotent.

-- ── shop_agents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  agent_slug TEXT NOT NULL
    CHECK (agent_slug ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  enabled BOOLEAN NOT NULL DEFAULT true,
  mode TEXT NOT NULL DEFAULT 'approve'
    CHECK (mode IN ('auto', 'approve')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, agent_slug)
);

CREATE INDEX IF NOT EXISTS idx_shop_agents_enabled_last_run
  ON public.shop_agents (last_run_at NULLS FIRST)
  WHERE enabled;

-- ── agent_runs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  agent_slug TEXT NOT NULL,
  trigger_kind TEXT NOT NULL
    CHECK (trigger_kind IN ('schedule', 'event', 'manual', 'chat')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'awaiting_approval', 'sent', 'skipped', 'failed', 'rejected')),
  subject_type TEXT,
  subject_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,
  attempts INT NOT NULL DEFAULT 0,
  tokens_used INT NOT NULL DEFAULT 0,
  credit_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  model TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_claimable
  ON public.agent_runs (scheduled_for)
  WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS idx_agent_runs_shop_created
  ON public.agent_runs (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_shop_awaiting
  ON public.agent_runs (shop_id)
  WHERE status = 'awaiting_approval';

-- ── updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_shop_agents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_agents_updated_at_trg ON public.shop_agents;
CREATE TRIGGER shop_agents_updated_at_trg
  BEFORE UPDATE ON public.shop_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_shop_agents_updated_at();

-- ── claim RPC ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_agent_runs(
  p_limit INT,
  p_stale_after INTERVAL DEFAULT INTERVAL '10 minutes'
)
RETURNS SETOF public.agent_runs
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.agent_runs r
     SET status = 'running',
         started_at = now(),
         attempts = r.attempts + 1
   WHERE r.id IN (
     SELECT q.id
       FROM public.agent_runs q
      WHERE (q.status = 'queued' AND q.scheduled_for <= now())
         OR (q.status = 'running' AND q.started_at < now() - p_stale_after)
      ORDER BY q.scheduled_for
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING r.*;
$$;

REVOKE ALL ON FUNCTION public.claim_agent_runs(INT, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_agent_runs(INT, INTERVAL) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_agent_runs(INT, INTERVAL) TO service_role;

-- ── RLS (shop team read-only) ───────────────────────────────────────
-- shops.user_id нь TEXT тул auth.uid()::text (20260617000000_salon_staff.sql-ийн хэв маяг)
ALTER TABLE public.shop_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop team reads own agents" ON public.shop_agents;
CREATE POLICY "Shop team reads own agents"
  ON public.shop_agents FOR SELECT
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()::text)
    OR shop_id IN (SELECT shop_id FROM public.shop_members WHERE user_id = auth.uid() AND status = 'active')
  );

DROP POLICY IF EXISTS "Shop team reads own agent runs" ON public.agent_runs;
CREATE POLICY "Shop team reads own agent runs"
  ON public.agent_runs FOR SELECT
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()::text)
    OR shop_id IN (SELECT shop_id FROM public.shop_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Verify after applying:
--   SELECT * FROM public.claim_agent_runs(5);   -- as service_role → [] on an empty table
--   INSERT INTO public.agent_runs (shop_id, agent_slug, trigger_kind, idempotency_key)
--     VALUES ('<shop>', 'beauty.reminder_24h', 'schedule', 'k1');
--   -- same key again → unique_violation (dispatcher uses ON CONFLICT DO NOTHING)
