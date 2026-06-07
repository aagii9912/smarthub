# Unified Agent Garden Architecture (A + B нэгтгэсэн)

> **Статус:** Батлагдсан дизайн шийдвэр · **Огноо:** 2026-06-07
> **Шийдвэр гаргагч:** эзэмшигч · **Бичсэн:** дүн шинжилгээний дараа
> **Хамрах хүрээ:** Syncly → Agent Garden super-app-ийн архитектурын суурь.

---

## 0. Юуны тухай вэ

Agent Garden plan дотор **хоёр архитектур** зэрэгцэн бичигдсэн байсан:

- **A — Conversational Super-App:** ганц чат бүх үйлдлийг жолооддог, provider-agnostic (Claude/GPT/Gemini), subagent-ууд үл харагдах orchestration. Хүснэгт: `assistant_threads/messages/tool_calls/confirmations`, `shop_assistant_memory`.
- **B — Agent Garden каталог + Widget самбар:** app-store маягийн toggle-доход agent каталог + drag-drop widget dashboard + автономо multi-agent runtime (event/schedule/manual trigger, dispatcher). Хүснэгт: `shop_agents`, `agent_runs`, `shop_dashboard_layouts`.

Энэ баримт нь хоёрыг **нэг архитектур** руу нэгтгэсэн эцсийн шийдвэрийг тогтооно.

---

## 1. Гол зарчим: 2 орц, 1 дундын цөм

A, B нь зөрчилддөггүй — нэг систем рүү орох **хоёр хаалга**. Чат бол dispatcher-ийн `trigger_kind='chat'` хувилбар.

```
ОРЦ 1 — Чат (A):     POST /api/dashboard/assistant   → AssistantRouter (orchestrator)
ОРЦ 2 — Автомат (B): cron + webhook + "Run now"      → dispatcher
                          │  хоёулаа ижил цөмийг дуудна  │
        ┌──────────────────────────────────────────────────────┐
        │  ДУНДЫН ЦӨМ                                           │
        │  • Agent registry (10 agent: tools, plan, trigger)   │
        │  • Tool registry (~85-99 AssistantTool, ctx.shopId)  │
        │  • Model layer (src/lib/llm: provider-agnostic)      │
        │  • shop_agents (enable / config / plan-gate)         │
        │  • Credit metering (provider/model-aware)            │
        └──────────────────────────────────────────────────────┘
                          │  бүгд нэг ledger руу бичнэ  │
        agent_runs (run-level)  ←──  assistant_tool_calls (tool-level, undo)
                          │  UI consumer  │
        Чат (inline widget)   +   Widget самбар (dnd-kit)   +   Agent observability
```

---

## 2. Нэгтгэлийн шийдвэрүүд

| Бүрэлдэхүүн | Шийдвэр | Шалтгаан |
|---|---|---|
| `assistant_threads / messages` (A) | **Үлдэнэ** | Чат түүх |
| `assistant_confirmations` (A) | **Үлдэнэ** | Destructive батлуулалт |
| `shop_assistant_memory` (A) | **Үлдэнэ** | Сурдаг facts |
| `shop_agents` (B) | **Үлдэнэ** | Enable/config/plan-gate; автономо agent-д заавал |
| `agent_runs` (B) + `assistant_tool_calls` (A) | **НЭГДЭНЭ** (parent-child, §4) | Хоёулаа audit — түвшин нь л өөр |
| `shop_dashboard_layouts` + `@dnd-kit` widget board (B) | **ҮЛДЭНЭ (Phase 2)** | Эх vision-д чухал. Чаттай зэрэгцэн явна. Widget registry-г чат inline + board хоёулаа дуудна |
| Widget **registry** | **Үлдэнэ — давхар хэрэглэгчтэй** | Нэг registry → (1) чатад inline render, (2) board дээр card |
| `/dashboard/agents` каталог UI (B) | **Бууруулна** | Primary биш — "agent тохиргоо + run history" observability болно |
| `ProductAgentDefinition` (B) + `assistant-roles` (A) | **Нэг registry** | Ижил концепц, давхардуулахгүй |
| `dispatcher` (B) + `AssistantRouter` (A) | **Хоёулаа үлдэнэ** | Хоёр орц, нэг цөм дээр |

