# Syncly — Дэлгүүр Бүртгүүлэх Асуумжийн Гарын Авлага

> Syncly платформ дээр **Дэлгүүр (Худалдагч)** бүртгүүлэхэд шаардлагатай **бүх асуумж / талбарыг** алхам алхмаар тайлбарласан баримт.
> Энэ нь `src/app/setup/` доторх **Setup Wizard**-ийн бодит кодоос гаргасан мэдээлэл бөгөөд талбар бүрийн нэр, шаардлага, валидаци, өгөгдмөл утгыг агуулна.

---

## 📋 Ерөнхий бүтэц (Wizard Steps)

Бүртгэлийн визард нийт **9 алхамтай**. Зарим алхам бизнесийн төрлөөс хамаарч харагдана.

| # | Алхам | Файл | Заавал эсэх |
|---|-------|------|-------------|
| 0 | **Бизнесийн төрөл** (Business Type) | `BusinessTypeStep.tsx` | ✅ Заавал |
| 1 | **Дэлгүүрийн мэдээлэл** (Shop Info) | `ShopInfoStep.tsx` | ✅ Заавал |
| 2 | **Facebook Page холбох** | `FacebookStep.tsx` | ⏭️ Алгасаж болно |
| 3 | **Instagram холбох** | `InstagramStep.tsx` | ⏭️ Алгасаж болно |
| 4 | **Бараа / Үйлчилгээ** (Products) | `ProductStep.tsx` | ⚠️ Хэсэгчилсэн |
| 5 | **Үйл ажиллагаа** (Operations) | `OperationsStep.tsx` | ⏭️ Сонголтоор (төрлөөс хамаарна) |
| 6 | **AI Туслах тохиргоо** (AI Setup) | `AISetupStep.tsx` | ⚠️ Хэсэгчилсэн |
| 7 | **Орлогын данс** (Payout) | `PayoutSetupStep.tsx` | ✅ Заавал (дансны мэдээлэл) |
| 8 | **Багц сонгох** (Subscription) | `SubscriptionStep.tsx` | ✅ Заавал (зөвшөөрөл) |

> Эх сурвалж: `src/app/setup/page.tsx`

---

## 🟦 Алхам 0 — Бизнесийн төрөл (Business Type)

**Зорилго:** Дэлгүүр ямар салбарт үйл ажиллагаа явуулдгийг тодорхойлно. Сонголтоос хамаарч дараагийн алхмуудын талбарууд өөрчлөгдөнө.

| Талбар | DB багана | Төрөл | Заавал |
|--------|-----------|-------|--------|
| Бизнесийн төрөл | `shops.business_type` | Radio (1 сонгох) | ✅ Тийм |

**Сонголтууд:**

| Утга (value) | Нэр | Тайлбар |
|--------------|-----|---------|
| `retail` | Дэлгүүр | Бараа, бүтээгдэхүүн борлуулдаг физик дэлгүүр |
| `restaurant` | Ресторан | Хоол, унд, кафе, fast food |
| `service` | Үйлчилгээ | Цаг захиалгат үйлчилгээ (засвар, сургалт г.м.) |
| `ecommerce` | E-commerce | Зөвхөн онлайнаар бараа худалддаг |
| `beauty` | Гоо сайхан | Салон, спа, гоо сайхны үйлчилгээ |
| `healthcare` | Эрүүл мэнд | Эмнэлэг, клиник, эрүүл мэндийн төв |
| `education` | Боловсрол | Сургалт, курс, боловсролын байгууллага |
| `realestate_auto` | Үл хөдлөх / Авто | Үл хөдлөх хөрөнгө, автомашин зарах бизнес |
| `other` | Бусад | Бусад төрлийн бизнес |

> Эх сурвалж: `src/lib/constants/business-types.ts`

---

## 🟦 Алхам 1 — Дэлгүүрийн мэдээлэл (Shop Info)

**Гарчиг:** "Дэлгүүрийн мэдээлэл" — *Таны дэлгүүрийн үндсэн мэдээлэл*

