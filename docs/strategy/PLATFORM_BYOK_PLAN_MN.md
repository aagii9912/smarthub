# platform.syncly.mn — Өөрийн AI түлхүүрээр (BYOK) Syncly-г үнэгүй ашиглах төлөвлөгөө

> Огноо: 2026-10-10 · Статус: Санал (батлагдаагүй)
> Хамрах хүрээ: Бүтээгдэхүүн, домэйн/routing, өгөгдлийн загвар, шифрлэлт, AI давхарга, billing, хууль, roadmap
> BYOK = Bring Your Own Key. Кодын баримт бүрийг 2026-10-10-нд шалгасан.

---

## 0. Шийдвэрийн мөр

**Санал:** `platform.syncly.mn` дээр хэрэглэгч **өөрийн OpenAI / Gemini / Claude API түлхүүрийг** оруулаад Syncly-ийн AI борлуулагч, inbox, CRM-ийг **Syncly-д AI-ийн төлбөр төлөхгүйгээр** ашиглана. AI-ийн зардлыг хэрэглэгч provider-тоо шууд төлнө.

**Яагаад:** Syncly-ийн хамгийн том хувьсах зардал бол AI token. BYOK хэрэглэгч дээр энэ зардал **бараг 0** болж, зөвхөн дэд бүтцийн (Vercel, Supabase, Redis, Meta webhook) зардал үлдэнэ. Хэрэглэгч татах (land-grab) үе шатанд хязгааргүй хэрэглээг эрсдэлгүйгээр өгөх боломж нээгдэнэ.

**Хэнд зориулсан:**
- Олон клиенттэй **маркетингийн агентлаг**, хөгжүүлэгч
- OpenAI/Google Cloud данс аль хэдийн байгаа бизнес
- Үнэгүй Lite-ийн 1,000 кредит хангалтгүй, гэхдээ сар бүр төлөхийг хүсэхгүй хэрэглэгч

**Шударга анхааруулга:** Монголын ихэнх жижиг бизнест олон улсын карт, OpenAI данс байхгүй. Тиймээс BYOK нь үндсэн бизнесийг **орлохгүй**, харин нэмэлт суваг болно. Gemini-ийн үнэгүй түлхүүр карт шаардахгүй тул "жинхэнэ үнэгүй" замыг нээдэг. Гэхдээ өгөгдлийн нөхцөл нь эрсдэлтэй (§5.1).

---

## 1. Одоогийн кодын бэлэн байдал

### 1.1 Аль хэдийн байгаа (дахин ашиглана)

| Зүйл | Байршил | BYOK-д хэрэглэх нь |
|---|---|---|
| Үнэгүй Lite tier (1M token ≈ 1,000 кредит) | `supabase/migrations/20260625120000_lite_free_freemium.sql`, `src/lib/ai/config/plans.ts:80` | BYOK бол Lite-ийн **token хязгааргүй** хувилбар. BYOK түлхүүр ажиллахгүй болбол Lite pool руу шилжиж болно (§2.4) |
| Plan тус бүрийн tool-ыг админ засах боломж | `plans.enabled_tools`, `AIRouter.ts:178-191` | `byok` plan-ий feature-ийг deploy хийлгүйгээр тохируулна |
| Хэрэглэгч бүрийн token pool + өдөр тутмын задаргаа | `src/lib/ai/tokenUsage.ts` → `increment_user_token_pool` RPC | BYOK үед pool-оос **хасахгүй**, зөвхөн аналитикт бүртгэнэ |
| Нийтийн API + `sk_live_` түлхүүр (hash-аар хадгалдаг) | `src/lib/api-keys/index.ts`, `api_keys` хүснэгт, `/api/v1/chat`, `src/components/settings/ApiKeysCard.tsx` | platform console-ийн "Syncly API" хэсэг рүү шилжүүлнэ (platform.openai.com-той ижил загвар) |
| Push / имэйл мэдэгдэл | `src/lib/notifications.ts`, Resend | Түлхүүр хүчингүй болсон, quota дууссан үед эзэнд мэдэгдэнэ |
| AI eval harness | `src/lib/ai/__tests__/eval-e2e.test.ts`, `evaluations/customer-handlers.xml` | Provider/model бүрийг "баталгаажсан" болгохын өмнө ажиллуулна |

