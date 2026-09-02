# QPay Merchant (хувь хүн) + UI/UX сайжруулах төлөвлөгөө

> Огноо: 2026-09-02 · Салбар: `claude/qpayg-synclygees-merchant-design-2toug6`
> Энэ баримт нь (A) Syncly-ээс QPay merchant-ийг **хувь хүнээр** үүсгэж авах урсгалыг бүрэн болгох,
> (B) бүх UI болон UX дизайныг системтэйгээр сайжруулах хоёр ажлын нэгдсэн төлөвлөгөө.
> Бүх дүгнэлт кодыг шууд уншиж гаргасан (файлын зам, мөрийн дугаартай).

---

## Хэсэг A — QPay merchant-ийг хувь хүнээр үүсгэх

### A.1 Одоо байгаа зүйл (баримт)

| Давхарга | Файл | Байдал |
|---|---|---|
| QPay Merchant API wrapper | `src/lib/payment/qpay-merchant.ts` | `registerShopAsMerchant()` — `/v2/merchant/person` ба `/v2/merchant/company` хоёуланг дэмждэг. `MERCHANT_ALREADY_REGISTERED` үед lookup-and-reuse хийдэг ✅ |
| Автомат бүртгэл | `src/app/api/shop/route.ts:376-520` | Банкны мэдээлэл хадгалахад (`PATCH /api/shop`) автоматаар merchant үүсгэдэг |
| Гар бүртгэл | `src/app/api/shop/qpay-setup/route.ts` | `POST/GET/DELETE` — тусдаа, давхардсан хоёр дахь зам |
| Хадгалалт | `supabase/migrations/20260414_qpay_multi_merchant.sql` | `shops.qpay_merchant_id / qpay_bank_code / qpay_account_number / qpay_account_name / qpay_status` |
| UI (Settings) | `src/app/dashboard/settings/page.tsx:660-870` | Төрөл select (Хувь хүн / Байгууллага), банк, данс, РД талбар, 4 төлөвийн badge, disconnect/delete |
| UI (Setup wizard) | `src/components/setup/PayoutSetupStep.tsx` | Ижил форм, автомат үргэлжлэл 2 сек |
| Нэхэмжлэл үүсгэх | `src/app/api/payment/create/route.ts`, `.../qpay-invoice/route.ts` | Дэлгүүрийн `qpay_merchant_id`-ээр нэхэмжлэл үүсгэдэг ✅ |
| Тест | `src/lib/payment/__tests__/qpay-merchant.test.ts` | Зөвхөн lookup-and-reuse тест |

**Дүгнэлт:** хувь хүний merchant үүсгэх суурь код бий, гэхдээ QPay-н `person` endpoint-д
шаардлагатай өгөгдлийг **буруу/дутуу** илгээж байгаа тул бодит хэрэглэгч дээр тогтворгүй.

### A.2 Илэрсэн дутагдал (эрэмбээр)