| # | Асуумж | DB багана | Төрөл | Заавал | Валидаци / Тэмдэглэл |
|---|--------|-----------|-------|--------|----------------------|
| 1.1 | **Дэлгүүрийн нэр** | `shops.name` | Text | ✅ Тийм | Хамгийн багадаа **2 тэмдэгт**. Хоосон байж болохгүй ("Дэлгүүрийн нэр оруулна уу") |
| 1.2 | **Эзэмшигчийн нэр** | `shops.owner_name` | Text | ❌ Үгүй | Чөлөөт текст. Default нь нэвтэрсэн хэрэглэгчийн нэр (`user.fullName`) |
| 1.3 | **Утасны дугаар** | `shops.phone` | Tel | ❌ Үгүй | Бөглөвөл яг **8 оронтой** байх ёстой (`/^[0-9]{8}$/`). Алдаа: "Утасны дугаар 8 оронтой байх ёстой" |

> Эх сурвалж: `src/components/setup/ShopInfoStep.tsx`

---

## 🟦 Алхам 2 — Facebook Page холбох

**Гарчиг:** "Facebook Page холбох" — *Messenger чатбот идэвхжүүлэхийн тулд Page холбоно уу*
**Заавал эсэх:** ❌ Үгүй — "Алгасах" товчоор алгасч болно.

| Талбар | DB багана | Тэмдэглэл |
|--------|-----------|-----------|
| Page ID | `shops.facebook_page_id` (unique) | OAuth эсвэл гараар |
| Page нэр | `shops.facebook_page_name` | — |
| Access Token | `shops.facebook_page_access_token` | — |

**Холболтын 2 арга:**
1. **Автоматаар** — "Facebook-ээр холбох" товч → `/api/auth/facebook` OAuth урсгал → хэрэглэгчийн Page-үүд татагдана.
2. **Гараар оруулах** — 3 талбар бөглөнө: *Page нэр*, *Page ID*, *Page Access Token* (textarea).

> Эх сурвалж: `src/components/setup/FacebookStep.tsx`

---

## 🟦 Алхам 3 — Instagram холбох

**Гарчиг:** "Instagram холбох" — *Instagram DM чатбот идэвхжүүлэхийн тулд Business Account холбоно уу*
**Заавал эсэх:** ❌ Үгүй — алгасч болно.

| Талбар | DB багана |
|--------|-----------|
| Business Account ID | `shops.instagram_business_account_id` |
| Username | `shops.instagram_username` |
| Access Token | `shops.instagram_access_token` |

**Холболтын 3 арга:**
1. **Facebook-аар дамжуулан** — Facebook Page-д холбогдсон IG account-уудыг жагсаана.
2. **Шууд Instagram Login** — "Facebook хуудасгүйгээр Instagram-р шууд холбох" (FB Page-гүй дэлгүүрт).
3. **Гараар оруулах** — *Username (@-гүй)*, *Business Account ID*, *Access Token*.

> Эх сурвалж: `src/components/setup/InstagramStep.tsx`
> Тэмдэглэл: `shops.instagram_auth_type` нь `facebook_login` эсвэл `instagram_login` гэж ялгана.

---

## 🟦 Алхам 4 — Бараа / Үйлчилгээ (Products)

**Гарчиг:** Бизнесийн төрлөөс хамаарна — *Бараа / Меню / Үйлчилгээ / Зар*.
**Импорт:** "Нэмэх", "CSV" (Excel/CSV-ээс), "FB Shop" (Facebook Shop-оос) гэсэн 3 сонголт.

Бараа бүрт дараах талбарууд (олон бараа нэмж болно):

| # | Талбар | DB багана | Төрөл | Заавал | Default |
|---|--------|-----------|-------|--------|---------|
| 4.1 | **Төрөл** (Бараа/Үйлчилгээ) | `products.type` | Toggle: `physical` / `service` | ✅ | Бизнес төрлөөс (beauty/service → `service`) |
| 4.2 | **Зураг** | `products.images[]` | File upload | ❌ | — |
| 4.3 | **Нэр** | `products.name` | Text | ✅ * | — |
| 4.4 | **Үнэ (₮)** | `products.price` | Number (DECIMAL) | ✅ * | — |
| 4.5 | **Үлдэгдэл** | `products.stock` | Number | ❌ (зөвхөн `physical`) | `10` |
| 4.6 | **Тайлбар** | `products.description` | Text | ❌ | — |
| 4.7 | **Өнгө / Хувилбар** | `products.colors[]` | Таслалаар (CSV) | ❌ | "Улаан, Хар…" |
| 4.8 | **Хэмжээ / Хугацаа** | `products.sizes[]` | Таслалаар (CSV) | ❌ | "S, M, L…" / "1 цаг, 1 сар…" |

