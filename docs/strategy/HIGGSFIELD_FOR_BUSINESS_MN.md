# Syncly — «Бизнесийн Higgsfield»

> **Стратеги блупринт.** Syncly-г Монголын жижиг бизнесийн **AI оффис** болгох — нэг чатнаас удирддаг, AI ажилтнуудтай, Facebook/Instagram-аас ангид жинхэнэ business-operations super-app.
> **Огноо:** 2026-06-07 · **Хэл:** Монгол · **Төрөл:** Vision/стратеги (код биш)
> **Холбоос:** [Unified Architecture](../architecture/UNIFIED_AGENT_GARDEN_ARCHITECTURE.md) · [Бизнес загвар & Agent-ууд](../business/AGENT_GARDEN_BIZNES_BA_AGENTUUD_MN.md)

---

## 1. Vision — нэг өгүүлбэрээр

> **«Higgsfield бол креатив контентын supercomputer. Syncly бол Монголын жижиг бизнесийн AI оффис.»**

Бизнес эрхлэгч **ганц чаттай** ярилцана. Цаана нь **AI ажилтнууд** (Нягтлан, Борлуулагч, Агуулах, Аналист…) түүний өдөр тутмын ажлыг хийнэ. Хамгийн тохирох загвар (Gemini/Claude/GPT) автоматаар ажиллаж, хийсэн ажлаар нь **нэгж** тооцно. **Facebook/Instagram бол зөвхөн нэг суваг** — банк, ebarimt, QPay, Google, Telegram, вэб зэрэг олон connector-оор бизнесийн **бүх үйл ажиллагааг** хамарна.

**Higgsfield-аас юу авч байна (mental model):**

| Higgsfield | Syncly дахь хувилбар |
|---|---|
| Supercomputer chat | Нэг чат — бүх ажлын орц |
| Orchestrator (загвар сонгох) | AI Туслах + олон загварын router |
| **My Office** (Employees/Skills/Connectors/Memory) | **Минийн оффис** — AI ажилтнууд + чадвар + холболт + санах ой |
| Employees | **AI ажилтнууд** (10 specialist) |
| Skills (install хийдэг workflow) | **Чадвар** — багцалсан олон-алхамт ажил, slash command |
| Connectors (40+ tool) | **Холболтууд** — FB/IG-ээс гадуурх интеграц |
| 3-layer Memory | 3-давхар санах ой (одоо/бренд/туршлага) |
| Tasks (async) | **Даалгаврууд** — урт ажил background-д |
| Marketplace | **Зах** — бэлэн ажилтан/чадвар суулгах |

---

## 2. Хийгдэх боломжтой юу? — Feasibility & нотолгоо

«Бизнесийн AI ажилтан» бол 2026 оны **батлагдсан, хөрөнгөжсөн категори**. Энэ vision зохиомол биш — олон тоглогч аль хэдийн хийж байна:

| Платформ | Юу хийдэг | Syncly-д ач холбогдол |
|---|---|---|
| **Lindy** | "AI employee" — имэйл, цаг товлолт, CRM, support автоматжуулна | «AI ажилтан» framing бодитой |
| **Salesforce Agentforce** | CRM дата дээр автономо agent, enterprise governance | Дата дээр аюулгүй ажиллах загвар |
| **Manus** | Гүн судалгаа/синтезийн autonomous agent | Multi-step reasoning боломжтой |
| **Higgsfield (Hermes Agent)** | Function-calling orchestrator, recursive tool-use, reasoning нуугдмал, cloud scale | Манай орчестрацийн загвар |

