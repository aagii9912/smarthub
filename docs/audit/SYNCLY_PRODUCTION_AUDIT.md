# 🔍 Syncly — Production-Readiness Audit (Гүйцэтгэсэн тайлан)

> **Хүрээ:** "Senior full-stack engineer" өнцгөөс Syncly-г "сая хэрэглэгч хүртэл scale
> хийх production апп" гэдэг шалгуураар нягталсан findings тайлан.
> **Огноо:** 2026-06-08 · **Аргачлал:** 3 параллель аудит (архитектур/API, өгөгдлийн сан,
> UI/production-readiness) + гар баталгаажуулалт (false-positive шүүлт).
> **Холбоотой:** `docs/audit/AUDIT_PLAN.md` (8 фазын төлөвлөгөө — энэ нь түүний гүйцэтгэл).

---

## 0. Executive Summary

Syncly нь **бат бөх инженерийн суурьтай** — webhook signature verification, atomic
stock RPC, олон түвшний rate limiting, Sentry monitoring, ~65 тест зэрэг production-
түвшний шийдлүүд аль хэдийн байна. Гэвч **сая хэрэглэгчийн scale-д шилжихэд саад
болох хэд хэдэн бүтцийн дутагдал** үлдсэн байна.

| Чиглэл | Үнэлгээ |
|--------|---------|
| System Architecture | 🟡 Сайн суурьтай, гэхдээ sync bottleneck + async queue холбогдоогүй |
| File Structure | 🟢 Цэвэрхэн, тогтвортой; validation давхардал бий |
| Database Schema | 🟢 Index/atomicity сайн; RLS coverage + constraint дутуу |
| API Endpoints | 🟡 Auth голдуу сайн; нэг shop-scoping цоорхой, Zod хагас |
| UI Architecture | 🟡 Client-component хэт их, Suspense цөөн, i18n хагас |
| Production-Readiness | 🟢 Security/monitoring сайн; logging/testing цоорхойтой |

**Verdict:** Pilot/production-pilot-д бэлэн. **Сая хэрэглэгчийн scale-д шилжихээс өмнө**
доорх **CRITICAL / HIGH** findings-ийг (ялангуяа async queue холболт, x-shop-id
fallback, middleware caching, sequential delete-үүд) засах ёстой. Тооцоолсон ажил: ~6-8
долоо хоног / 60-80 developer-day.

---

## 1. System Architecture

### Flow тойм
1. Үйлчлүүлэгч Messenger/IG DM → Meta webhook `POST /api/webhook`
2. `WebhookService` → signature verify → message хадгална → shop config ачаална
3. `AI Router` → context (бараа, сагс, customer memory) цуглуулна
4. Gemini → Function Calling-аар хариу үүсгэнэ → Meta Graph API-аар буцаана
5. `src/middleware.ts` → `/dashboard /setup /admin` auth + rate limit хамгаална

### 🔴 CRITICAL — Async job queue hot path-д холбогдоогүй
`src/lib/webhook/retryService.ts` дотор `queueWebhookJob()` бүрэн бичигдсэн боловч
захиалга/төлбөрийн мэдэгдлийн урсгалд **огт дуудагдаагүй**. Одоогийн байдлаар:
```ts
// src/app/api/orders/route.ts (~256)
sendOrderStatusNotification(...).catch(err => /* зөвхөн log */)
```
fire-and-forget хэлбэртэй — Meta API эсвэл сүлжээ алдаа гарвал **мэдэгдэл бүрмөсөн
алдагдана** (хэрэглэгч төлбөр баталгаажсан мэдэгдэл аваагүй үлдэх боломжтой). Webhook
давтан асвал давхар DM очих эрсдэлтэй.
→ **Засвар:** `webhook_jobs` table + cron processor-той холбож, at-least-once delivery
+ idempotency болгох.

### 🔴 HIGH — AI хариу webhook response-ийг блоклодог (sync)
`src/app/api/webhook/route.ts` дотор AI generation-ийг `await` хийж байж 200 OK
буцаадаг. 50+ зэрэгцээ чат үед serverless worker бүгд дүүрч, request timeout болно.
→ **Засвар:** Мессежийг queue-д тавьж 202 + message-id шууд буцаах; AI-г async
process-messages урсгалд боловсруулах.