> `*` Зөвхөн **нэр БА үнэ** хоёулаа бөглөгдсөн барааг л хадгална. `colors`/`sizes` нь таслалаар тусгаарлагдан массив болж хадгалагдана. Үйлчилгээ (`service`) бол `stock = null`.
> Эх сурвалж: `src/components/setup/ProductStep.tsx`

---

## 🟦 Алхам 5 — Үйл ажиллагаа (Operations) — *Бизнес төрлөөс хамаарна*

`other` төрлөөс бусад бүх төрөлд харагдана. Бүх утга нь `shops.business_setup_data` (JSONB) дотор хадгалагдана. **Бүгд сонголтоор** (заавал биш).

### 🏬 Дэлгүүр (retail) — "Дэлгүүрийн үйл ажиллагаа"
| Талбар | Key | Төрөл | Сонголт / Хязгаар |
|--------|-----|-------|-------------------|
| Бараа бүртгэх арга | `inventory_method` | Radio | `manual` / `barcode` |
| Агуулахын хаяг | `warehouse_address` | Text | — |
| НӨАТ-д бүртгэлтэй юу? | `tax_registered` | Boolean | — |

### 🍽️ Ресторан (restaurant) — "Ресторан тохиргоо"
| Талбар | Key | Төрөл | Хязгаар |
|--------|-----|-------|---------|
| Ширээний тоо | `table_count` | Number | 0–500 |
| Хүргэлт үзүүлэх үү? | `delivery_enabled` | Boolean | — |
| Хүргэлтийн бүс / дүүрэг | `delivery_zones` | Text (таслалаар) | — |
| Дундаж бэлтгэх хугацаа (мин) | `avg_prep_minutes` | Number | 0–240 |

### 🛠️ Үйлчилгээ (service) — "Үйлчилгээний тохиргоо"
| Талбар | Key | Төрөл | Сонголт / Хязгаар |
|--------|-----|-------|-------------------|
| Ажилтны тоо | `staff_count` | Number | 0–1000 |
| Дундаж хугацаа (мин) | `default_duration_minutes` | Number | 0–600 |
| Захиалга авах хэлбэр | `booking_method` | Radio | `manual` / `calendar` |
| Ажиллах цаг | `business_hours` | Text | "Ня-Ба: 09:00 - 18:00" |

### 🛒 E-commerce (ecommerce) — "Онлайн худалдааны тохиргоо"
| Талбар | Key | Төрөл | Сонголт |
|--------|-----|-------|---------|
| Хүргэлтийн бүс | `shipping_zones` | Text (таслалаар) | — |
| Төлбөрийн арга | `payment_methods` | Multi-checkbox | `card`, `qpay`, `bank_transfer`, `cod` |
| Үлдэгдэл хянах уу? | `inventory_tracking` | Boolean | — |

### 💄 Гоо сайхан (beauty) — "Салоны тохиргоо"
| Талбар | Key | Төрөл | Хязгаар |
|--------|-----|-------|---------|
| Ажилтан/мэргэжилтэн тоо | `staff_count` | Number | 0–100 |
| Салоны хаяг | `salon_address` | Text | — |
| Гэрт нь очиж үйлчилдэг үү? | `services_at_home` | Boolean | — |
| Дундаж хугацаа (мин) | `default_duration_minutes` | Number | 0–600 |

### 🏥 Эрүүл мэнд (healthcare) — "Эрүүл мэндийн байгууллагын тохиргоо"
| Талбар | Key | Төрөл | Хязгаар |
|--------|-----|-------|---------|
| Эмчийн тоо | `doctor_count` | Number | 0–1000 |
| Үндсэн чиглэлүүд | `specialties` | Text (таслалаар) | — |
| Ажиллах цаг | `business_hours` | Text | — |