**Техникийн суурь шийдэгдсэн:**
- **Олон загвар (multi-model):** OpenRouter / Vercel AI Gateway — нэг API-аар 300+ загвар, routing/fallback/cost-control. *(Caveat: OpenRouter scale дээр markup + 25–40ms latency нэмдэг → бид **direct `@ai-sdk/*` provider** буюу Vercel AI Gateway руу хазайна.)*
- **Connectors:** Composio — 1000+ toolkit, 20,000+ tool, MCP/API, auth удирдлага, SOC2/ISO. **Global** connector-ыг бэлнээр авна.
- **SMB бодит ROI:** дунджаар $200–500/сар = 2–3 ажилтны орон; Stripe/Shopify/calendar/email-тэй холбогдсон agent **7 хоногт 12+ цаг** хэмнэдэг. Нягтлан (reconcile/P&L/нэхэмжлэх), агуулах (forecast/reorder), цаг товлолт, маркетинг — хамгийн их автоматжсан ажлууд.

**Дүгнэлт:** ✅ Бүрэн боломжтой, precedent олон. **Ялгарал нь технологи биш — локалчлал.** Higgsfield = креатив; Lindy/Agentforce = US enterprise. **Монгол SME-д зориулсан босоо AI оффисыг хэн ч хийгээгүй.**