### 1.2 Хаалт болж буй зүйлс (заавал засна)

| # | Асуудал | Нотолгоо |
|---|---|---|
| **B1** | **Нэг глобал AI client.** `getOpenAI()` нь `process.env.OPENAI_API_KEY`-ээр нэг удаа үүсгэгддэг singleton. Хүсэлт бүрт өөр түлхүүр ашиглах боломжгүй | `src/lib/ai/openaiClient.ts:31-38`, `providers/index.ts:21` |
| **B2** | **AI 7 газраас шууд дуудагддаг.** Бүгдэд нь credential дамжуулах шаардлагатай | `AIRouter.ts:448` (tool loop), `AIRouter.ts:733` (vision), `OpenAIProvider.ts:60, 213`, `services/ProductParser.ts`, `api/dashboard/ai-generate-instructions`, `api/dashboard/conversations/[customerId]/summary`. `api/leads/route.ts` нь landing-ийнх тул Syncly-ийн түлхүүрээр үлдэнэ |
| **B3** | **GPT-6 Luna-д зориулсан параметр хатуу бичигдсэн.** `reasoning_effort: 'none'`, `max_completion_tokens` гэж дамжуулдаг. Gemini-ийн OpenAI-compatible endpoint дээр reasoning-ийг `'none'` болгож унтраах нь зөвхөн 2.5 загварт ажилладаг, Gemini 3-т ажиллахгүй | `AIRouter.ts:456`, `OpenAIProvider.ts:63, 216` + Google docs (§8) |
| **B4** | **AI эрхийг зөвхөн plan-аар шалгадаг.** BYOK-ийн нөхцөл байхгүй | `src/lib/billing/isAiAuthorized.ts`. Дуудагддаг газар: `api/webhook/route.ts:548, 772`, `api/cron/process-messages` |
| **B5** | **Token хязгаар хатуу.** BYOK хэрэглэгч ч `limitReached`-д хүрнэ | `AIRouter.ts:213-245` (`checkTokenLimit`, `getUserBilling().tokensLimit`) |
| **B6** | **Нэрийн мөргөлдөөн.** "API key" гэдэг нь кодонд аль хэдийн **Syncly-ийн гаргадаг** `sk_live_` түлхүүрийг хэлж байна. BYOK түлхүүр огт өөр зүйл | `api_keys` хүснэгт, `src/lib/api-keys/` → шинэ хүснэгтийг **`ai_provider_credentials`** гэж нэрлэнэ. UI дээр "AI provider түлхүүр" ба "Syncly API түлхүүр" гэж тодорхой салгана |
| **B7** | **Шифрлэлтийн дэд бүтэц байхгүй.** Vault, pgsodium, `createCipheriv` 0 удаа хэрэглэгдсэн | grep 0 үр дүн |
| **B8** | **Session нь дэд домэйн хооронд хуваалцагдахгүй.** Supabase cookie-д `domain` тохируулаагүй (host-only) | `src/lib/supabase-{middleware,server,browser}.ts` |
| **B9** | **Middleware host-оор routing хийдэггүй** | `src/middleware.ts` |
| **B10** | **Sentry scrubbing байхгүй.** `beforeSend` тохируулаагүй тул алдааны payload-д түлхүүр орох эрсдэлтэй | `sentry.server.config.ts` |

---

## 2. Бүтээгдэхүүний тодорхойлолт

### 2.1 platform.syncly.mn юу вэ

**platform.openai.com-той ижил "хөгжүүлэгч / power user console".** Үндсэн апп (`www.syncly.mn/dashboard`) хэвээр үлдэнэ.

```
platform.syncly.mn
├── /                  Landing — "Өөрийн AI түлхүүрээр Syncly-г үнэгүй"
├── /login, /signup    Нэг account (www-тэй SSO)
├── /onboarding        5 алхамтай wizard (доор)
├── /keys              AI provider түлхүүрүүд — нэмэх, солих, устгах, төлөв
├── /usage             Token хэрэглээ: өдөр / feature / model, зардлын тооцоо ($ ба ₮)
├── /logs              Алдааны лог: түлхүүр хүчингүй, quota дууссан, rate limit
├── /api-keys          Syncly API түлхүүрүүд (одоогийн ApiKeysCard-ыг энд шилжүүлнэ)
├── /docs              /api/v1 баримт бичиг
└── [Апп нээх →]       www.syncly.mn/dashboard ("BYOK" badge-тэй)
```