**Цэвэр үр дүн:** 8 core хүснэгт + `expenses` (Phase 4) + 2 ALTER. Widget board хадгалагдсан тул `@dnd-kit` дахин орно.

---

## 3. Эцсийн хүснэгтийн жагсаалт

| # | Хүснэгт | Эх | Фаз | Тэмдэглэл |
|---|---|---|---|---|
| 1 | `assistant_threads` | A | 0 | нэг shop-д олон чат thread |
| 2 | `assistant_messages` | A | 0 | role, content, widget, attachments, provider/model/credit |
| 3 | `agent_runs` *(нэгдсэн)* | A⊕B | 0 | `trigger_kind`-д `chat` нэмсэн; `thread_id NULL`, `provider/model/credit` талбартай |
| 4 | `assistant_tool_calls` | A⊕B | 0 | `agent_run_id` FK (заавал), `thread_id NULL` (автономо), `reverse_payload` undo |
| 5 | `assistant_confirmations` | A | 0 | TTL 5 мин |
| 6 | `shop_agents` | B | 0 | enable/config/metrics/status; `UNIQUE(shop_id, agent_slug)` |
| 7 | `shop_assistant_memory` | A | 0 | facts + agent_memory JSONB |
| 8 | `shop_dashboard_layouts` | B | 2 | widget board layout JSONB; `UNIQUE(shop_id, user_id)` |
| 9 | `expenses` | new | 4 | accounting agent-д |
| — | `ALTER shops: assistant_quick_actions, assistant_model_pref` | A | 0 | |

**RLS:** бүгд owner-only (`shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid())`). Dispatcher service-role-оор bypass хийж `shop_id` scoping-ийг **handler өөрөө** хийнэ.
**Storage:** `assistant-uploads` private bucket (signed URL) — эзний хувийн файл.

---

## 4. Нэгдсэн audit ledger (гол шийдвэр)

`agent_runs` болон `assistant_tool_calls` нь давхардал биш — **түвшин нь өөр**. Parent-child болгоно:

```sql
-- agent_runs = БҮХ agent ажиллагааны нэгдсэн "run" бүртгэл (чат + cron + event + manual)
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  agent_slug TEXT NOT NULL,
  trigger_kind TEXT NOT NULL CHECK(trigger_kind IN ('chat','schedule','event','manual')),
  trigger_ref TEXT,
  thread_id UUID NULL REFERENCES assistant_threads(id) ON DELETE SET NULL, -- чат бол thread, автономо бол NULL
  status TEXT CHECK(status IN ('running','success','skipped','failed')),
  summary TEXT,
  tokens_used INT,
  credit_cost INT,
  provider TEXT,                  -- 'google'|'anthropic'|'openai'
  model TEXT,
  metrics JSONB,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX idx_runs_shop_recent ON agent_runs(shop_id, agent_slug, started_at DESC);

-- assistant_tool_calls = тухайн run доторх tool бүрийн нарийн бүртгэл (undo/confirm)
CREATE TABLE assistant_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,  -- заавал parent
  thread_id UUID NULL REFERENCES assistant_threads(id) ON DELETE CASCADE,  -- NULLABLE (автономо)
  message_id UUID REFERENCES assistant_messages(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  agent_slug TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  args JSONB,                     -- LLM-supplied args (shop_id-гүй)
  status TEXT CHECK(status IN ('pending_confirm','running','success','failed','rejected','expired')),
  result JSONB,
  error TEXT,
  reverse_payload JSONB,          -- undo
  undo_expires_at TIMESTAMPTZ,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tc_run ON assistant_tool_calls(agent_run_id);
CREATE INDEX idx_tc_shop_recent ON assistant_tool_calls(shop_id, created_at DESC);
```