| # | Дутагдал | Хаана | Нөлөө |
|---|---|---|---|
| 1 | **Овог/нэр** — `accountName.split(' ')`-ээр `last_name`/`first_name` гаргадаг. "Бат-Эрдэнэ" гэх нэг үгтэй данс дээр хоёулаа ижил болно; данс эзэмшигч ≠ merchant эзэн байж болно | `qpay-merchant.ts:166-170` | QPay дээр буруу мэдээлэлтэй merchant үүснэ; KYC зөрчил |
| 2 | **РД-ийн validation байхгүй** — хувь хүний регистр = 2 кирилл үсэг + 8 тоо (`УА12345678`). Латин lookalike (`YA`), зай, жижиг үсэг шүүгддэггүй | `shop/route.ts:402-412`, `settings/page.tsx:794`, Zod схем байхгүй | QPay 400 буцаана, хэрэглэгч шалтгааныг мэдэхгүй |
| 3 | **`updateMerchant()` үргэлж `/v2/merchant/company/{id}` руу PUT хийдэг** | `qpay-merchant.ts:262` | Хувь хүний merchant засварлах боломжгүй |
| 4 | **Утас** — `shop.phone`-оос авдаг; байхгүй бол бүртгэл унаад зөвхөн toast "Утасны дугаараа хадгална уу" | `shop/route.ts:500` | Хэрэглэгч өөр хуудас руу очиж утас оруулаад дахин ирэх ёстой |
| 5 | **Имэйл** — `${shop.id}@syncly.mn` гэх хуурамч fallback | `shop/route.ts:472` | QPay-н мэдэгдэл хаашаа ч очихгүй |
| 6 | **MCC код** default `7372` (програм хангамж) | `qpay-merchant.ts:82` | Худалдааны дэлгүүрт буруу ангилал; `business_type`-аас гаргах ёстой |
| 7 | **Хот/дүүрэг** үргэлж УБ/Сүхбаатар | `qpay-merchant.ts:154-156` | Орон нутгийн дэлгүүр буруу хаягтай бүртгэгдэнэ; `/v2/aimaghot`, `/v2/sumduureg` API-г ашиглахгүй байна |
| 8 | **Хоёр давхар бүртгэлийн зам** — `PATCH /api/shop` (банкны *нэрээр* map) ба `POST /api/shop/qpay-setup` (банкны *кодоор*) | хоёр route | Логик салаалж, алдааны боловсруулалт зөрдөг |
| 9 | **`pending` төлөв гацах** — shop route pending тавьдаггүй, qpay-setup тавьдаг; crash болбол үүрд pending | `qpay-setup/route.ts:79` | UI "Боловсруулж байна" гээд дахин оролдох боломж олгохгүй |
| 10 | **Алдааны шалтгаан хадгалагддаггүй** — `qpay_last_error`, `qpay_registered_at`, `qpay_merchant_type` баганууд байхгүй | migration | "Амжилтгүй" гэдгээс өөр мэдээлэл өгч чадахгүй |
| 11 | **Терминал ID хадгалдаггүй** — QPay `p2p_terminal_id`, `card_terminal_id` буцаадаг ч хаядаг | `shop/route.ts:478` | Дараа нь тайлан/дэмжлэгт хэрэгтэй |
| 12 | **End-to-end баталгаажуулалт байхгүй** — merchant үүссэний дараа бодит QR тестлэдэггүй | UI | Хэрэглэгч эхний бодит захиалга дээр л асуудал олно |
| 13 | **Тест хомс** — person body бүтэц, РД/утас normalize, MCC map-д тест байхгүй | `__tests__/` | Регресс баригдахгүй |

### A.3 Зорилтот урсгал (хувь хүн)

```
[Settings → Төлбөр] эсвэл [Setup wizard → Орлогын данс]
        │
        ▼
 Алхам 1  Төрөл сонгох ──────────── Хувь хүн  |  Байгууллага
        │
        ▼
 Алхам 2  Хувийн мэдээлэл ───────── Овог · Нэр · РД (УА12345678) · Утас (8 орон)
        │                              · Имэйл (auth user email-ээс auto) · Аймаг/хот → Сум/дүүрэг
        ▼
 Алхам 3  Банкны данс ───────────── Банк (лого + код) · Дансны дугаар · Данс эзэмшигч (Овог Нэр-ээс auto)
        │
        ▼
 Алхам 4  Шалгаж баталгаажуулах ─── Товч дүгнэлт → "QPay идэвхжүүлэх"
        │        POST /api/shop/qpay-merchant  (нэг л зам)
        ▼
 Төлөв  none → pending → active | failed(шалтгаантай, "Дахин оролдох")
        │
        ▼
 Алхам 5  Тест QR ───────────────── 100₮ нэхэмжлэл үүсгэж QR харуулна, төлбөр орвол "Бэлэн ✅"
```

### A.4 Хэрэгжүүлэх ажлууд

**A.4.1 Өгөгдлийн сан** — шинэ migration `2026xxxx_qpay_merchant_person.sql`
- `shops` дээр нэмэх: `qpay_merchant_type text check in ('person','company')`, `qpay_last_error text`,
  `qpay_registered_at timestamptz`, `qpay_p2p_terminal_id text`, `qpay_card_terminal_id text`,
  `owner_last_name text`, `owner_first_name text`, `qpay_city_code text`, `qpay_district_code text`, `qpay_mcc_code text`.
- `qpay_status`-д `pending` төлөвийг 10 минутын дараа `failed` болгох cron/cleanup (`/api/cron/process-messages`-д нэг мөр нэмэх).