### 🎓 Боловсрол (education) — "Сургалтын төвийн тохиргоо"
| Талбар | Key | Төрөл | Хязгаар |
|--------|-----|-------|---------|
| Сургалтын төрлүүд | `course_types` | Text (таслалаар) | — |
| Анги дүүргэлтийн дээд хязгаар | `student_capacity` | Number | 0–1000 |
| Ажиллах цаг | `business_hours` | Text | — |

### 🏢 Үл хөдлөх / Авто (realestate_auto) — "Үл хөдлөх / Автоны тохиргоо"
| Талбар | Key | Төрөл | Сонголт / Хязгаар |
|--------|-----|-------|-------------------|
| Чиглэл | `category` | Radio | `realestate` / `auto` / `both` |
| Менежерийн тоо | `agent_count` | Number | 0–500 |
| Үйлчилгээний бүс | `service_areas` | Text | — |

> Хоосон утга (string/null/[]) хадгалахаас өмнө автоматаар шүүгдэнэ.
> Эх сурвалж: `src/lib/constants/business-types.ts`, `src/components/setup/OperationsStep.tsx`

---

## 🟦 Алхам 6 — AI Туслах тохиргоо (AI Setup)

3 дотоод дэд алхамтай: **Identity → Personality → Review**.

### Дэд алхам 1 — Identity
| # | Талбар | DB багана | Төрөл | Заавал | Тэмдэглэл |
|---|--------|-----------|-------|--------|-----------|
| 6.1 | **AI-ийн нэр** | `shops.ai_agent_name` | Text (≤80) | ❌ | Жишээ: "Сүхээ". AI өөрийгөө танилцуулахдаа ашиглана |
| 6.2 | **Дэлгүүрийн тайлбар** | `shops.description` | Textarea | ❌ | "Facebook-ээс татах" товчтой (автоматаар татна) |

### Дэд алхам 2 — Personality
| # | Талбар | DB багана | Заавал | Default | Сонголтууд |
|---|--------|-----------|--------|---------|------------|
| 6.3 | **Харилцааны хэв маяг** | `shops.ai_emotion` | ✅ | `friendly` | `friendly` (Найрсаг 😊), `professional` (Мэргэжлийн 👔), `enthusiastic` (Урам зоригтой 🎉), `calm` (Тайван 🧘), `playful` (Тоглоомтой 🎮) |
| 6.4 | **Борлуулалтын зан** | `ai_settings.cross_cutting.sales_assertiveness` | ❌ | `balanced` | `soft` (Зөөлөн), `balanced` (Тэнцвэртэй), `assertive` (Шулуухан) |
| 6.5 | **Хариултын урт** | `ai_settings.cross_cutting.response_length` | ❌ | `medium` | `short` (Богино), `medium` (Дунд), `long` (Дэлгэрэнгүй) |
| 6.6 | **Emoji хэрэглээ** | `ai_settings.cross_cutting.emoji_usage` | ❌ | `minimal` | `none` (Огт үгүй), `minimal` (Бага), `frequent` (Их) |

### Дэд алхам 3 — Review
| # | Талбар | DB багана | Төрөл | Заавал | Тэмдэглэл |
|---|--------|-----------|-------|--------|-----------|
| 6.7 | **Нарийвчилсан заавар (System Prompt)** | `shops.ai_instructions` | Textarea (8 мөр) | ❌ | Дээрх сонголтоос автоматаар үүснэ. Хэрэглэгч засаж болно |

> Reply-style талбарууд → `/api/ai-settings/config` (PATCH, `cross_cutting` JSONB). Бусад → `/api/shop` (PATCH). `ai_setup_completed_at` timestamp хадгалагдана.
> Эх сурвалж: `src/components/setup/AISetupStep.tsx`, `src/lib/constants/ai-setup.ts`

---

## 🟦 Алхам 7 — Орлогын данс (Payout)

**Гарчиг:** "Орлогын данс тохируулах" — *Борлуулалтын орлого таны дансанд шууд орно. QPay автоматаар идэвхжинэ.*