**Onboarding wizard (зорилт: эхний AI хариу хүртэл 15 минутаас бага):**
1. **Provider сонгох:** OpenAI / Gemini / Claude. Provider бүрд "Түлхүүрээ хаанаас авах вэ" гэсэн 30 секундын видео эсвэл зурагтай заавар
2. **Түлхүүр буулгах:** хадгалах үед шууд шалгана (`GET /models`, token зарцуулахгүй). ✅/❌ хариуг алдааны тодорхой шалтгаантай харуулна
3. **Model сонгох:** зөвхөн баталгаажсан жагсаалтаас (§3.4). "Санал болгох" шошготой
4. **FB/IG холбох:** www дээр хийгдэнэ, Meta-гийн redirect URI өөрчлөхгүй
5. **Playground:** өөрийн бүтээгдэхүүн дээр AI-аас асуулт асууж, хариуг шууд харна

Одоогийн хэрэглэгчдэд зориулж `/dashboard/settings` дотор **"AI provider"** таб нэмнэ: "Syncly кредит" ↔ "Өөрийн түлхүүр" гэж сольдог.

### 2.2 Дэмжих provider (үе шаттай)

| Provider | Үе шат | Холболтын арга | Тэмдэглэл |
|---|---|---|---|
| **OpenAI** | Phase 1 | Одоогийн `openai` SDK, зөвхөн `apiKey` солино | Prompt нь GPT-6 Luna дээр тааруулагдсан тул эрсдэл хамгийн бага |
| **Google Gemini** | Phase 1 | `openai` SDK + `baseURL = https://generativelanguage.googleapis.com/v1beta/openai/` | Шинэ dependency шаардахгүй. Reasoning параметр ялгаатай (B3). Үнэгүй түлхүүр карт шаардахгүй |
| **Anthropic Claude** | Phase 3 | **Native** `@anthropic-ai/sdk` adapter | Anthropic өөрөө OpenAI-compatible давхаргаа production-д зөвлөдөггүй: `strict` tool schema-г үл тоодог, prompt caching байхгүй. Тиймээс native ашиглана |
| OpenRouter, DeepSeek, Groq гэх мэт OpenAI-compatible | Phase 3 (сонголтоор) | `openai` SDK + хэрэглэгчийн `baseURL` | SSRF эрсдэлтэй тул зөвшөөрсөн host-ын жагсаалт заавал (§3.3) |

### 2.3 "Үнэгүй" гэдэг нь яг юуг хэлэх вэ — ⚠️ founder шийдвэр хэрэгтэй

| Хувилбар | BYOK хэрэглэгч авах зүйл | Давуу тал | Сул тал |
|---|---|---|---|
| **A. Бүгд үнэгүй** | Бүх feature, хязгааргүй AI | Хамгийн их хэрэглэгч татна | Pro-г бүрэн идэж, орлогын зам үлдэхгүй |
| **B. Үнэгүй цөм + төлбөртэй нэмэлт** ✅ **санал** | Хязгааргүй AI + Starter түвшний tool/feature. Олон ажилтан (seat), олон дэлгүүр, Agent Garden-ийн автомат агент, connector, тэргүүлэх дэмжлэг нь төлбөртэй хэвээр | Хэрэглэгч татах зорилготой нийцнэ. Pro-гийн үнэ цэн хадгалагдана. Шилжилт нь `plans.enabled_tools`-оор тохируулагдана | Хаана зааг тавихыг хэрэглээний өгөгдлөөр тааруулах шаардлагатай |
| **C. Бага платформын төлбөр** | Хязгааргүй AI + Pro feature, сард жижиг төлбөр | Эхний өдрөөс орлоготой | "Үнэгүй" гэсэн амлалт алга болж, хэрэглэгч татах хүч сулрна |

**Санал B.** Шалтгаан нь: AI-ийн зардал бидэнд 0 болсон тул token хязгаар утгагүй. Гэхдээ feature-ийн ялгаагүй бол Pro-д шилжих шалтгаан алга болно. Хэрэгжүүлэлт нь `plans` хүснэгтэд `slug='byok'`, `price=0`, `tokens_per_month=NULL` бүхий мөр нэмэх ба `enabled_tools`-ыг админ панелаас тохируулах явдал.