**A.4.2 Validation** — `src/lib/validations/qpay.ts` (шинэ, Zod)
- `mongolianRegisterNumber`: `/^[А-ЯӨҮ]{2}\d{8}$/`, normalize: латин lookalike → кирилл, зай устгах, том үсэг.
- `companyRegisterNumber`: `/^\d{7}$/`.
- `mongolianPhone`: одоо байгаа `normalizeMongolianPhone`-ийг энд шилжүүлж export хийх.
- `qpayPersonMerchantSchema`, `qpayCompanyMerchantSchema` — discriminated union `merchant_type`.
- `bank_code`-ийг `BANK_CODES` enum-оор.

**A.4.3 Сервис давхарга** — `src/lib/payment/qpay-merchant.ts` засвар
- `registerShopAsMerchant()`-ийн person branch: `last_name`, `first_name` параметрээр авах (split-ийг устгах).
- `updateMerchant(id, type, updates)` — `type`-аар endpoint сонгох.
- `MCC_BY_BUSINESS_TYPE` map нэмэх (жнь: `retail→5999`, `fashion→5651`, `beauty→7230`, `food→5812`, `realestate→6513`, default `5999`).
- `getCityCodes()`/`getDistrictCodes()`-ийг 24 цаг cache-лэх (`unstable_cache` эсвэл in-memory) — UI select-д өгөх.
- Шинэ `ensureShopMerchant(shopId, input)` — бүртгэл + local reuse + lookup-and-reuse + DB update-ийг **нэг** функцэд төвлөрүүлэх.

**A.4.4 API** — нэг зам болгох
- Шинэ `POST /api/shop/qpay-merchant` (Zod validate → `ensureShopMerchant`).
- `GET /api/shop/qpay-merchant` — төлөв + masked данс + `last_error` + терминалууд.
- `GET /api/shop/qpay-merchant/locations?city=` — хот/дүүрэг жагсаалт.
- `POST /api/shop/qpay-merchant/test-invoice` — 100₮ тест нэхэмжлэл (payment_integration feature шаардана).
- `PATCH /api/shop` доторх авто-бүртгэлийг **устгаж** `ensureShopMerchant` руу дуудах (эсвэл бүрмөсөн хасаж UI-г шинэ wizard руу чиглүүлэх).
- `/api/shop/qpay-setup`-ийг deprecated болгож 1 release-ийн дараа устгах.
- `middleware.ts` — шинэ route standard rate-limit-д автоматаар орно (шалгах).

**A.4.5 UI**
- Шинэ компонент `src/components/payments/QPayMerchantWizard.tsx` (4 алхам + төлөвийн timeline) — Settings болон Setup wizard хоёулаа үүнийг ашиглана (`PayoutSetupStep` → thin wrapper).
- `QPayStatusCard.tsx` — none/pending/active/failed + `last_error` + "Дахин оролдох" + "Тест QR".
- Банкны select-д лого (`public/banks/*.svg`) + код харуулах.
- РД input-д mask + live validation (кирилл автоматаар).
- Settings хуудасны 660-870 мөрийг энэ компонентуудаар солих (Хэсэг B-ийн Settings задлалттай хамт).

**A.4.6 Тест**
- Unit: person body (`last_name/first_name/register_number`), РД normalize, MCC map, `updateMerchant` endpoint сонголт, pending→failed cleanup.
- Integration (mock fetch): `ensureShopMerchant` — шинэ / local reuse / QPay reuse / алдаа → `qpay_last_error`.
- E2E (Playwright): wizard-ыг хувь хүнээр гүйцээж `active` төлөв харагдах.
- `docs/PAYMENT_TEST_PLAN.md`-д "Хувь хүний merchant" хэсэг нэмэх.

**A.4.7 Гадаад хамаарал (шалгах шаардлагатай)**
- QPay-тэй Syncly-н **vendor гэрээ** хувь хүний merchant үүсгэхийг зөвшөөрдөг эсэх, хувь хүнд KYC/нэмэлт баримт шаарддаг эсэх — QPay-н менежерээс баталгаажуулах.
- Sandbox (`QPAY_ENV`) дээр `person` endpoint-ийн бодит хариу — `last_name/first_name` талбарын нэр, `register_number` формат.