### 🔴 HIGH — Middleware бүр request-д service-role + DB round-trip
`src/middleware.ts` хамгаалагдсан route бүрд trial/subscription төлөв шалгахдаа
service-role Supabase client үүсгэж DB-рүү очдог. Cache байхгүй тул хэрэглэгч × request
бүрд нэг round-trip → үндсэн bottleneck.
→ **Засвар:** `subscription_status / trial_ends_at`-г Redis-д 5 мин TTL-тэй эсвэл JWT
claim-д cache хийх.

### 🟡 MEDIUM — Token usage denormalization write contention
AI дуудалт бүр `shops.token_usage_total`-г update хийдэг → зэрэгцээ бичилтийн өрсөлдөөн.
DB зохицуулдаг ч оновчтой биш; их ачаалалд тусдаа `usage_logs`-оос batch-aggregate хийх.

---

## 2. File Structure

`src/app/api/` — 26 route group, ~100+ `route.ts`. Бүтэц **цэвэрхэн, тогтвортой**:
`api/ · lib/services/ · lib/validations/ · types/` тус тусдаа.

### 🟡 MEDIUM — Validation/error давхардал
- Zod зөвхөн цөөн route-д (`orders`, `dashboard/products`); 100+ route гар шалгалт.
- `error instanceof Error ? error.message : String(error)` загвар 50+ газар хуулагдсан.
→ Нийтлэг `formatError()` + validation middleware гаргах.

### 🟢 LOW — Debug endpoint-ууд source-д үлдсэн
`api/debug`, `api/debug-auth`, `admin/debug-shops` — `src/middleware.ts:44,64-67`
production-д NODE_ENV-ээр блоклогдсон (✓ mitigated) боловч source-оос бүрмөсөн
устгавал зохистой.

### 🟡 MEDIUM — Service layer хэсэгчлэн ашиглагдсан
`lib/services/` 10+ файлтай ч route-уудын ~30%-д л дуудагддаг; үлдсэн нь DB логикийг
inline бичсэн → maintainability/testability бууруулна.

---

## 3. Database Schema

102 migration. **Сайн талууд:** UUID PK + `gen_random_uuid()`, `TIMESTAMPTZ DEFAULT NOW()`,
112 index (foreign key + partial index `is_active=true` зэрэг), cascade delete,
GIN index `idx_customers_tags`.

### 🟢 EXCELLENT — Atomic / idempotent stock
- `20260424100000_reserve_stock_bulk.sql` — bulk reservation, тогтвортой product_id
  дарааллаар lock → deadlock-аас сэргийлсэн.
- `20260424110000_atomic_stock_deduction.sql` — `atomic_claim_stock_deduction()`
  RPC, `stock_deducted_at` marker-аар idempotent.

### 🔴 CRITICAL — Payment idempotency constraint дутуу
`payments` table-д `idempotency_key` эсвэл `UNIQUE(order_id, qpay_invoice_id)` байхгүй.
QPay webhook давхар асвал хоёр payment бичлэг үүсэх эрсдэлтэй.
→ **Засвар:** UNIQUE constraint нэмж, webhook handler-т давхар-asалтыг шалгах.

### 🟠 HIGH — Service-role өргөн ашиглалт → app-layer-д тулгуурласан isolation
`supabaseAdmin()` нь **бүх RLS-ийг bypass** хийдэг. Cross-shop тусгаарлалт зөвхөн
application код дахь `.eq('shop_id', …)` шүүлтээс хамаарна. Аль нэг service method
shop_id шүүлтийг мартвал **cross-shop data leak**. Жишээ: `StockService` доторх
`notifyLowStockAfterDeduction()` order-ыг зөвхөн `order_id`-аар татдаг (shop_id баталгаажуулдаггүй).
→ **Засвар:** Бүх data access-д shop_id шүүлт хатуу шаардах + Shop A → Shop B leak-ийг
шалгах integration test нэмэх.

### 🟡 MEDIUM — RLS policy цоорхой / зөрүүтэй pattern
- Зарим table RLS enabled боловч policy дутуу (`orders`, `chat_history`, `customers`
  зэрэг шинэ table-ууд). Service-role bypass хийдэг тул шууд breach биш, гэхдээ
  Supabase client-аар хандах flow-д алдаа гарна.
- Policy pattern зөрүүтэй: helper function (`get_user_shop_id()`) vs raw `auth.uid()`
  vs `(select auth.uid())` subquery — нэг загварт нэгтгэх.