### 2.4 Түлхүүр ажиллахгүй болоход юу болох вэ

Харилцагчийн мессеж хариугүй үлдэх нь хамгийн муу UX. Иймд:
1. Provider-ийн алдааг ангилна: `invalid_key` · `quota_exceeded` · `rate_limited` · `model_not_found` · `provider_down`
2. `invalid_key` эсвэл `quota_exceeded` → credential-ийн төлвийг шинэчилж, эзэнд **push + имэйлээр** мэдэгдэнэ (24 цагт 1 удаа)
3. **Fallback (санал):** тухайн хэрэглэгчийн үнэгүй Lite pool руу автоматаар шилжинэ (1M token). Pool дуусвал AI зогсож, inbox-д "Түлхүүрээ шинэчилнэ үү" баннер гарна
4. `rate_limited` → retry/backoff хийнэ (`src/lib/ai/resilience` байгаа). Fallback хийхгүй

---

## 3. Архитектур

### 3.1 Домэйн ба routing

- **Нэг Next.js апп, нэг Supabase** ашиглана. Тусдаа Vercel төсөл үүсгэхийг **зөвлөхгүй**: давхар deploy, давхар код, давхар env болно
- Vercel-д `platform.syncly.mn` домэйн нэмж, DNS CNAME тохируулна
- `src/middleware.ts`: `host === 'platform.syncly.mn'` бол `NextResponse.rewrite` ашиглан `/platform/*` route group руу чиглүүлнэ. Platform host дээр `/dashboard` руу хандвал `www` руу redirect хийнэ
- **SSO (B8):** Supabase SSR cookie-д production орчинд `cookieOptions: { domain: '.syncly.mn' }` тохируулна. Гурван client файлд өөрчлөлт орно. Нөлөө: одоогийн хэрэглэгчид **нэг удаа дахин нэвтэрнэ**. Deploy-ийг шөнийн цагаар хийнэ
- Facebook/Instagram OAuth-ийг `www` дээр үлдээнэ (Meta app-ийн redirect URI, App Review-д өөрчлөлт орохгүй)
- Middleware-ийн paywall (`middleware.ts:146-180`) `subscription_status`-ийг уншдаг. `byok` plan-тай хэрэглэгч `active` төлөвтэй байх тул автоматаар нэвтэрнэ

### 3.2 Өгөгдлийн загвар

```sql
-- supabase/migrations/2026XXXX_ai_provider_credentials.sql
CREATE TABLE ai_provider_credentials (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          TEXT NOT NULL,                 -- api_keys.user_id-тэй ижил конвенц (TEXT доторх UUID)
    provider         TEXT NOT NULL CHECK (provider IN ('openai','gemini','anthropic','openai_compatible')),
    label            TEXT NOT NULL DEFAULT 'Үндсэн',
    base_url         TEXT,                          -- зөвхөн openai_compatible үед, allowlist-ээр шалгана
    default_model    TEXT NOT NULL,
    -- AES-256-GCM (app-layer). Plaintext ХЭЗЭЭ Ч хадгалахгүй.
    key_ciphertext   BYTEA NOT NULL,
    key_iv           BYTEA NOT NULL,
    key_tag          BYTEA NOT NULL,
    kek_version      SMALLINT NOT NULL DEFAULT 1,   -- master key солиход хэрэглэнэ
    key_last4        TEXT NOT NULL,                 -- UI: "sk-…a1b2"
    status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','invalid','quota_exceeded','revoked')),
    last_verified_at TIMESTAMPTZ,
    last_used_at     TIMESTAMPTZ,
    last_error_code  TEXT,
    last_error_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at       TIMESTAMPTZ
);
CREATE INDEX ai_provider_credentials_user_idx ON ai_provider_credentials (user_id) WHERE revoked_at IS NULL;

-- RLS: идэвхжүүлнэ, гэхдээ client-д SELECT policy ӨГӨХГҮЙ (ciphertext хөтөч рүү хэзээ ч очихгүй).
-- Бүх уншилт/бичилт service-role API маршрутаар, auth user_id-аар хязгаарлагдана.
ALTER TABLE ai_provider_credentials ENABLE ROW LEVEL SECURITY;

-- Дэлгүүр тус бүрд өөр түлхүүр (агентлагийн хувьд клиент бүр өөрийн түлхүүртэй байж болно).
-- NULL бол эзний үндсэн идэвхтэй түлхүүрийг ашиглана.
ALTER TABLE shops ADD COLUMN ai_credential_id UUID
    REFERENCES ai_provider_credentials(id) ON DELETE SET NULL;

-- BYOK хэрэглээний аналитик (pool-оос хасахгүй, зөвхөн харуулна)
CREATE TABLE byok_usage_daily (
    user_id TEXT NOT NULL, shop_id UUID NOT NULL, day DATE NOT NULL,
    provider TEXT NOT NULL, model TEXT NOT NULL, feature TEXT NOT NULL,
    prompt_tokens BIGINT NOT NULL DEFAULT 0, completion_tokens BIGINT NOT NULL DEFAULT 0,
    requests INT NOT NULL DEFAULT 0, errors INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, shop_id, day, provider, model, feature)
);

-- byok plan (§2.3 B)
INSERT INTO plans (slug, name, price_monthly, price_yearly, is_active, limits, features)
VALUES ('byok', 'BYOK', 0, 0, true, '{"tokens_per_month": null}', '{}')
ON CONFLICT (slug) DO NOTHING;
```