### A.5 Хүлээн авах шалгуур
- Хувь хүн 4 алхмаар, өөр хуудас руу явахгүйгээр QPay идэвхжүүлнэ.
- Алдаа гарвал талбарын түвшинд шалтгаан харагдаж, "Дахин оролдох" ажиллана.
- `pending` 10 минутаас илүү үргэлжлэхгүй.
- Тест QR-аар төлбөр орж `payments` хүснэгтэд бичигдэнэ.
- `npm run test` — шинэ 12+ тест ногоон; `npm run typecheck`, `npm run lint` цэвэр.

---

## Хэсэг B — UI/UX дизайныг сайжруулах төлөвлөгөө

### B.1 Одоогийн байдал (аудитын тоо баримт)

| Үзүүлэлт | Утга | Эх сурвалж |
|---|---|---|
| Үндсэн өнгөний "үнэн" | **3 зөрчилтэй**: docs `#4f46e5` (индиго), brand tokens `#FA5D29` (улбар шар), `globals.css` `#4A7CE7` (цэнхэр); код бодитоор **violet** ашигладаг | `docs/design/UI_UX_DESIGN_SYSTEM.md`, `skills/brand-identity/resources/design-tokens.json`, `src/app/globals.css` |
| Hard-coded өнгө vs токен | **2755 : 794** (`text-gray-900` ×172, `ring-violet-500` ×90, `bg-violet-600` ×43) | `src/**/*.tsx` |
| Dark mode | `.dark` класс-д суурилсан ч toggle байхгүй; dashboard shell `dark`-ыг хүчээр тавьдаг → 111 light токен үхмэл | `src/components/dashboard/DashboardLayoutShell.tsx` |
| Dark-only класс (light-д эвдэрнэ) | `text-white/*` 869, `bg-white/*` 403, `border-white/*` 411, `bg-[#hex]` 155 — 114 файлд | `src/**/*.tsx` |
| Modal | `ui/Modal` 2 газар; **20 файл** гараар `fixed inset-0` overlay (focus trap, `role="dialog"`, Esc байхгүй) | `OrderStatusModal`, `QPayInvoiceModal`, `ProductImportModal` … |
| Button | 115 файл raw `<button>`, 39 файл `ui/Button` | — |
| Үхмэл код | `ui/EmptyState` 0 хэрэглэгч, `MetricCard` 0, `dashboard/MobileNav.tsx` (182 мөр) orphan | — |
| Metric card | 4 өрсөлдөгч: `ui/KPI`, `dashboard/StatsCard`, `AIStatsCard`, `MetricCard` | — |
| Inline `style={{}}` | 127 (settings 13, subscription 10, reports 9) | — |
| Route states | `loading.tsx` / `error.tsx` / `not-found.tsx` **0** | `src/app/**` |
| Аварга хуудсууд | `ai-settings/page.tsx` 1972, `settings/page.tsx` 1450, `comment-automation` 941, `subscription` 893 | 17/20 хуудас `'use client'` |
| Native `confirm()` | 5 | products, customers, comment-automation, story-product-links, staff |
| Responsive-гүй хуудас | `appointments` (0 breakpoint), `complaints`, `payment-audit` | — |
| Header search | `hidden lg:flex`, handler-гүй | `src/components/dashboard/Header.tsx:106-116` |
| ShopSwitcher | keyboard/Esc/`aria-expanded` байхгүй, солиход full reload | `src/components/dashboard/ShopSwitcher.tsx` |
| i18n | `useLanguage()` 40 файл; dashboard 20 хуудаснаас **5** л ашигладаг (CLAUDE.md-д `useTranslations()` гэсэн нь байхгүй) | `src/i18n/mn.ts` 808 мөр |
| A11y | `aria-*` 121 компонентын 27-д; `role=` 11; `focus-visible` 35 vs `focus:` 290 | — |
| Landing | CMS контентыг client-side татдаг → эхний paint дараа контент "анивчина" | `src/app/page.tsx` |
| Auth | raw `<input>`, алдаа `role="alert"`-гүй | `src/app/auth/*` |