**Үр дүн:** Ганц "Activity / Audit" feed = `agent_runs`-ийг query → доош `assistant_tool_calls` руу drill-down. "Шөнө AI юу хийсэн" (cron) ба "чатаар би юу хийлгэсэн" хоёр нэг урсгалд. Undo нь автономо ажилд ч ажиллана.

---

## 5. Модуль бүтэц (давхардалгүй)

```
src/lib/llm/            ← Model давхарга: providers, model-registry, model-router, stream, complete, credit
                          (Vercel AI SDK; @ai-sdk/google + @ai-sdk/anthropic + @ai-sdk/openai)
src/lib/agents-product/ ← НЭГ agent registry: types, registry(10 agent), dispatcher (автономо орц), handlers/*
src/lib/assistant/      ← Чат орц: AssistantRouter, intent-classifier, confirmation-gate, widget-spec
src/lib/assistant/tools/← НЭГ tool registry (~85-99 AssistantTool) — хоёр орц хоёулаа дуудна
src/lib/widgets/        ← Widget registry (давхар хэрэглэгч: чат inline + board card)

src/app/api/dashboard/assistant/{route,confirm,threads,upload}/route.ts  ← чат endpoint
src/app/api/cron/agent-scheduler/route.ts                                ← автономо cron (CRON_SECRET)
src/app/api/dashboard/agents/[slug]/{route,run,runs}/route.ts            ← каталог CRUD + Run now
src/app/api/dashboard/layout/route.ts                                    ← widget board layout

src/app/dashboard/page.tsx          ← чат (primary, Phase 6-д шилжинэ)
src/app/dashboard/agents/[slug]/    ← agent тохиргоо + run history (observability)
src/app/dashboard/legacy/           ← хуучин тогтсон dashboard (fallback)
src/components/assistant/*          ← ChatThread, ChatInput(attach), AgentRail, WidgetRenderer, ConfirmationCard, UndoBar
src/components/widgets/*            ← WidgetGrid (dnd-kit), widget card-ууд
```

---

## 6. Widget registry — давхар хэрэглэгч

Нэг `WidgetDefinition` registry хоёр газар үйлчилнэ:

1. **Чат inline:** AI tool result-д `render: WidgetSpec` буцаавал `WidgetRenderer` тухайн widget-ийг чат дотор зурна.
2. **Widget самбар (dnd-kit):** `/dashboard` (эсвэл legacy) дээр хэрэглэгч өөрийн widget-ээ байрлуулна (`shop_dashboard_layouts`).

```ts
WidgetDefinition {
  type, label: LocalizedString, component, dataHook?,
  defaultSize: {w,h}, requiredFeature?, ownerAgent?   // ownerAgent enabled үед л харагдана
}
```

Core widget = одоогийн компонент (KPI, ChartBar, Sparkline, SmartInsights, RevenueStats, BestSellersTable, ...).
Agent widget = `ownerAgent`-тэй (`agent.accounting.pnl`, `agent.inventory.lowStock`, `agent.crm.vipLeads`, ...) — тухайн agent `shop_agents`-д enabled үед л board/чатад гарна.

---

## 7. Шинэчилсэн ажлын дараалал