> Agent Garden-ийн `agent_runs` ledger (`docs/architecture/UNIFIED_AGENT_GARDEN_ARCHITECTURE.md`) одоогоор үүсээгүй байна. Үүсэх үед `byok_usage_daily`-г түүн рүү `billing_source='byok'` баганаар нэгтгэнэ.

### 3.3 Шифрлэлт ба нууцлал

| Хамгаалалт | Хэрэгжүүлэлт |
|---|---|
| Хадгалах үеийн шифрлэлт | **AES-256-GCM, app-layer.** Master key нь `AI_CREDENTIALS_KEK` (32 байт, Vercel env-д "Sensitive" тэмдэгтэй). `kek_version`-оор эргүүлж солино. Supabase Vault-ыг сонгоогүй шалтгаан: тайлах үйлдэл SQL функцээр дамждаг. App-layer үед plaintext зөвхөн серверийн санах ойд байна |
| Зөвхөн серверт | `src/lib/ai/credentials/crypto.ts` файлд `import 'server-only'` нэмнэ. Тайлах үйлдлийг зөвхөн route handler болон cron хийнэ |
| Буцааж харуулахгүй | Хадгалсны дараа API зөвхөн `key_last4`, `provider`, `status`-ийг буцаана |
| Логт орохгүй | Logger-д redaction хийнэ. Sentry-д `beforeSend` нэмж `authorization`, `apiKey`, `api_key`, `x-goog-api-key` талбаруудыг арилгана (B10) |
| Хадгалах үеийн шалгалт | `GET /models` дуудна (token зарцуулахгүй) → `status`, `last_verified_at` шинэчлэгдэнэ |
| Client cache | Санах ойн LRU, түлхүүр нь `credential_id + kek_version`, TTL 5 минут. Түлхүүр солигдох эсвэл устах үед хүчингүй болгоно |
| SSRF (`openai_compatible`) | Зөвхөн `https` хүлээн авна. Host-ын allowlist ашиглана. Private/loopback IP-г хориглоно. Redirect дагахгүй |
| IDOR | CRUD маршрутууд **auth user_id**-аар хязгаарлагдана. `x-shop-id` header-т хэзээ ч итгэхгүй. `shops.ai_credential_id`-г тохируулахаас өмнө credential нь тухайн эзнийх эсэхийг заавал шалгана |
| Rate limit | Түлхүүр шалгах маршрутад хатуу хязгаар тавина. Үүгээр бусдын хулгайлсан түлхүүрийг шалгах "oracle" болохоос сэргийлнэ |
| Audit | `credential.created / rotated / revoked / failed` үйлдлүүдийг бүртгэнэ |

### 3.4 AI давхаргын refactor

```
src/lib/ai/credentials/
├── crypto.ts              encrypt / decrypt (AES-256-GCM), server-only
├── resolve.ts             resolveAICredential({ shopId, userId }) → ResolvedAI
├── adapters/
│   ├── types.ts           ProviderAdapter interface
│   ├── openai.ts          reasoning_effort:'none' + max_completion_tokens (одоогийн зан төлөв)
│   ├── gemini.ts          Gemini 3: reasoning_effort-ийг орхих эсвэл 'low' болгох, параметрийн mapping
│   └── anthropic.ts       (Phase 3) native SDK, tool loop-ийг хөрвүүлнэ
├── errors.ts              provider алдаа → AIProviderError{ kind }
└── byokModels.ts          баталгаажсан model-ийн allowlist
```