### B.2 Зарчим
1. **Нэг үнэн** — `src/app/globals.css` л токены эх сурвалж; docs ба brand JSON-ыг үүнээс үүсгэнэ.
2. **Примитив эхлээд, хуудас дараа** — `ui/*` бүрэн болтол хуудас дахин зурахгүй.
3. **Механизмаар шүүнэ, сэтгэгдлээр биш** — `shidetzuu/.claude/skills/design-loop` арга (bar.md → Brief/System/Craft critic, binary verdict) Syncly-д хуулбарлана. Bar: Mobbin дээрх нэг тодорхой SaaS dashboard (жнь: Linear settings / Stripe dashboard) — хэрэглэгч сонгоно.
4. **5 төлөв заавал** (`skills/developing-ui/SKILL.md`): loading, empty, error, partial, success — хуудас бүрт.
5. Монгол хэл default, шинэ текст бүр `useLanguage().t`-ээр.

### B.3 Үе шат, ажил, гаралт

#### Үе шат 0 — Шийдвэр ✅ (2026-09-02, дэлгэрэнгүй: `docs/design/DECISIONS.md`)
- **D-001 Брэнд өнгө = violet** (`#8B5CF6` суурь). `--primary`/`--ring`/`--brand` → violet scale; `#4A7CE7`, `#4f46e5`, `#FA5D29` гурвыг хасна; docs ба brand JSON-ыг `globals.css`-ээс генерацлана.
- **D-002 Dark + Light хоёулаа.** Default = систем, хэрэглэгч сольж болно, сонголт хадгалагдана. `DashboardLayoutShell`-ийн хүчээр тавьсан `dark` устна.
- **D-003 Design-loop bar — хүлээгдэж байна.** Санал: Linear / Stripe Dashboard / Shopify Admin (DECISIONS.md-д тайлбартай).
- Гаралт: `docs/design/DECISIONS.md` ✅, `docs/design/bar.md` (bar сонгосны дараа).

#### Үе шат 1 — Суурь (1-1.5 долоо хоног)
- **Theme (D-002):** `next-themes` нэмэх (`attribute="class"`, `defaultTheme="system"`, `enableSystem`), `<html suppressHydrationWarning>`; `DashboardLayoutShell`-ээс `dark` + `bg-[#09090b]` устгах; `ThemeToggle` (Header user menu + Settings → Харагдац); `profiles.theme_preference` багана; landing түр `forcedTheme="dark"`.
- **Brand (D-001):** `globals.css`-д `--brand-50…950` violet scale, `--primary`/`--ring` → `--brand-500`; `--brand-indigo` legacy alias; dark `--card #0F0B2E` → neutral `#111113`.
- `globals.css` цэгцлэх: давхардсан `@media (prefers-color-scheme)` блок устгах (next-themes хариуцна), semantic токен (`--surface-1/2/3`, `--text-1/2/3`, `--border-1/2`, `--overlay`) **хоёр горимд** тогтоох, spacing/radius/typography scale хатуу тогтоох.
- `ui/Modal` → `Dialog` (`@radix-ui/react-dialog` аль хэдийн суусан — `package.json`): focus trap, Esc, `aria-labelledby`, mobile-д `BottomSheet` руу автоматаар.
- `ui/ConfirmDialog` — 5 `confirm()`-ийг солино.
- `ui/Button` — `asChild`, loading, icon-only, size xs..lg; ESLint rule `no-restricted-syntax` raw `<button>`-д (ui/ дотор л зөвшөөрнө).
- `ui/Field` (Label + Input + hint + error, `aria-describedby`) — Auth, Settings, QPay wizard ашиглана.
- `ui/Select` (keyboard, search) — банкны select, хот/дүүрэгт.
- Metric card-ыг **нэг** `ui/KPI` болгож 3-ыг устгах; `EmptyState`-ийг бодитоор ашиглах эсвэл устгах; `dashboard/MobileNav.tsx` orphan устгах.
- Codemod (`scripts/codemod-tokens.ts`, jscodeshift/ts-morph), хоёр бүлэг: (1) palette → semantic: `text-gray-900→text-foreground`, `text-gray-500→text-muted-foreground`, `border-gray-200→border-border`, `bg-violet-600→bg-brand-600`, `ring-violet-500→ring-brand` … 2755 → **<400**; (2) dark-only alpha → semantic: `text-white/45→text-text-2`, `border-white/[0.06]→border-border-1`, `bg-white/[0.03]→bg-surface-2`, `bg-[#09090b]→bg-background` … 1838 → **0** (light горим ажиллах урьдчилсан нөхцөл).
- `focus:` → `focus-visible:` codemod.
- Гаралт: Storybook биш, `src/app/dev/ui/page.tsx` (dev-only) дээр бүх примитивийн 5 төлөвийг харуулах "kitchen sink".