| # | Талбар | DB багана | Төрөл | Заавал | Тэмдэглэл |
|---|--------|-----------|-------|--------|-----------|
| 7.1 | **Төрөл** | `shops.merchant_type` | Toggle | ✅ | `person` (👤 Хувь хүн) / `company` (🏢 Байгууллага/ХХК). Default `person` |
| 7.2 | **Банк** | `shops.bank_name` | Select | ✅ | 9 банкны жагсаалт (доор) |
| 7.3 | **Данс эзэмшигч** | `shops.account_name` | Text | ✅ | Хоосон байж болохгүй |
| 7.4 | **Дансны дугаар** | `shops.account_number` | Text | ✅ | Хоосон байж болохгүй |
| 7.5 | **Регистрийн дугаар** | `shops.register_number` | Text | ✅ | Person: "РД (жнь: УА12345678)"; Company: "Байгууллагын регистр" |

**Банкны сонголтууд:** Хаан банк, Голомт банк, Худалдаа хөгжлийн банк (TDB), Хас банк, Капитрон банк, Төрийн банк, Богд банк, М банк, Капитал банк.

**Валидаци:** `bank_name && account_name && account_number && register_number` — бүгд бөглөгдөх ёстой. Алдаа: "Банк, данс эзэмшигч, дансны дугаар, регистрийн дугаар заавал бөглөнө үү".

**Онцлог:** Хадгалсны дараа сервер автоматаар QPay merchant бүртгэл хийхийг оролдоно (`qpay_setup` хариу).

> Эх сурвалж: `src/components/setup/PayoutSetupStep.tsx`

---

## 🟦 Алхам 8 — Багц сонгох (Subscription)

**Гарчиг:** "Төлөвлөгөө сонгох" — *Танд тохирсон төлөвлөгөөг сонгоорой*

| # | Элемент | Key | Төрөл | Заавал | Тэмдэглэл |
|---|---------|-----|-------|--------|-----------|
| 8.1 | **3 хоног үнэгүй туршилт** | `subscriptions.status='trialing'` | Card | ❌ | `/api/subscription/start-trial`. Зөвшөөрлүүд шаардана |
| 8.2 | **Тооцооны мөчлөг** | `billing_cycle` | Toggle | ✅ | `monthly` (Сараар) / `yearly` (Жилээр). Default `monthly` |
| 8.3 | **Багц сонгох** | `plan_id` | Card сонгох | ✅ | `/api/subscription/plans`-аас татна |
| 8.4a | **Үйлчилгээний нөхцөл** | `terms_accepted` | Checkbox | ✅ | `/terms` |
| 8.4b | **Нууцлалын бодлого** | `privacy_accepted` | Checkbox | ✅ | `/privacy` |
| 8.4c | **18+ нас баталгаажуулалт** | `age_confirmed` | Checkbox | ✅ | "Би 18 нас хүрсэн болохыг баталж байна" |
| 8.4d | **Маркетингийн зөвшөөрөл** | `marketing_consent` | Checkbox | ❌ | Сонголтоор (и-мэйл хүлээн авах) |

**Заавал зөвшөөрлүүд:** `terms_accepted && privacy_accepted && age_confirmed`. Дутуу бол: "Үйлчилгээний нөхцөл, нууцлалын бодлого болон насны баталгааг хүлээн зөвшөөрнө үү".

**Төлбөр (QPay):** Багц сонгож зөвшөөрсний дараа `/api/subscription/subscribe` → QR код буцаана. `/api/subscription/check-payment`-ийг 3 секунд тутам шалгана. Мобайл дээр банкны апп-ийн deep link харагдана.

> Эх сурвалж: `src/components/setup/SubscriptionStep.tsx`

---

## 📊 Нэгдсэн хүснэгт — Бүх асуумж нэг дор