```ts
type ResolvedAI =
  | { source: 'managed'; client: OpenAI; model: string; adapter: ProviderAdapter }
  | { source: 'byok'; credentialId: string; provider: Provider; client: OpenAI | Anthropic;
      model: string; adapter: ProviderAdapter };
```

Алхмууд:
1. `resolveAICredential` хайх дараалал: `shops.ai_credential_id` → эзний идэвхтэй үндсэн credential → `managed`. Webhook-ийн хэвлийн зам (hot path) дээр 1 query нэмэгдэнэ. Shop-ыг ачаалах query-д join хийж нэгтгэнэ
2. `getOpenAI()`-г `managed` замд хэвээр үлдээнэ (backwards compatible). B2-д дурдсан 7 газарт `ResolvedAI`-г дамжуулна
3. `AIRouter.ts:451` дээрх `complete()` нь параметрээ шууд бичихийн оронд `adapter.buildParams({ maxTokens, tools, json })` дуудна (B3)
4. **Model allowlist:** model бүр eval-ийг давсны дараа л жагсаалтад орно. Шалгах зүйлс: tool calling, Монгол хэлний чанар, `collect_contact_info`, захиалгын урсгал. Хоёр шошготой: "Баталгаажсан", "Туршилтын (чанар баталгаагүй)"
5. **Prompt чанар:** `PromptService.ts` нь GPT-6 Luna дээр тааруулагдсан. Gemini/Claude дээр муу ажиллаж магадгүй. Eval-д унасан тохиолдолд provider тус бүрд жижиг prompt patch хийнэ. Энэ нь хамгийн том **үл мэдэгдэх эрсдэл** тул Phase 0-д шалгана

### 3.5 Billing ба эрхийн өөрчлөлт

| Файл | Өөрчлөлт |
|---|---|
| `src/lib/billing/isAiAuthorized.ts` | `credential?: { status }` параметр нэмнэ. `status === 'active'` бол plan-аас үл хамааран `true` буцаана |
| `src/lib/ai/AIRouter.ts:213-245` | `source === 'byok'` үед `checkTokenLimit`, `limitReached`-ийг алгасна |
| `src/lib/ai/tokenUsage.ts` | `meta.source` нэмнэ. `byok` бол `increment_user_token_pool`-ыг дуудахгүй, `byok_usage_daily` руу бичнэ |
| `api/webhook/route.ts:548, 772`, `api/cron/process-messages` | Credential-ийг resolve хийж `isAiAuthorized`-д дамжуулна |
| `api/dashboard/ai-stats` | BYOK үед "Кредит" биш "Таны provider-ийн зардлын тооцоо"-г харуулна |
| `/admin/shops`, `/admin/plans` | BYOK badge нэмнэ. `byok` plan-ий `enabled_tools`-ыг засна |

---

## 4. Эрсдэл ба хамгаалалт

| Эрсдэл | Хамгаалалт |
|---|---|
| **Дэд бүтцийн зардал.** AI үнэгүй ч webhook, DB, Vercel invocation, Redis-ийн зардал хэвээр | BYOK account тутамд **дэлгүүрийн тоог хязгаарлана** (санал: 3). Сарын мессежийн дээд хязгаар тавина. Имэйл баталгаажуулалт шаардана. Нэг FB page = нэг BYOK account |
| **Meta app-ийн нэр хүнд.** Мессеж бүр Syncly-ийн Meta app-аар явдаг. Үнэгүй хэрэглэгчийн spam нь App Review-д нөлөөлнө | Rate limit, abuse detection, 24 цагийн цонхны дүрмийг (`LEAD_CRM_PIVOT_PLAN_MN.md` §1.7) BYOK-д ч адил хэрэгжүүлнэ |
| **Төлбөртэй хэрэглэгч BYOK руу шилжих (cannibalization)** | §2.3-ын B хувилбар. Lite→BYOK болон paid→BYOK шилжилтийг сар бүр хянана |
| **Prompt-ын чанар provider бүрд ялгаатай** | Eval gate, "Баталгаажсан" шошго, өгөгдмөл model-ийг санал болгоно |
| **Дэмжлэгийн ачаалал** ("түлхүүр ажиллахгүй байна") | `/logs` хуудсанд алдааны тодорхой шалтгааныг Монголоор, засах алхамтай нь харуулна |
| **Түлхүүр алдагдах** (DB leak) | GCM шифрлэлт ашиглаж, KEK-ийг DB-ээс тусад нь хадгална. Leak гарвал KEK-ийг солиод хэрэглэгчдэд түлхүүрээ шинэчлэхийг мэдэгдэнэ |