#### Үе шат 2 — App shell (3-4 өдөр)
- `DashboardLayoutShell`: `loading.tsx`, `error.tsx`, `not-found.tsx` бүх dashboard route-д (`PageSkeleton` ашиглана).
- `Header`: search-ийг ажиллуулах (⌘K command palette: хуудас, захиалга #, харилцагч хайх) эсвэл устгах — **Санал: ⌘K**.
- `Sidebar`: hover-expand-ийг pinned/collapsed toggle болгох (hover expand touch дээр ажилладаггүй, keyboard-д хүнд); `aria-current="page"`.
- `MobileNav`: 5 таб + "More" sheet-ийг `Dialog` дээр; `nameKey`-ээр л, fallback string устгах.
- `ShopSwitcher`: Radix DropdownMenu, `aria-expanded`, солиход router refresh (full reload биш).
- Гаралт: shell-ийн Playwright screenshot тест (desktop 1440, tablet 820, mobile 390).

#### Үе шат 3 — Хуудсууд (эрэмбээр, тус бүр 2-4 өдөр)
| Эрэмбэ | Хуудас | Ажил |
|---|---|---|
| 1 | **Settings** (1450 мөр) | `settings/_sections/{Shop,Payments,Channels,Notifications,Delivery,Danger}.tsx` болгон задлах; QPay wizard (Хэсэг A) энд орно; локал `StatusBadge`/`ConfirmPanel`-ийг `ui/Badge`/`ConfirmDialog`-оор солих; 13 inline style устгах |
| 2 | **Orders** (719) | Хүснэгт → `ui/DataTable`; статус шүүлт URL-д (`?status=`); `OrderStatusModal` → `Dialog`; mobile card view |
| 3 | **Inbox** | Мессеж жагсаалт/дэлгэрэнгүй split view-ийн mobile урсгал; `QPayInvoiceModal` → `Dialog`; typing/sending төлөв |
| 4 | **Dashboard нүүр** | Archetype бүрт KPI 4 + 1 chart + "Өнөөдөр хийх" жагсаалт; skeleton/empty |
| 5 | **Products** (835) | Grid/list toggle, bulk action bar, `ProductImportModal` → `Dialog`, image upload progress |
| 6 | **AI settings** (1972) | Tabs → тусдаа route segment (`ai-settings/(tabs)/persona`, `/knowledge`, `/operations`); хадгалах төлөв sticky bar |
| 7 | **Reports / Customers / Subscription** | Локал chart компонентыг `ui/ChartBar`/`Sparkline`-д нэгтгэх; inline style устгах |
| 8 | **Appointments / Complaints / Payment-audit / Staff** | Responsive (sm/md/lg), DataTable, empty state |

#### Үе шат 4 — Onboarding, Auth, Landing (1 долоо хоног)
- Setup wizard (`setup/page.tsx` 829 + 9 алхам 4461 мөр): алхам бүр URL (`/setup/[step]`), progress rail, "дараа хийх" тодорхой; `PayoutSetupStep` → `QPayMerchantWizard`.
- Auth: `ui/Field`, `role="alert"`, password strength, OAuth товчны эрэмбэ (FB → Google → email).
- Landing: CMS контентыг server component-д fetch (`page.tsx` → async RSC + `revalidate`), `<style jsx global>` → CSS module; LCP < 2.5s.
- `OnboardingTour`-ийг шинэ shell-д тааруулах.

#### Үе шат 5 — Чанар, хэмжилт (тасралтгүй)
- i18n: dashboard 20/20 хуудас `useLanguage()`; `mn.ts`-д дутуу түлхүүр lint (`scripts/i18n-check.ts`).
- A11y: `@axe-core/playwright` бүх dashboard route-д, зорилт: 0 serious/critical; Lighthouse a11y ≥ 95.
- Visual regression: Playwright `toHaveScreenshot` shell + 8 гол хуудас × 3 viewport.
- Design-loop: хуудас бүр "Brief / System / Craft" critic PASS болтол; `docs/design/progress.md`-д тойргийн түүх (shidetzuu-ийн `progress.md` загвар).
- Docs: `UI_UX_DESIGN_SYSTEM.md`-ийг `globals.css`-ээс генерацлах (`scripts/gen-design-doc.ts`); `CLAUDE.md`-д `useTranslations()` → `useLanguage()` гэж засах.

### B.4 Хэмжигдэх зорилт

| Үзүүлэлт | Одоо | Зорилт |
|---|---|---|
| Hard-coded palette класс | 2755 | < 400 |
| Dark-only alpha/hex класс (`white/*`, `bg-[#…]`) | 1838 | 0 |
| Light горимд ажилладаг dashboard route | 0 | бүгд (screenshot + axe хоёр горимд) |
| Гар overlay modal | 20 | 0 |
| Raw `<button>` (ui/ гадна) | 115 файл | < 10 |
| `loading.tsx`/`error.tsx` | 0 | бүх dashboard route |
| Native `confirm()` | 5 | 0 |
| Inline `style={{}}` | 127 | < 20 (зөвхөн динамик утга) |
| Dashboard хуудас i18n | 5/20 | 20/20 |
| `role=`/`aria-*` компонент | 27/121 | interactive бүх компонент |
| Хамгийн том page.tsx | 1972 мөр | < 400 |
| Lighthouse a11y (dashboard) | хэмжээгүй | ≥ 95 |

### B.5 Дараалал ба хугацаа (нэг хөгжүүлэгч, ойролцоо)

| Долоо хоног | Ажил |
|---|---|
| 1 | Үе шат 1 (theme provider, violet токен, Dialog, Button, Field, codemod ×2) |
| 2 | Үе шат 2 (shell) + **Хэсэг A** (QPay person merchant: DB, validation, сервис, API, тест) |
| 3 | Settings задлалт + QPay wizard UI + Orders |
| 4 | Inbox + Dashboard нүүр + Products |
| 5 | AI settings + Reports/Customers/Subscription |
| 6 | Setup wizard + Auth + Landing |
| 7 | Жижиг хуудсууд, a11y/visual тест, design-loop тойргууд, docs |

### B.6 Эрсдэл
- **Codemod-ийн регресс** — токенд солиход өнгө өөрчлөгдөнө; screenshot тестийг codemod-оос **өмнө** суулгах.
- **Settings/AI-settings задлалт** — state хуваалцаж байгаа тул хэсэг бүрийг тусдаа PR-аар, feature flag-гүйгээр шууд солино (dev-д бүрэн туршсаны дараа).
- **QPay sandbox** — person endpoint-ийн бодит хариуг sandbox дээр эхэлж шалгахгүй бол A.4.3 хоцорно.
- **Light горим** — 1838 dark-only класс codemod-оор солигдоно; codemod хамрахгүй inline `style`/динамик класс гараар. Light-ийн screenshot тестийг shell дээр эхэлж тавина, хуудас бүр light-д шалгагдаагүй бол "дууссан" гэж тооцохгүй.

---

## Эхний 6 PR (шууд эхлэх)

1. `feat(qpay): person merchant — DB баганууд, Zod validation, ensureShopMerchant, тест` (Хэсэг A.4.1-A.4.3, A.4.6)
2. `feat(qpay): POST/GET /api/shop/qpay-merchant + test-invoice; хуучин хоёр замыг нэгтгэх` (A.4.4)
3. `feat(ui): next-themes + ThemeToggle + violet brand scale + semantic light/dark токен` (D-001, D-002)
4. `feat(ui): Dialog/ConfirmDialog/Field/Select примитив + kitchen-sink` (B үе шат 1)
5. `refactor(ui): codemod — palette → semantic, dark-only alpha → semantic, focus → focus-visible` (B үе шат 1)
6. `feat(settings): Settings-ийг хэсгүүдэд задалж QPayMerchantWizard оруулах` (A.4.5 + B үе шат 3.1)