### 🟡 MEDIUM — Constraint дутуу
- `order_items`-д `CHECK (quantity > 0)` байхгүй (cart_items-д бий) → сөрөг тоо.
- `products.price >= 0` schema-д хатуугаар enforce хийгдээгүй.

### 🟡 MEDIUM — Serverless connection pooling
`supabaseAdmin()` дуудалт бүрд шинэ client (Vercel session leak-ээс сэргийлсэн ✓)
үүсгэдэг ч өндөр concurrency-д холболт дуусах эрсдэлтэй → Supabase PgBouncer ашиглах.

### ✅ Шалгаж зассан — FALSE POSITIVE (cry-wolf-оос сэргийлсэн)
Анхны автомат сканнер дараах 2-ыг "CRITICAL" гэж тэмдэглэсэн боловч код руу гар
шалгахад **аль хэдийн зассан** болох нь батлагдсан:
1. **`get_user_shop_id()` non-existent `users` table руу заадаг** — `20260113150000_fix_rls_function.sql:52-63`
   дотор `shops` table руу аль хэдийн засагдсан. Live bug **БИШ**.
2. **Stock trigger double-deduction conflict** — `20260424110000_atomic_stock_deduction.sql:18-19`
   нь `trigger_decrement_stock_on_paid`-г зориудаар `DROP` хийж, app-driven idempotent
   RPC болгож нэг эх сурвалжтай болгосон. Conflict **зориуд шийдэгдсэн**.

---

## 4. API Endpoints

Auth голдуу **сайн**: хэрэглэгчийн route-ууд `getAuthUserShop()` + `shop_id` scope-той;
public route-ууд (`/api/webhook` signature, `/api/pay/[id]` lookup, `/api/leads` form)
зөв хязгаарлагдсан.

### 🔴 CRITICAL — x-shop-id ownership шалгахгүй fallback
`src/app/api/dashboard/customers/route.ts` (DELETE):
```ts
const shopId = authShop?.id || request.headers.get('x-shop-id')!; // ⚠️ unsafe
```
`getAuthUserShop()` null буцаавал header-ээс шууд авдаг. Халдагч `x-shop-id: <өөр-shop>`
спуф хийж бусдын customer устгаж/харж болзошгүй (`dashboard/conversations/[customerId]`-д
ижил `resolveShopId` загвар).
→ **Засвар:** Auth заавал шаардаж, утга байхгүй бол эрт reject; header-fallback устгах.

### 🟡 MEDIUM — Zod coverage хагас
`api/ai-settings/route.ts` нь `type`-г enum-аар бус switch-ээр шалгадаг (untrusted input).
→ `z.enum(['faqs','quick_replies','slogans'])` болгох; бусад mutation route-уудад Zod дэлгэх.

### 🟡 MEDIUM — Rate-limit key user_id агуулдаггүй
`src/lib/utils/rate-limiter.ts` — key нь `${clientId}:${routeType}` (IP-д суурилсан).
Proxy/NAT ард олон жинхэнэ хэрэглэгч нэг forwarded IP → хамтдаа худал блоклогдоно.
→ `${userId}:${routeType}` эсвэл IP+userId хослуулах. Мөн `/api/webhook`-д per-customer
rate limit нэмж спам мессежээс сэргийлэх.

### 🟡 MEDIUM — Error message-аар DB дэлгэрэнгүй алдагдах
`error.message`-г client рүү шууд буцаадаг route-ууд (50+) DB schema/query syntax
задруулж болзошгүй.
→ Generic мессеж буцааж, дэлгэрэнгүйг server-д л log хийх (`wrapError()`).

### 🔴 HIGH / 🟡 MEDIUM — Scale: sequential round-trip
- `src/app/api/shop/route.ts` shop устгахад ~18 дараалсан `.delete()` → 1.8s+ latency.
- `dashboard/customers` customer cleanup 3 дараалсан delete.
- `OrderService.cancel()` нь item бүрд stock restore (N+1).
→ **Засвар:** `Promise.all()` batch + `restore_stock_bulk()` RPC.

---

## 5. UI Architecture

### 🟠 HIGH — `'use client'` хэт их (≈151/195 tsx)
UI primitive хүртэл (Button, Dropdown, Modal) client-ээр тэмдэглэгдсэн → dashboard JS
bundle 2-3 дахин том. → Interactive биш компонентуудыг Server Component болгох; data
fetch-ийг Server Component + Suspense руу шилжүүлэх.