---

## 5. Хууль ба бодлого

### 5.1 ⚠️ Gemini-ийн үнэгүй түлхүүр ба хувийн мэдээлэл

Google-ийн Gemini API Additional Terms-ийн дагуу **үнэгүй (unpaid) tier**-ийн оролт, гаралтыг Google бүтээгдэхүүнээ сайжруулахад ашигладаг бөгөөд хүн шүүмжлэгч уншиж болно. Google өөрөө үнэгүй tier рүү хувийн мэдээлэл илгээхгүй байхыг зөвлөдөг. Billing идэвхжүүлсэн бол энэ нь хамаарахгүй. Syncly-ийн чатад харилцагчийн утас, хаяг байдаг тул Монголын хувь хүний мэдээлэл хамгаалах тухай хуультай (PDPL) зөрчилдөнө.

**Шийдэл:** Onboarding дээр Gemini сонгох үед анхааруулга харуулж, **checkbox-оор баталгаажуулна**. Зөвшөөрлийг бүртгэнэ. Billing идэвхтэй түлхүүр ашиглахыг зөвлөнө. Founder-ийн шийдвэр: үнэгүй Gemini түлхүүрийг огт хориглох эсвэл анхааруулгатайгаар зөвшөөрөх (§7).

### 5.2 Нөхцөл ба нууцлалын бодлого

- **Үйлчилгээний нөхцөл (`/terms`):** BYOK хэрэглэгч provider-ийн нөхцөлийг өөрөө хариуцна. Provider-т төлөх зардал хэрэглэгчийнх. Syncly түлхүүрийг зөвхөн тухайн хэрэглэгчийн AI хүсэлтэд ашиглана
- **Нууцлалын бодлого (`/privacy`):** хэрэглэгчийн сонгосон AI provider нь харилцагчийн мэдээллийг боловсруулагч (sub-processor) болно гэдгийг тусгана
- Meta-гийн data deletion callback (`/api/meta/data-deletion`) өөрчлөгдөхгүй

---

## 6. Roadmap (~6–7 долоо хоног)

### Phase 0 — Шийдвэр ба туршилт (3–4 өдөр)
- [ ] §2.3 ба §7-ийн асуултуудад founder шийдвэр гаргана
- [ ] **Spike:** Gemini-ийн OpenAI-compatible endpoint-ийг `AIRouter`-ийн tool loop-оор ажиллуулна. Одоогийн eval-ийг ажиллуулж GPT-6 Luna-тай чанарыг харьцуулна
- [ ] Гарц: Gemini-ийн аль model "Баталгаажсан" болох, prompt patch хэрэгтэй эсэх

### Phase 1 — BYOK суурь, `www` дотор (1.5–2 долоо хоног)
> Эхлээд одоогийн dashboard дотор ажиллуулж эрсдэлийг бууруулна. Дэд домэйн дараа нь.
- [ ] Migration: `ai_provider_credentials`, `shops.ai_credential_id`, `byok_usage_daily`, `byok` plan
- [ ] `crypto.ts` + unit test (round-trip, буруу tag, KEK version)
- [ ] `resolve.ts`, adapters (`openai`, `gemini`), `errors.ts`
- [ ] B2-ийн 7 газарт `ResolvedAI` дамжуулна
- [ ] `isAiAuthorized`, `AIRouter` хязгаар, `persistTokenUsage` (§3.5)
- [ ] Алдааны ангилал, мэдэгдэл, Lite pool fallback (§2.4)
- [ ] CRUD API: `/api/dashboard/ai-credentials` (user_id-аар хязгаарлагдсан, rate limit-тэй)
- [ ] `/dashboard/settings` дотор "AI provider" таб
- [ ] Sentry `beforeSend` scrubbing (B10)
- [ ] Тест: BYOK хэрэглэгч limit-д хүрэхгүй, хүчингүй түлхүүр fallback хийнэ, өөр хэрэглэгчийн credential-ийг дэлгүүрт холбох боломжгүй