> **Эх сурвалж:** [Lindy AI review](https://rimo.app/en/blogs/lindy-ai-review_en-US) · [Agentforce](https://www.salesforce.com/agentforce/) · [Higgsfield Hermes архитектур](https://explainx.ai/blog/higgsfield-ai-supercomputer-hermes-agent-2026) · [OpenRouter × Vercel AI SDK](https://openrouter.ai/docs/guides/community/vercel-ai-sdk) · [Composio toolkits](https://composio.dev/toolkits) · [Claude for Small Business](https://www.eigent.ai/blog/claude-for-small-business)

---

## 3. Архитектур — 7 давхарга

```
┌──────────────────────────────────────────────────────────────┐
│   ЭЗЭН  —  нэг чат (browser + Telegram/Messenger control)     │
└───────────────────────────┬──────────────────────────────────┘
                            ▼
   ① ORCHESTRATOR (AI Туслах) — intent → ажилтан сонгох →
      multi-step tool-use → батлуулах → нэгж тооцох → stream
                            ▼
   ② EMPLOYEES — 10 AI ажилтан        ③ MODELS — Gemini/Claude/GPT
      (tool whitelist + дүр)             (auto-route эсвэл сонгох)
                            ▼
   ④ SKILLS — багцалсан workflow (/сарын-хаалт, /live-дараа…)
                            ▼
   ⑤ TOOLS (~99) + ⑥ CONNECTORS (банк/ebarimt/QPay/Google/
      Telegram/SMS/вэб/Excel)
                            ▼
   ⑦ MEMORY (3-давхар) ──── TASKS (async queue) ──── MARKETPLACE
                            ▼
        SUPABASE (RLS, multi-tenant, audit ledger)
```

> Энэ нь [Unified Architecture](../architecture/UNIFIED_AGENT_GARDEN_ARCHITECTURE.md)-ийн «2 орц / 1 цөм»-ийг Higgsfield-ийн линзээр баяжуулсан хувилбар: чат орц = Orchestrator, автомат орц = dispatcher/Tasks.

---

## 4. AI ажилтнууд — юу хийх / юу хийж чадах (гүн)

Ажилтан бүр: **үүрэг · юу хийдэг · Монголд заавал · холбогдох connector · нэгж · trigger.**

### 💰 Орлого үүсгэгч баг

**1. AI Борлуулагч** — Messenger/IG/**Telegram/вэб чат** дээр борлуулалт.
- Захиалга авах, бараа санал, нөөц шалгах, upsell, "+1/авлаа/размер" ойлгох.
- *Connector:* Telegram, вэб chat widget · *Нэгж:* бага · *Trigger:* мессеж.

**2. AI Сэтгэгдэл & Live** — FB/IG коммент + **Live "+1" бодит цагт** захиалга.
- Постын олон зуун комментыг ялган DM руу; Live худалдааны нэр+тоо барих.
- *Нэгж:* бага · *Trigger:* comment/live.

**3. AI Төлбөр & Хүргэлт** — баримт танилт + хүргэлт зохицуулалт.
- **Банкны баримт OCR** (Хаан/ХХБ/Голомт/Хас/Төрийн), QPay verify, **бэлэн мөнгө (COD)**, дүүрэг/хороо/тоот хүргэлтийн тооцоо, түгээгчид дамжуулах.
- *Connector:* банкны хуулга, QPay, газрын зураг · *Нэгж:* дунд (OCR vision) · *Trigger:* payment, чат.

**4. AI Харилцагч (CRM)** — давтан худалдаа + win-back.
- VIP таних, сегмент, идэвхгүйг буцаах, broadcast (**SMS/Viber/имэйл-ээр ч**), утасны дугаараар нэгтгэх, Meta 24ц дүрэм.
- *Connector:* SMS/Viber, Gmail/Resend · *Нэгж:* дунд · *Trigger:* захиалга, schedule, чат.

### 🧲 Ажил хөнгөлөгч баг (0 нэгж — deterministic)

**5. AI Нягтлан бодогч** — санхүү автоматжуулалт.
- P&L, зарлага ангилал, **НӨАТ 10% / ebarimt (и-баримт)**, **НДШ**, цалин бэлтгэл, нягтланд export packet, импортын COGS + ханш.
- *Connector:* ebarimt, банкны хуулга, Google Sheets/Excel · *Нэгж:* **0** · *Trigger:* schedule, payment, чат.

**6. AI Агуулах** — бараа + нөөц.
- Зураг→бараа авто-бүртгэл, variant (размер/өнгө), нөөц зөрүү, бага-нөөц таамаг, reorder, импортын эх үүсвэр.
- *Connector:* Excel/CSV bulk, нийлүүлэгчийн Sheets · *Нэгж:* дунд (vision) · *Trigger:* schedule, захиалга, чат.

**7. AI Бизнес аналист** — insight + тайлан.
- Өдөр/7-хоног тайлан, "яагаад буурав", **Цагаан сар/наадам/цалингийн** улирлын мэдрэмж, KPI.
- *Connector:* Sheets export, push · *Нэгж:* бага · *Trigger:* schedule, чат.

**8. AI Boost оновчлогч** — зар/сурталчилгаа.
- FB/IG зарын winner сонгох, ROAS, ₮ төсөв зөвлөх, монгол creative/зар бичвэр.
- *Connector:* Meta Ads API · *Нэгж:* өндөр (creative) · *Trigger:* schedule, чат.

### 🎟️ Вертикал + ирээдүй (connector-оор нээгдэх шинэ зах зээл)

**9. AI Тасалбар & Эвент** — концерт/эвент/театр, QR check-in, борлуулалтын самбар.
- *Connector:* QPay, Calendar · *Нэгж:* 0 · *Trigger:* чат, check-in.

**10. AI Туслах (Orchestrator)** — зөв ажилтан руу чиглүүлэх, multi-step, батлуулах, загвар сонгох.

**(+ ирээдүй) AI Цаг товлогч / Ресепшн** — **Google Calendar-аар цаг захиалга** (салон/эмнэлэг/засвар/үйлчилгээ). **FB/IG-ээс ангид шинэ зах зээл** — социал биш, үйлчилгээний бизнес.

---

## 5. Connectors layer — «FB/IG-ээс гарах» гол ажил

Шинэ интеграц framework: OAuth/credential хадгалалт + per-connector adapter + tool болгож гаргах. **4 багц, эрэмбэтэйгээр:**

### Эрэмбэ 1 — 🇲🇳 Монгол санхүү (moat, native build)
> Composio-д **байхгүй** тул native бүтээнэ — энэ нь хэн ч давтаж чадахгүй давуу тал.
- **ebarimt / И-баримт** — НӨАТ, баримтын систем.
- **Банкны хуулга** — Хаан/ХХБ/Голомт/Хас… statement import + баримт OCR.
- **QPay** — гүнзгийрүүлсэн баталгаажуулалт.
- ⚠️ **Эрсдэл:** ebarimt/банкны public API хязгаарлагдмал байж болзошгүй → эхлээд **screenshot OCR + statement upload (CSV/PDF)**-аар ажиллаад, дараа нь **API/түншлэлээр** гүнзгийрүүлнэ. *(Эрх зүй/түншлэлийн хамаарал — эрт тодруулах.)*

### Эрэмбэ 2 — Google (хурдан, Composio/OAuth)
- **Sheets** — бараа/захиалга sync, тайлан export.
- **Calendar** — цаг товлолт (AI Цаг товлогч-ийн суурь).
- **Gmail** — имэйл илгээх/унших.

### Эрэмбэ 3 — Мессеж
- **Telegram** — эзэн **өөрийн AI оффистой утсаараа** ярих (Higgsfield ч Telegram ашигладаг).
- **SMS / Viber** — харилцагчид мэдэгдэл/broadcast.

### Эрэмбэ 4 — Веб/дэлгүүр + Excel
- Өөрийн **storefront/чат widget** (FB/IG-гүй борлуулалт).
- **Excel/CSV bulk import** (40 бараа нэг дор).

> **Зарчим:** global connector (Slack/Notion/Drive)-ыг **Composio/MCP**-ээр хямд; Монгол-онцлогийг **native**.

---

## 6. Skills (Чадвар) — багцалсан workflow + slash command

Skill = захиалсан tool дараалал + prompt. Нэг удаа заагаад дахин дуудна (Higgsfield-ийн "teach once" загвар). Жишээ:

| Slash | Юу хийх (дараалал) |
|---|---|
| `/сарын-хаалт` | төлбөр reconcile → P&L → НӨАТ тооцоо → нягтланд export packet |
| `/live-дараа` | "+1" цуглуулах → захиалга үүсгэх → төлбөр хүсэх → нөөц шинэчлэх |
| `/буцаах-кампанит` | идэвхгүй сегмент → win-back мессеж зурах → broadcast (cap) → үр дүн хянах |
| `/шинэ-бараа` | зураг→бараа → үнэ тогтоох → FB пост draft → boost санал |
| `/өдрийн-тайлан` | өдрийн борлуулалт + KPI + insight + push |

Marketplace-аас Skill суулгаж болно; бизнес өөрийн workflow-оо "заах" боломжтой.

---

## 7. Memory — 3 давхар (Higgsfield-ийн загвараар)

| Давхарга | Агуулга | Syncly-д |
|---|---|---|
| **Working** (одоо) | Идэвхтэй thread/task-ийн scratchpad | `assistant_messages` + түр санах ой |
| **Library (бренд)** | Эзний нэр, банк, өнгө/tone, оргил цаг, бренд хоолой | `shop_assistant_memory.facts` |
| **Episodic (юу амжилттай болсон)** | Амжилттай workflow/tool trace → **ялсан параметрийг дахин ашиглах** (хамгийн үр дүнтэй boost төсөв, win-back мессеж) | `agent_runs` өргөтгөх / шинэ `assistant_memory_episodes` |

Episodic давхарга нь **чанар + retention**-ийг нэмнэ: AI өмнө нь юу амжилттай болсныг санаж, дараагийн удаа эхний оролдлогоор зөв хийнэ.

---

## 8. Tasks · Multi-interface · Marketplace

- **Tasks (async):** урт ажил (broadcast, bulk import, сарын хаалт, creative batch) — **Upstash queue + worker endpoint**-оор Vercel 60s timeout-ийг тойрно. UI-д "Даалгаврууд" жагсаалт (running/done) + human-in-the-loop баталгаа.
- **Multi-interface:** browser primary + **Telegram/Messenger-ээр эзэн өөрийн оффистой** ярих control channel (гар утсаар хаанаас ч).
- **Marketplace (Зах):** бэлэн багц суулгах — **"Дэлгүүрийн багц"** (Борлуулагч+Агуулах+Төлбөр), **"Үйлчилгээний багц"** (Цаг товлогч+CRM), **"Ресторан"**, **"Эвент зохион байгуулагч"**. Монетизаци + discoverability.

---

## 9. Gap analysis + Roadmap

### Одоогийн код vs шинэ
**Байгаа (reuse):** FB/IG Meta Graph, QPay (дутуу), Resend (хагас), Web Push, Supabase, Gemini, `ai@6.0.33`+`@ai-sdk/openai` (ghost dep), `AIRouter`/`ToolExecutor` + ~19 tool, `analyzeProductImageWithPlan` (vision), `file-parser` (Excel/docx).
**Шинэ давхарга:** `src/lib/llm/` (multi-model), Office/Employees UI, **`src/lib/connectors/`** (хамгийн том net-new), Skills engine, 3-давхар memory, Tasks/queue, Marketplace.

### Roadmap (Unified Arch фаз + Higgsfield линз)
| Фаз | Агуулга |
|---|---|
| **P0–1** | chat-first + model layer + read employees |
| **P2** | write + confirm + undo + widget board |
| **P3** | Employees specialization + **Office UI** + **Skills v1** + **3-давхар memory** |
| **P4** | **Connectors framework** + Google (Sheets/Calendar/Gmail) + Excel + accounting/ticketing |
| **P5** | **Монгол санхүү connectors** (ebarimt/банк/QPay) + **Tasks/queue** + Boost (Meta Ads) |
| **P6** | **Marketplace** + multi-interface (Telegram/Messenger) + voice |
| **P7+** | polish + шинэ ажилтан (Цаг товлогч/HR) + нэмэлт connector |

---

## 10. Differentiation (moat) + Эрсдэл

### Moat — яагаад хэн ч давтаж чадахгүй
Локалчилсан босоо **AI оффис для Монгол SME**: ebarimt/НӨАТ, локал банкны баримт, QPay, FB Live худалдаа, дүүрэг/хороо хүргэлт, бэлэн мөнгө, монгол хэл/галиг, **нэгж prepaid** economics. Higgsfield/Lindy/Agentforce-д энэ бүгд **байхгүй**. → "Бизнесийн Higgsfield" = шинэ категори.

### Эрсдэл / caveats
| Эрсдэл | Шийдэл |
|---|---|
| Connector maintenance | Global = Composio (авто-maintain); Монгол = native + OCR/upload fallback |
| ebarimt/банк API хандалт | Эрх зүй/түншлэлийн хамаарал — **эрт тодруулах**; эхлээд OCR/upload |
| Vercel 60s timeout (урт task) | Upstash queue/worker заавал |
| Token/нэгж зардал (powerful загвар) | model-router + deterministic (0 нэгж) + cap (business model doc) |
| OpenRouter markup/latency | direct `@ai-sdk/*` эсвэл Vercel AI Gateway |
| Multi-tenant/security | confirmation gate, undo, `ctx.shopId` server-derive; connector credential тус тусд |

---

## 11. Дүгнэлт

1. **Vision хийгдэх боломжтой** — Lindy/Agentforce/Manus/Higgsfield нотолж байна; multi-model + connectors аль аль нь шийдэгдсэн асуудал.
2. **Syncly-ийн ялгарал технологи биш, локалчлал** — Монгол SME-ийн бодит ажлыг (санхүү/агуулах/борлуулалт/хүргэлт) хийдэг AI оффис.
3. **"FB/IG-ээс гарах" = Connectors layer** — энэ нь хамгийн том шинэ ажил бөгөөд хамгийн том moat.
4. Одоогийн Unified Architecture + business model дээр **80% бэлэн** — Higgsfield линз нь Employees/Office framing, Connectors, Skills, 3-давхар Memory, Tasks, Marketplace-ийг нэмж дуусгана.

> **Дараагийн алхам (санал):** энэ баримтыг **HTML deck** болгож хувиргах (өмнөх `agent-garden-business.html` стилээр), эсвэл **Connectors framework**-ийн техникийн дизайн (OAuth, credential storage, adapter interface) гаргах.