### 🟠 HIGH — Suspense boundary цөөн (≈10)
Гол урсгалд (orders, conversations, AI stats) loading boundary байхгүй; dashboard бүх
дата-г client-side `useDashboard()`-аар татдаг → waterfall.
→ Server Component wrapper + Suspense нэмэх.

### 🟡 MEDIUM — i18n хагас (hardcoded монгол string)
`src/i18n/{mn,en}.ts` + `useLanguage()` бэлэн боловч олон газар hardcode:
```ts
`${p.name} — үлдсэн ${p.stock}`            // dashboard/page.tsx
`${mins}м` / `${hrs}ц`                      // цаг товчлол
'Төлбөргүй'                                  // api/features/route.ts
```
→ `t.dashboard.*` key-ээр солих; API хариунд Accept-Language дэмжих.

### 🟡 MEDIUM — Компонент давхардал / том файл
- `layout/Sidebar.tsx` vs `dashboard/MobileNav.tsx`; `ConversationList` vs `InboxList`.
- `SubscriptionStep.tsx` ~982 LOC, `ProductForm.tsx` ~779 LOC → хариуцлагаар нь хуваах.
- `dynamic()` зөвхөн 2 газар → setup wizard компонентуудыг code-split хийх.

### 🟢 LOW — Accessibility
ARIA суурь хангалттай (~89), гэхдээ chart-уудад label, sidebar-д `aria-label`, Modal-д
focus-trap дутуу. axe-core-оор тест хийх.

---

## 6. Production-Readiness

### 🟢 Security (голдуу сайн)
- Webhook **HMAC-SHA256 + `crypto.timingSafeEqual`** (`api/webhook/route.ts:42-79`). ✓
- `NEXT_PUBLIC_*` зөв (Supabase anon, VAPID public — secret leak **алга**). ✓
- CSP/security headers `next.config.ts`-д тохируулсан. ✓
- 🟡 CSP-д `'unsafe-inline'` (script-src) — nonce-based болгож, user-content sanitize хийх.
- 🟡 CSRF: OAuth flow-д state nonce бий, гэхдээ POST/PATCH/DELETE mutation-д token дутуу
  (`Content-Type: application/json` + SameSite cookie-оор хэсэгчлэн хамгаалагдсан).

### 🟡 Testing
~50 unit (AI flow, services, webhook, payment signature) + ~15 E2E (auth, smoke, cron).
Дутуу: **payment webhook, AI→order creation, cart checkout, subscription flow** E2E.
`vitest.config.ts`-д coverage threshold алга. → Дээрх critical path-уудад E2E + 70%
threshold нэмэх.

### 🟡 Monitoring / Logging
- Sentry client/server/edge тохируулсан (10% traces, prod-only). ✓ Health check ✓.
- 🟡 Production-д ~11 raw `console.*` (`middleware.ts`, client page-үүд) — `logger.*`-аар солих.
- 🟡 Structured logging дутуу — request-id (nanoid), shop_id, latency context нэмэх.
- 🟢 AI үйлдлүүдэд APM (Sentry transaction) нэмж token/latency хэмжих.

### 🟡 Performance / Scalability
- `cron/process-messages` 5 сек тутам (~17,280/өдөр); `pending_messages(processed)`
  index дутуу → linear scan. → Index нэмж interval 15-30 сек болгох.
- Гадаад CDN зураг (fbcdn/cdninstagram) optimize хийгдээгүй; above-fold-д `priority`.
- Rate-limiter in-memory fallback (`Map`) Redis унавал хязгааргүй өснө → cleanup.

---

## 7. Findings — Severity хүснэгт