### Phase 2 — platform.syncly.mn (1–1.5 долоо хоног)
- [ ] Vercel domain + DNS
- [ ] Middleware-д host rewrite хийж `/platform/*` route group үүсгэнэ
- [ ] Cookie domain `.syncly.mn` (SSO), шөнийн deploy
- [ ] Landing, signup, 5 алхамтай onboarding wizard, playground
- [ ] Console: `/keys`, `/usage`, `/logs`, `/api-keys` (ApiKeysCard-ыг шилжүүлнэ), `/docs`
- [ ] `/terms`, `/privacy` шинэчилнэ. Gemini-ийн анхааруулга ба зөвшөөрлийн бүртгэл
- [ ] Admin: BYOK badge, `byok` plan засвар
- [ ] Abuse хамгаалалт: дэлгүүрийн тоо, мессежийн хязгаар, имэйл баталгаажуулалт

### Phase 3 — Claude ба custom provider (1–2 долоо хоног)
- [ ] `@anthropic-ai/sdk` native adapter: tool loop болон vision-ийг хөрвүүлнэ
- [ ] Claude model-уудыг eval-ээр баталгаажуулна
- [ ] `openai_compatible` + SSRF хамгаалалт (сонголтоор)

### Phase 4 — Өсөлт (тасралтгүй)
- [ ] Агентлагийн урсгал: олон клиент дэлгүүр, дэлгүүр тус бүрд өөр түлхүүр
- [ ] Referral, нийгмийн сүлжээнд launch, "OpenAI/Gemini түлхүүрээ хэрхэн авах" Монгол заавар видео
- [ ] BYOK → төлбөртэй багц руу шилжүүлэх зөөлөн санал (seat, олон дэлгүүр, Agent Garden)

---

## 7. Founder шийдэх асуултууд

1. **"Үнэгүй"-ийн хүрээ:** §2.3-ын A / **B (санал)** / C
2. **Gemini-ийн үнэгүй түлхүүр:** анхааруулгатайгаар зөвшөөрөх уу, эсвэл зөвхөн billing идэвхтэй түлхүүрийг зөвшөөрөх үү (§5.1)
3. **Fallback:** түлхүүр ажиллахгүй үед Syncly-ийн Lite pool-оос зардал гаргаж үйлчлэх үү (§2.4)
4. **Төлбөртэй хэрэглэгч** (Starter/Pro) өөрийн түлхүүрийг холбож болох уу. Болдог бол үнэ нь яаж өөрчлөгдөх вэ
5. **Abuse хязгаар:** BYOK account тутамд хэдэн дэлгүүр, сард хэдэн мессеж

---

## 8. Амжилтын хэмжүүр

| Хэмжүүр | Зорилт (эхний 3 сар) |
|---|---|
| Бүртгэлээс эхний AI хариу хүртэлх хугацаа (медиан) | < 15 минут |
| Хадгалах үед шалгалтыг давсан түлхүүрийн хувь | > 85% |
| 7 хоногт ажиллахаа больсон credential-ийн хувь | < 5% |
| BYOK дэлгүүр тутмын сарын дэд бүтцийн зардал | Хэмжиж, Lite-ийн AI зардалтай харьцуулна |
| BYOK → төлбөртэй багц руу шилжилт | Суурь түвшнийг тогтооно |
| 100 BYOK хэрэглэгч тутамд ирэх дэмжлэгийн хүсэлт | < 10 |

---

## Эх сурвалж

- Gemini OpenAI compatibility (baseURL, `reasoning_effort` mapping, reasoning-ийг унтраах нь зөвхөн 2.5 загварт): https://ai.google.dev/gemini-api/docs/openai
- Anthropic OpenAI SDK compatibility (production-д зөвлөдөггүй, `strict` үл тоогдоно, prompt caching байхгүй): https://platform.claude.com/docs/en/api/openai-sdk
- Gemini API Additional Terms (unpaid tier-ийн өгөгдлийн хэрэглээ, хүн шүүмжлэгч): https://ai.google.dev/terms