| Фаз | Агуулга | Гол тэмдэглэл |
|---|---|---|
| **0 — Суурь** | 8 хүснэгт migration (`shop_dashboard_layouts` Phase 2-д хойшилж болно) + RLS + `assistant-uploads` bucket + features `agent_*` keys + dep install + `src/lib/llm` scaffold + НЭГ agent+tool registry + `requireOwnerOfShop` + chatbot/comment-ийг `shop_agents`-д backfill + provider fallback unit test | webhook хөндөхгүй |
| **1 — Чат read MVP** | AssistantRouter + `@ai-sdk/react useChat` UI + read tools (~35) + inline widget + model-router. `/dashboard/agents` = тохиргоо + run history | legacy dashboard хэвээр |
| **2 — Write+Confirm+Undo  ⊕  Widget board** | (2a) ~25 write tool + `assistant_confirmations` + reverse_payload undo + Activity feed. (2b) `@dnd-kit` + `shop_dashboard_layouts` + layout API + edit mode + default layout enabled agent-аас | 2a/2b параллель боломжтой |
| **3 — Destructive + Specialization** | ~15 destructive + double-confirm + 10 agent role + agent rail + @mention/slash + dispatcher "Run now" (manual орц) | dispatcher manual-аар амьдарна |
| **4 — Автономо runtime + шинэ agent** | cron `agent-scheduler` → `dispatchSchedule` (agent_runs autonomous) + accounting(`expenses`)/analyst deterministic (0 token) + ticketing (QR) | B-ийн cron/dispatcher бүрэн амьдарна |
| **5 — Boost + Voice + Multimodal гүн** | Meta Ads (бүрэн шинэ) + voice + PDF native/Excel bulk import | Хамгийн эрсдэлтэй, сүүлд |
| **6 — Чат = primary** | `/dashboard` → чат; хуучин → `/dashboard/legacy` (widget board энд) | |
| **7+ — Polish** | memory inject + mobile/PWA + performance audit | |

---

## 8. Одоогийн кодын бэлэн байдал (2026-06 шалгасан)

| Давхарга | Бэлэн % | Нотолгоо |
|---|---:|---|
| Model давхарга `src/lib/llm/` | ~25% | `ai@6.0.33` + `@ai-sdk/openai@3.0.9` суусан ч **0 import (ghost dep)**; `streamText` хаана ч алга |
| LLM tool engine reuse | ~70% | `AIRouter.ts` (797), `ToolExecutor.ts` (189), 19 customer tool, GeminiProvider production-д |
| Vision (бараа/баримт OCR) | ~80% | `analyzeProductImageWithPlan` webhook+cron+AIRouter-т ажиллаж байна |
| Файл задлал | ~60% | `file-parser.ts`: Excel + docx бэлэн; **PDF parse алга** |
| Read-tool backend | ~75% | `/api/dashboard/`: orders/products/customers/conversations/complaints/reports/stats/ai-stats/export бэлэн |
| Шинэ дата схем | 0% | бүх хүснэгт байхгүй |
| Plan gating | ~50% | useFeatures/FeatureGate бэлэн; `agent_*` keys алга |
| Streaming chat UI | ~15% | ChatInput attach placeholder хоосон; `@ai-sdk/react` алга |
| Widget board | ~30% | компонент бэлэн; `@dnd-kit` алга, layout API алга |
| Boost / Meta Ads | ~0% | бүрэн шинэ |

**Суулгах dependency:** `@ai-sdk/google`, `@ai-sdk/anthropic`, `@ai-sdk/react`, `@dnd-kit/core`, `@dnd-kit/sortable`, `browser-image-compression`.
**ENV:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (`GEMINI_API_KEY` бэлэн).

---

## 9. Нээлттэй / батлах шийдвэрүүд

1. ✅ `agent_runs` = бүх ажиллагааны нэгдсэн ledger; `assistant_tool_calls` нь child.
2. ✅ Widget board **хадгалагдана** (Phase 2, чаттай зэрэгцэн).
3. ✅ `/dashboard/agents` каталог = "тохиргоо + observability" (primary биш).
4. ✅ Нэг agent registry + нэг tool registry; хоёр орц хоёулаа дуудна.
5. ✅ Хоёр орц (AssistantRouter + dispatcher) нэг цөм дээр.
6. ⬜ Widget board хаана амьдрах: `/dashboard` доторх "Самбар" tab уу, эсвэл `/dashboard/legacy` уу? (Phase 2/6-д шийднэ.)
7. ⬜ Zod v4 + AI SDK v6 tool-calling нийцлийг эхний provider E2E-ээр батлах.