| Алхам | Талбар | DB багана | Төрөл | Заавал | Default |
|-------|--------|-----------|-------|--------|---------|
| 0 | Бизнесийн төрөл | `shops.business_type` | Radio (9) | ✅ | — |
| 1 | Дэлгүүрийн нэр | `shops.name` | Text (≥2) | ✅ | — |
| 1 | Эзэмшигчийн нэр | `shops.owner_name` | Text | ❌ | user.fullName |
| 1 | Утас | `shops.phone` | Tel (8 орон) | ❌ | — |
| 2 | FB Page ID | `shops.facebook_page_id` | OAuth/гар | ❌ | — |
| 2 | FB Page нэр | `shops.facebook_page_name` | Text | ❌ | — |
| 2 | FB Token | `shops.facebook_page_access_token` | Text | ❌ | — |
| 3 | IG Business ID | `shops.instagram_business_account_id` | OAuth/гар | ❌ | — |
| 3 | IG Username | `shops.instagram_username` | Text | ❌ | — |
| 3 | IG Token | `shops.instagram_access_token` | Text | ❌ | — |
| 4 | Барааны нэр (×N) | `products.name` | Text | ✅* | — |
| 4 | Үнэ (×N) | `products.price` | Decimal | ✅* | — |
| 4 | Бараа төрөл (×N) | `products.type` | Enum | ✅ | physical |
| 4 | Үлдэгдэл (×N) | `products.stock` | Integer | ❌ | 10 |
| 4 | Зураг (×N) | `products.images[]` | File | ❌ | — |
| 4 | Тайлбар (×N) | `products.description` | Text | ❌ | — |
| 4 | Өнгө (×N) | `products.colors[]` | Text[] | ❌ | — |
| 4 | Хэмжээ (×N) | `products.sizes[]` | Text[] | ❌ | — |
| 5 | Үйл ажиллагаа | `shops.business_setup_data` | JSONB | ❌ | {} |
| 6 | AI нэр | `shops.ai_agent_name` | Text (≤80) | ❌ | Template |
| 6 | Дэлгүүрийн тайлбар | `shops.description` | Text | ❌ | — |
| 6 | AI хэв маяг | `shops.ai_emotion` | Enum (5) | ✅ | friendly |
| 6 | Борлуулалтын зан | `ai_settings.cross_cutting.sales_assertiveness` | Enum | ❌ | balanced |
| 6 | Хариултын урт | `ai_settings.cross_cutting.response_length` | Enum | ❌ | medium |
| 6 | Emoji хэрэглээ | `ai_settings.cross_cutting.emoji_usage` | Enum | ❌ | minimal |
| 6 | AI заавар | `shops.ai_instructions` | Text | ❌ | Auto-gen |
| 7 | Merchant төрөл | `shops.merchant_type` | Enum | ✅ | person |
| 7 | Банк | `shops.bank_name` | Select (9) | ✅ | — |
| 7 | Данс эзэмшигч | `shops.account_name` | Text | ✅ | — |
| 7 | Дансны дугаар | `shops.account_number` | Text | ✅ | — |
| 7 | Регистр | `shops.register_number` | Text | ✅ | — |
| 8 | Тооцооны мөчлөг | `billing_cycle` | Radio | ✅ | monthly |
| 8 | Багц | `shops.plan_id` | UUID | ✅* | — |
| 8 | Үйлчилгээний нөхцөл | `terms_accepted` | Boolean | ✅ | false |
| 8 | Нууцлалын бодлого | `privacy_accepted` | Boolean | ✅ | false |
| 8 | Насны баталгаа | `age_confirmed` | Boolean | ✅ | false |
| 8 | Маркетинг зөвшөөрөл | `marketing_consent` | Boolean | ❌ | false |

> `*` Бараа: зөвхөн нэр+үнэтэй бол хадгална. Багц: үнэгүй туршилт ашиглавал заавал биш.

---

## 📂 Холбогдох файлууд

| Зорилго | Зам |
|---------|-----|
| Үндсэн визард | `src/app/setup/page.tsx` |
| Бизнес төрлүүд + Operations | `src/lib/constants/business-types.ts` |
| AI Setup тогтмолууд | `src/lib/constants/ai-setup.ts` |
| Орчуулга (Монгол) | `src/i18n/mn.ts` |
| DB схем | `supabase/migrations/20260429140000_business_type.sql`, `001_initial_schema_safe.sql` |