| # | Severity | Finding | Байршил |
|---|----------|---------|---------|
| 1 | 🔴 CRITICAL | Async job queue hot path-д холбогдоогүй (мэдэгдэл алдагдана) | `lib/webhook/retryService.ts` |
| 2 | 🔴 CRITICAL | x-shop-id ownership шалгахгүй fallback (cross-shop delete) | `api/dashboard/customers/route.ts` |
| 3 | 🔴 CRITICAL | Payment idempotency constraint дутуу (давхар charge) | `payments` schema |
| 4 | 🟠 HIGH | AI хариу webhook-ийг блоклодог (sync, worker дүүрнэ) | `api/webhook/route.ts` |
| 5 | 🟠 HIGH | Middleware бүр request-д service-role + DB round-trip | `middleware.ts` |
| 6 | 🟠 HIGH | Service-role isolation app-layer-д тулгуурласан | `lib/services/*` |
| 7 | 🟠 HIGH | Rate-limit key user_id-гүй (proxy ард худал блок) | `lib/utils/rate-limiter.ts` |
| 8 | 🟠 HIGH | Sequential delete-үүд (shop ~18, customer 3) | `api/shop/route.ts` |
| 9 | 🟠 HIGH | `'use client'` хэт их + Suspense цөөн | `src/components`, `src/app/dashboard` |
| 10 | 🟡 MEDIUM | Zod coverage хагас / ai-settings enum switch | олон route, `api/ai-settings` |
| 11 | 🟡 MEDIUM | Error message DB дэлгэрэнгүй алдагдуулна | ~50 route |
| 12 | 🟡 MEDIUM | RLS policy цоорхой / зөрүүтэй pattern | олон migration |
| 13 | 🟡 MEDIUM | order_items `quantity>0` CHECK дутуу | `001_initial_schema_safe.sql` |
| 14 | 🟡 MEDIUM | i18n хагас (hardcoded монгол string) | `dashboard/page.tsx` г.м. |
| 15 | 🟡 MEDIUM | cron 5 сек + `pending_messages(processed)` index дутуу | `cron/process-messages` |
| 16 | 🟡 MEDIUM | Том компонент / давхардал | `SubscriptionStep.tsx`, `ProductForm.tsx` |
| 17 | 🟡 MEDIUM | Production `console.*` + structured logging дутуу | `middleware.ts` г.м. |
| 18 | 🟡 MEDIUM | Critical-path E2E дутуу (payment/order/subscription) | `e2e/` |
| 19 | 🟢 LOW | Debug endpoint source-д үлдсэн (mitigated) | `api/debug*` |
| 20 | 🟢 LOW | CSP `'unsafe-inline'`, chart ARIA label | `next.config.ts` |

---

## 8. Strengths (хадгалах)

✅ Webhook HMAC-SHA256 (timing-safe) · ✅ Atomic + idempotent stock RPC + deadlock-safe
bulk reservation · ✅ 112 DB index · ✅ Sentry (client/server/edge) + health check ·
✅ Multi-tier rate limit + Redis fallback · ✅ `AppError` hierarchy · ✅ ~65 тест ·
✅ `NEXT_PUBLIC_` зөв (secret leak алга) · ✅ CSP/security headers · ✅ Цэвэрхэн
`api/lib/services/validations` бүтэц · ✅ RLS/stock security hardening migration-ууд.

---

## 9. Roadmap (priority)

**Долоо хоног 1 — BLOCKING (CRITICAL)**
- [ ] x-shop-id fallback засах (auth заавал)
- [ ] `webhook_jobs` queue-г order/payment мэдэгдэлд холбох
- [ ] Payment idempotency UNIQUE constraint
- [ ] Sequential delete-үүдийг `Promise.all()` болгох (quick win)

**Долоо хоног 2 — HIGH**
- [ ] AI хариуг async (202 + message-id)
- [ ] Middleware subscription төлвийг Redis/JWT cache
- [ ] Rate-limit key-д user_id оруулах
- [ ] Critical-path E2E (payment/order/subscription)

**Долоо хоног 3 — MEDIUM**
- [ ] Zod + error-handling нэгтгэх; DB leak зогсоох
- [ ] Server Component + Suspense руу dashboard шилжүүлэх
- [ ] Structured logging + request-id; `console.*` устгах
- [ ] cron index + interval; `quantity>0` CHECK

**Долоо хоног 4+ — LOW**
- [ ] CSP nonce-based; image CDN optimize; debug endpoint устгах
- [ ] RLS policy pattern нэгтгэх; vitest coverage threshold

---

## 10. Quick Wins (≤1 цаг тус бүр)

Хүсвэл дараагийн алхамд тусдаа branch дээр хийж болох бага эрсдэлтэй засварууд:
`Promise.all()` delete-үүд · rate-limit key-д user_id · `ai-settings` Zod enum ·
`order_items` `CHECK (quantity>0)` · `pending_messages(processed, created_at)` index ·
production `console.*` → `logger.*`.

---

*Энэ тайлан нь `docs/audit/AUDIT_PLAN.md`-ийн 8 фазын гүйцэтгэл бөгөөд код өөрчлөлт
оруулаагүй — зөвхөн findings баримтжуулсан. Findings бүр `файл:мөр`-ээр заагдсан тул
`git grep`-ээр шууд баталгаажуулж болно.*
