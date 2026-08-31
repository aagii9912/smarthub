# Syncly → Lead Generation / Deal CRM рүү шилжих төлөвлөгөө

> Огноо: 2026-08-26 · Статус: Санал (батлагдаагүй)
> Хамрах хүрээ: Бүтээгдэхүүн, өгөгдлийн загвар, AI, тайлан, үнэ, roadmap
> Судалгааны эх сурвалжууд баримт бүрийн дор жагсав.

---

## 0. Шийдвэрийн мөр (positioning)

**Одоо:** Syncly = "Social Commerce" — Messenger/IG дээр AI худалдагч, сагс, захиалга, төлбөр.

**Санал болгож буй:** Syncly = **"Мессежээс гэрээ хүртэл" — Facebook/Instagram-аас ирсэн сонирхогчийг секундэд барьж авч, шалгаруулж, ажилтанд хуваарилж, гэрээ (deal) хүртэл хөтөлдөг Монгол хэлний CRM.**

Гол ялгаа — бид **бараа зардаг** платформоос **сонирхогчийг мөнгө болгодог** платформ болно. Онлайн дэлгүүр нь энэ загварын нэг тохиолдол болж үлдэнэ (архетипээр салгагдана), устгагдахгүй.

**Яагаад энэ нь ажиллах вэ (нэг өгүүлбэрээр):** дэлхийд лид рүү 5 минутын дотор хариулдаг компани нийтдээ ~7% байхад, тэдний хөрвүүлэлт ~21%, 24 цагаас хойш хариулдаг нь 2.3% — ~9 дахин зөрүү. Syncly-ийн AI **секундэд** хариулдаг. Энэ бол зарагдах шалтгаан.

---

## 1. Гүнзгий судалгааны дүгнэлт

### 1.1 Хурд бол гол бүтээгдэхүүн (wedge)

| Үзүүлэлт | Тоо |
|---|---|
| B2B инбаунд лидийн медиан хариу хугацаа (2026) | ~42 цаг |
| 5 минутын дотор хариулдаг баг | ~7% |
| 5 мин дотор хариулсны хөрвүүлэлт | ~21% |
| 24+ цагийн дараа хариулсны хөрвүүлэлт | ~2.3% |
| Огт хариулаагүй (mystery shopper, 1000 компани) | 63.5% |
| Анхны судалгаа (Oldroyd/MIT, 15,000+ лид) | 5 мин дотор → холбогдох магадлал ~100x, шалгарах ~21x |

→ **Бүтээгдэхүүний гол амлалт:** "Танай лид 60 секундын дотор хариу авна. Нэг ч дугаар алдагдахгүй."
Эх сурвалж: [Perspective AI](https://getperspective.ai/blog/lead-response-time-2026-benchmarks-and-what-actually-converts), [Aloware](https://aloware.com/blog/lead-response-time-benchmarks), [Digital Applied](https://www.digitalapplied.com/blog/speed-to-lead-response-time-benchmarks-2026-data-playbook)

### 1.2 Чат нь маягтаас 4-5 дахин сайн лид цуглуулдаг

- AI чат: зочин → лид хөрвүүлэлт **15–25%**; статик вэб маягт: **3–5%**.
- Яриан хэлбэрийн BANT (Budget/Authority/Need/Timeline) нь MEDDIC-тэй бараг ижил чанартай шалгаруулалт өгдөг, сургалтын зардал хамаагүй бага.
- **Асуултын дараалал чухал:** Need → Timeline → Budget → Authority. "Төсөв"-өөр эхэлбэл хүн хаагддаг; "Хэрэгцээ"-гээр эхлэхэд урсгал дуусгах хувь **+34%**.
- **3–5 асуултаас хэтрүүлэхгүй**, 5–8 мессежид тарааж асуух.

→ Энэ нь `lead-capture.ts` дэх одоогийн prompt-ын логиктой аль хэдийн нийцэж байна (эхлээд сонирхол → 1-2 параметр → утас). Гэхдээ **цуглуулсан хариултууд хаана ч хадгалагддаггүй** (доорх 2.2-г үз).
Эх сурвалж: [SetSmart BANT](https://setsmart.io/blog/bant-lead-qualification), [Ovox](https://ovox.ai/learn/do-chatbots-qualify-leads/), [Heeya](https://heeya.fr/en/blog/ai-chatbot-lead-generation-guide-2026)

### 1.3 Лидийн зах зээлийн үнэ өндөр байна — шалгаруулалт нь үнэ цэн

- Meta-гийн дундаж CPL 2026 онд **~$27.66** (өмнөх үеэс ~+20%).
- Үл хөдлөх: **$16.61–51.90** · Эрүүл мэнд: **$41–52** · B2B: **$63.40** · Санхүү: **$155–190**.
- Click-to-Message + instant form хослуулбал CPL **−8%**, хүрэлт **+48%**.
- **Хамгийн чухал тоо:** платформ дээрх $25 CPL нь CRM-ээр шүүгдэхэд $75–150 **CPQL** (чанартай лидийн өртөг) болдог — 3–6 дахин зөрүү.

→ Шалгаруулалт (qualification) бол зөвхөн "функц" биш, **шууд мөнгө хэмнэдэг давхарга**. Syncly-ийн үнэ цэнийг ₮-өөр илэрхийлэх боломж: "Танай 100 лидээс 30 нь чанартай гэдгийг мэдэх нь сарын ₮X зарлагыг зөвтгөнө."
Эх сурвалж: [Enrich Labs](https://www.enrichlabs.ai/blog/meta-ads-benchmarks-2025), [admanage.ai](https://admanage.ai/blog/facebook-ads-cost-per-lead-benchmarks), [27five](https://27five.com/blog/b2b-meta-ads-benchmarks-cpl-cpc-roas/), [Meta for Business](https://www.facebook.com/business/ads/ad-objectives/lead-generation/lead-ads-with-messaging)

### 1.4 Суваг: Монголд Facebook нь дийлэнх

- Facebook Монголын онлайн медиа зах зээлийн **~80%** хүрэлттэй.
- Монголын худалдан авалтын онцлог (аль хэдийн кодод тэмдэглэгдсэн): live/пост дор "**авна 99xxxxxx**" гэж бичих. Энэ нь баруунд байдаггүй, **тусдаа бүтээгдэхүүний давуу тал**.

→ Syncly-ийн `comment_leads` хүснэгт энэ загварыг аль хэдийн барьж авдаг. Энэ бол өрсөлдөгчид (Manychat, Kommo) хийж чадахгүй Монгол-специфик түгжээ.
Эх сурвалж: [ApplabX](https://blog.applabx.com/top-10-digital-marketing-agencies-in-mongolia-in-2026/), [Levorotech](https://levorotech.com/lead-generation-agency-in-mongolia/)

### 1.5 Өрсөлдөгчийн байрлал ба үнэ

| Платформ | Байрлал | Үнэ (жишиг) |
|---|---|---|
| **Manychat** | Social-first, хөнгөн DM автоматжуулалт, креатор/жижиг бизнес | $15/сар (3 суудал, 500 контакт) |
| **Kommo** | Messaging-first CRM, pipeline + Salesbot | **$25/суудал/сар** |
| **respond.io** | Mid-market, олон суваг + AI agent → хүн шилжүүлэг, click-to-chat дагалт | Дээд түвшин |
| **Mekari Qontak** (Индонез) | Omnichannel CRM + WhatsApp API | IDR 400k/сараас (~$25) |

**Syncly-ийн ялгарал:** Монгол хэл (AI prompt, UI, тайлан) + сэтгэгдлээс утас барих загвар + QPay + нутгийн үнэ. Дэлхийн платформууд Монгол руу орох сонирхолгүй, орлоо ч хэл + төлбөрийн ханшид уначихна.
Эх сурвалж: [respond.io Kommo vs Manychat](https://respond.io/blog/kommo-vs-manychat), [respond.io Manychat alternatives](https://respond.io/blog/manychat-alternative), [Qontak pricing](https://qontak.com/en/pricing/)

### 1.6 Pipeline дизайны шилдэг туршлага

- **Lead pipeline** ба **Deal pipeline**-ыг салгах нь шалгараагүй нэрс борлуулалтын дэлгэцийг бөглөрүүлэхээс сэргийлдэг.
- **5–7 багана максимум**: Шинэ → Холбогдсон → Шалгарсан → Санал → Хэлэлцээр → Won / Lost.
- Kanban drag-and-drop + олон зэрэгцээ pipeline (өөр өөр борлуулалтын хөдөлгөөнд).
- CRM-ийн салбарын чиг хандлага: хэвтээ (horizontal) CRM-ээс **босоо (vertical), AI-баяжсан** CRM рүү шилжиж байна.

→ Бид SMB-д зориулж **нэг объект (`leads`) дээр 6 үе шат**-аар эхэлж, дараа нь хэрэгцээ гарвал deal pipeline-ыг салгах замыг нээлттэй үлдээнэ.
Эх сурвалж: [Pipeline CRM](https://pipelinecrm.com/blog/best-pipeline-crm/), [Nimble](https://www.nimble.com/blog/examples-of-sales-pipeline-stages-in-the-crm/), [Dialectica — vertical CRM](https://www.dialectica.io/blog/the-future-of-customer-relationship-management-hyper-personalization-and-the-rise-of-vertical-crm)

### 1.7 ⚠️ Meta-гийн мессежийн бодлого — дизайны хатуу хязгаар

| Дүрэм | Утга |
|---|---|
| **24 цагийн цонх** | Хэрэглэгч бичсэнээс хойш 24 цагийн дотор чөлөөтэй хариулна |
| **`human_agent` tag** | **7 хоног** хүртэл сунгана — гэхдээ **зөвхөн жинхэнэ хүн** бичихэд. Автомат мессеж явуулбал бодлого зөрчил, илгээх эрх хаагдана |
| **Хуучин tag-ууд** | `CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE`, `POST_PURCHASE_UPDATE` → **2026-04-27-с эхлэн error 100**. Ашиглаж болохгүй |
| **Marketing Messages** | Opt-in дээр суурилсан сурталчилгааны дахин холболтын **цорын ганц зөвшөөрөгдсөн зам** (давтамжийн хязгаар, ил тод байдал шаардана) |

→ **Үр дагавар:** "30 хоногийн nurture sequence" гэдэг Messenger дээр **хийж болохгүй**. Syncly-ийн nurture нь:
1. 0–24 цаг — AI автомат (чөлөөтэй)
2. 1–7 хоног — ажилтан гараар (`human_agent`, дотор нь AI зөвлөмж бичнэ, илгээхийг хүн дарна)
3. 7+ хоног — **утас / SMS / дуудлага** (Монголын лид-борлуулалт ямар ч байсан утсаар явдаг) + Marketing Messages opt-in
Эх сурвалж: [Meta Messenger Policy](https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy), [Manychat — tag deprecation](https://community.manychat.com/product-updates/meta-s-deprecation-of-the-message-tags-feature-on-messenger-9010), [keyapi.ai](https://www.keyapi.ai/blog/instagram-messaging-api-policy/)

### 1.8 ⚠️ Хувь хүний мэдээлэл хамгаалах тухай хууль (Монгол)

- 2021-12-17-нд батлагдаж **2022-05-01**-нд хүчин төгөлдөр болсон.
- Мэдээлэл цуглуулах, боловсруулахад **бичгээр эсвэл цахим хэлбэрээр зөвшөөрөл** авах ёстой.
- Маркетингийн боловсруулалтаас **татгалзах эрх** субъектэд байна.
- Торгууль: **₮500,000 – ₮20,000,000**.

→ **Хамгийн өндөр эрсдэлтэй одоо байгаа функц:** `comment_leads.capture_type = 'missed'` — сэтгэгдэлд үлдээсэн утсыг автомат уншиж хадгалж байна. Нээлттэй сэтгэгдэл боловч, үүнийг **маркетингийн зорилгоор** ашиглах нь зөвшөөрөл шаардана.
**Шийдэл:** (a) эхний холбоо барихад зөвшөөрлийн текст үзүүлж бүртгэх, (b) `lead_consents` хүснэгтээр нотолгоо хадгалах, (c) татгалзах ("ТАТГАЛЗАХ" гэж бичих) урсгал, (d) зөвшөөрөлгүй лидийг **bulk маркетингт хэзээ ч оруулахгүй**, зөвхөн 1:1 хариултад ашиглах.
Эх сурвалж: [DLA Piper](https://www.dlapiperdataprotection.com/index.html?t=law&c=MN), [Mondaq](https://www.mondaq.com/data-protection/1181270/new-law-on-protection-of-personal-data-in-mongolia), [Pandectes](https://pandectes.io/blog/mongolias-data-privacy-law-key-features-and-implications-explained/)

---

## 2. Одоогийн кодын бэлэн байдал

### 2.1 Аль хэдийн байгаа (дахин ашиглана — эргэж бичих шаардлагагүй)

| Хөрөнгө | Байршил | Тэмдэглэл |
|---|---|---|
| `lead_capture` агентын role + Монгол prompt | `src/lib/ai/agents/roles/lead-capture.ts` | Үл хөдлөх/автомашины жишээ аль хэдийн бичигдсэн |
| Dashboard **archetype** систем (`commerce` / `booking` / **`lead`**) | `src/lib/dashboard/archetypes.ts` | Pivot-ын суурь энд аль хэдийн тавигдсан |
| Бизнесийн төрөл: `realestate_auto`, `education`, `healthcare` | `src/lib/constants/business-types.ts` | Босоо зах зээлүүд бүртгэгдсэн |
| `comment_leads` хүснэгт (утас задлах, `capture_type`, funnel индекс) | `supabase/migrations/20260629120000_*`, `...130000_*` | Монгол-специфик түгжээ |
| `LeadsReport` тайлангийн блок | `src/app/api/dashboard/reports/route.ts:33` | Байгаа — гэхдээ прокси тоо (доор) |
| `book_appointment` / `appointments` | `src/lib/ai/tools/definitions/appointment.ts` | Үзлэг/уулзалт товлоход дахин ашиглана |
| `shop_members` RBAC | `20260616120000_shop_members_rbac.sql` | Лид **хуваарилах** (owner) суурь бэлэн |
| Push notification, QPay, credit/token тооцоо, Excel export flag | олон газар | Хэвээр ашиглана |

### 2.2 Дутуу / хаалт болж буй зүйлс

| # | Асуудал | Байршил | Нөлөө |
|---|---|---|---|
| **B1** | **Лид гэдэг обьект байхгүй.** Лид нь `customers` мөр болж хадгалагддаг. Үе шат, эзэн, дүн, дараагийн алхам гэж юу ч байхгүй | `CustomerHandlers.ts` | Deal хийх боломжгүй — pivot-ын гол хаалт |
| **B2** | `collect_contact_info` **`next_action: 'create_order'`, `auto_checkout: true`-г хатуу бичсэн** | `src/lib/ai/tools/handlers/CustomerHandlers.ts` | `lead_capture` shop дээр ч AI захиалга үүсгэх гэж оролдоно — буруу зан төлөв |
| **B3** | Тайлангийн "лид" нь **прокси тоо**: `qualified = утас байгаа эсэх`, `converted = total_orders > 0` | `reports/route.ts:313-338` | Үл хөдлөх зуучид "converted" хэзээ ч 1 болохгүй (order үүсгэдэггүй) |
| **B4** | `appointments.product_id` **NOT NULL → products** | `appointments` migration | Үйлчилгээ/лид бизнес хуурамч "бараа" үүсгэх шаардлагатай |
| **B5** | Шалгаруулалтын өгөгдөл (төсөв, хугацаа, байршил) **хадгалагддаггүй** — зөвхөн prompt дотор асуудаг | `lead-capture.ts` | Ангилах, оноо өгөх боломжгүй |
| **B6** | `leads` хүснэгтийн нэр **эзэлчихсэн** — маркетингийн вэб маягтын global хүснэгт (`shop_id` байхгүй, service-role уншина) | `20260428110000_drift_recovery.sql:123`, `src/app/api/leads/route.ts` | Нэрийн мөргөлдөөн |
| **B7** | Дараагийн алхам / сануулга / task engine байхгүй | — | "Маргааш залга" гэдгийг систем санахгүй |
| **B8** | Нэг хүн (сэтгэгдэл + DM + утас) **давхардана**, нэгтгэх урсгал байхгүй | — | Тайлан хий үлээнэ |
| **B9** | Зөвшөөрлийн бүртгэл байхгүй | — | Хууль зүйн эрсдэл (1.8) |

---

## 3. Бүтээгдэхүүний тодорхойлолт

### 3.1 Гурван үндсэн үйлдэл

```
ЦУГЛУУЛАХ  →  АНГИЛАХ  →  ХӨТЛӨХ  →  ТАЙЛАГНАХ
(capture)     (qualify)    (deal)      (report)
```

**1. ЦУГЛУУЛАХ** — бүх суваг нэг хайрцаг руу
- Messenger / Instagram DM (AI шууд)
- Пост / Live сэтгэгдэл (`comment_leads` — "авна 99xxxxxx")
- Story reply (IG)
- Meta Click-to-Message / Lead Ads (шинэ интеграц)
- Гараар нэмэх, Excel import, вэб маягт

**2. АНГИЛАХ** — AI яриа дундаас BANT-lite задлах
- Хэрэгцээ (юу сонирхож байна) → Хугацаа → Төсөв → Шийдвэр гаргагч
- Автомат оноо 0–100 → **Халуун / Дулаан / Хүйтэн**
- Автомат таг: байршил, марк, хөтөлбөр гэх мэт (босоо багцаас)

**3. ХӨТЛӨХ (deal)** — Kanban самбар
- 6 үе шат: **Шинэ → Холбогдсон → Шалгарсан → Уулзалт/Үзлэг → Санал → Won/Lost**
- Лид бүрд: **эзэн** (ажилтан), **дүн ₮**, **хаагдах огноо**, **дараагийн алхам + огноо**
- Хугацаа хэтэрсэн лид улаанаар, push мэдэгдэл

**4. ТАЙЛАГНАХ**
- Юүнэл (үе шат бүрийн тоо + хувь)
- **Эхний хариу өгсөн хугацаа** (медиан, <5 мин хувь) ← гол зарагдах график
- Эх сурвалжийн задаргаа (сэтгэгдэл / DM / зар / story)
- Ажилтны самбар (лид, won, win rate, дундаж дүн, хариу хугацаа)
- Алдагдсан шалтгаан
- Урьдчилсан таамаг (pipeline дүн × үе шатны магадлал)
- **Алдсан лид** (`capture_type='missed'`) — "Та 30 дугаар алдсан байна"
- Excel / PDF экспорт

### 3.2 Босоо багцууд (vertical packs) — v1-д 2-ыг л сонгоно

| Босоо | Шалгаруулах талбар | Үе шатны нэр | Deal дүн |
|---|---|---|---|
| **Үл хөдлөх / Авто** ⭐ | байршил, өрөө, м², төсөв, зээл эсэх / марк, он, гүйлт, төсөв | Үзлэг товлосон → Санал → Гэрээ | ₮ өндөр, суудлын үнэ зөвтгөнө |
| **Сургалт / Боловсрол** ⭐ | хөтөлбөр, эхлэх огноо, түвшин, төлбөрийн боломж | Сорил → Бүртгэл → Төлбөр | Багц ₮ |
| Эмнэлэг / Гоо сайхан | үйлчилгээ, эмч, цаг | Цаг товлосон → Ирсэн → Дараагийн | `appointments`-той нийлнэ |
| Даатгал / Зээлийн зуучлал | бүтээгдэхүүн, дүн, орлого | Тооцоолол → Материал → Гэрээ | Комисс |
| Барилга / Интерьер | талбай, төсөв, хугацаа | Хэмжилт → Төсөв → Гэрээ | ₮ маш өндөр |

**Зөвлөмж:** Phase 1-д **Үл хөдлөх/Авто** + **Сургалт** хоёрыг л барь. `realestate_auto`, `education` аль хэдийн `business-types.ts`-д байгаа, `lead-capture.ts` prompt нь үл хөдлөхийн жишээтэй.

---

## 4. Өгөгдлийн загвар (migration төлөвлөгөө)

### 4.0 Нэрийн мөргөлдөөн эхлээд шийднэ (B6)

```sql
-- Одоо байгаа global маркетингийн маягтын хүснэгтийг нэрлэж өгнө
ALTER TABLE public.leads RENAME TO website_inquiries;
```
`src/app/api/leads/route.ts`-г шинэ нэр рүү заана (нөлөөлөх талбай = 1 route). Дараа нь `leads` нэрийг жинхэнэ CRM обьектод өгнө.

### 4.1 Pipeline / үе шат

```sql
CREATE TABLE public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  key TEXT NOT NULL,                 -- 'new' | 'contacted' | 'qualified' | 'meeting' | 'proposal' | 'won' | 'lost'
  name TEXT NOT NULL,                -- Монгол нэр
  position INT NOT NULL,
  probability INT NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (pipeline_id, key)
);
```
Shop үүсэхэд босоо төрлөөс хамаарсан **default pipeline** автоматаар үүснэ (`business_type` → template).

### 4.2 Лид (гол обьект)

```sql
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id),
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),

  -- Таних мэдээлэл
  full_name TEXT,
  phone TEXT,
  phone_normalized TEXT,             -- 8 оронтой, зөвхөн тоо
  email TEXT,
  platform TEXT CHECK (platform IN ('facebook','instagram','phone','web','manual','import')),
  external_id TEXT,                  -- PSID / IGSID
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Эх сурвалж (attribution)
  source TEXT NOT NULL DEFAULT 'dm'
    CHECK (source IN ('comment','dm','story','ad','manual','import','referral','web_form')),
  source_ref TEXT,                   -- post_id / ad_id / campaign
  comment_lead_id UUID REFERENCES comment_leads(id) ON DELETE SET NULL,

  -- Шалгаруулалт (BANT-lite, босоо талбарууд JSONB-д)
  interest TEXT,
  qualification JSONB NOT NULL DEFAULT '{}'::jsonb,
     -- {need, timeline, budget_min, budget_max, authority, location, rooms, brand, year, program...}
  score INT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  score_band TEXT NOT NULL DEFAULT 'cold' CHECK (score_band IN ('hot','warm','cold')),
  score_reason TEXT,

  -- Deal
  value_mnt NUMERIC(14,2),
  expected_close_date DATE,
  owner_id UUID,                     -- shop_members.user_id
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost')),
  lost_reason TEXT,

  -- SLA / дараагийн алхам
  first_response_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  next_action_note TEXT,

  -- Зөвшөөрөл (шуурхай шүүлт хийхэд)
  consent_status TEXT NOT NULL DEFAULT 'none'
    CHECK (consent_status IN ('explicit','implied_public','none','revoked')),

  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  duplicate_of UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_board       ON leads(shop_id, stage_id, updated_at DESC) WHERE status='open';
CREATE INDEX idx_leads_owner_due   ON leads(shop_id, owner_id, next_action_at)  WHERE status='open';
CREATE INDEX idx_leads_phone       ON leads(shop_id, phone_normalized)          WHERE phone_normalized IS NOT NULL;
CREATE INDEX idx_leads_created     ON leads(shop_id, created_at DESC);
CREATE INDEX idx_leads_qual        ON leads USING GIN (qualification);
```

> **Давхардал (B8):** хатуу `UNIQUE(shop_id, phone)` тавихгүй — нэг хүн 2 өөр байр сонирхож болно. Оронд нь insert үед `phone_normalized`-аар илрүүлж `duplicate_of` тавьж, UI-д "Нэгтгэх" товч гаргана.

### 4.3 Үйл ажиллагаа / даалгавар

```sql
CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN
    ('note','call','message_in','message_out','stage_change','task','meeting','system')),
  body TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {from_stage, to_stage, duration, channel...}
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('ai','user','system')),
  actor_id UUID,
  due_at TIMESTAMPTZ,                        -- type='task'
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);
CREATE INDEX idx_lead_tasks_due       ON lead_activities(shop_id, due_at)
  WHERE type='task' AND done_at IS NULL;
```

### 4.4 Зөвшөөрлийн бүртгэл (хууль)

```sql
CREATE TABLE public.lead_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('messenger','instagram','phone','web')),
  basis TEXT NOT NULL CHECK (basis IN ('consent','contract','public_comment')),
  text_shown TEXT NOT NULL,          -- яг ямар текст үзүүлснийг нотолгоо болгон хадгална
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {message_id, comment_id, ip, ts}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.5 RLS болон аюулгүй байдал (заавал)

- Бүх шинэ хүснэгтэд RLS: `shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid()::text)` **+ `shop_members`-ээр өргөтгөх**.
- ⚠️ **`x-shop-id` header-т хэзээ ч бүү итгэ.** Шинэ `/api/dashboard/leads/*` route бүр `getAuthUserShop()`-оор эзэмшлийг шалгана (өмнөх IDOR сургамж).
- `appointments.product_id` NOT NULL-ыг **nullable** болгож, `lead_id` нэмнэ (B4).

---

## 5. AI-д хийх өөрчлөлт

### 5.1 `collect_contact_info` дэх хатуу ecommerce таамаглалыг засах (B2 — эхний ажил)

Одоо `CustomerHandlers.ts` бүх тохиолдолд `next_action: 'create_order'`, `auto_checkout: true` буцаана. Үүнийг **архетипээс хамааруулна**:

```
archetype === 'commerce' → next_action: 'create_order'
archetype === 'lead'     → next_action: 'qualify_lead'   (лид үүсгээд шалгаруулалт үргэлжлүүлнэ)
archetype === 'booking'  → next_action: 'book_appointment'
```

### 5.2 Шинэ tool-ууд

| Tool | Үүрэг |
|---|---|
| `create_lead` | Яриа лид болж хувирахад `leads` мөр үүсгэнэ (эсвэл давхардлыг олно) |
| `qualify_lead` | BANT-lite талбарыг `qualification` JSONB рүү бичнэ (need/timeline/budget/authority + босоо талбар) |
| `set_lead_interest` | Юу сонирхож байгааг бичнэ (үл хөдлөхийн байршил, автомашины марк г.м.) |
| `handoff_to_rep` | Эзэн ажилтан хуваарилж push илгээнэ (`request_human_support`-ыг өргөтгөнө) |
| `schedule_viewing` | `book_appointment`-ыг лидтэй холбоно (product_id заавал биш) |

### 5.3 Оноолт (scoring) — v1 дүрэмд суурилсан, тайлбарлагдах

```
+30  утас байгаа
+20  төсөв тодорхойлсон
+20  хугацаа < 30 хоног
+10  3+ мессеж бичсэн (идэвх)
+10  босоо шалгуур таарсан (байршил/марк/хөтөлбөр)
+ 5  төлбөрт зараас ирсэн (source='ad')
−15  48 цаг хариугүй
−20  зөвшөөрөл байхгүй (consent_status='none')
```
`≥60` = **Халуун** · `30–59` = **Дулаан** · `<30` = **Хүйтэн**

> v1-д AI-аар оноо тооцохгүй — дүрэм нь үнэгүй, шууд, тайлбарлагдана ("Яагаад халуун вэ?" гэдэгт хариулна). v2-д яриа дуусахад **нэг удаа** Gemini-гээр дүгнэлт гаргаж `score_reason`-д хадгална (credit зарцуулалт хянагдана).

### 5.4 Prompt-ын шинэчлэл

`lead-capture.ts`-д Need → Timeline → Budget → Authority дараалал (судалгаа 1.2) болон **"нэг удаад 1 асуулт, нийт 3–5 асуулт"** хязгаарыг тодорхой бич. Босоо багц бүрд өөр асуултын багц (`business_setup_data`-аас).

---

## 6. Тайлангийн шинэчлэл (B3)

`reports/route.ts`-ийн `LeadsReport`-ыг прокси тооноос **жинхэнэ pipeline өгөгдөл** рүү шилжүүлнэ:

```ts
interface LeadsReport {
  newLeads: number;
  byStage: Record<string, number>;          // үе шат бүрийн тоо
  qualified: number;                        // stage.position >= qualified
  won: number; lost: number;
  winRate: number;                          // won / (won + lost)
  pipelineValue: number;                    // Σ value_mnt (open)
  forecast: number;                         // Σ value_mnt × stage.probability
  avgDealValue: number;
  responseTime: {                           // ⭐ гол зарагдах хэсэг
    medianSeconds: number;
    under5MinPct: number;
    over24hCount: number;
  };
  bySource: Record<'comment'|'dm'|'story'|'ad'|'manual', number>;
  byOwner: Array<{ ownerId, name, leads, won, winRate, avgResponseSec }>;
  lostReasons: Array<{ reason: string; count: number }>;
  missedLeads: number;                      // comment_leads capture_type='missed'
  daily: DailyPoint[];
}
```

**Тайлангийн UI-д гарах "мөнгөний өгүүлбэр":**
> "Энэ сард 214 лид ирсэн. 168 нь 1 минутын дотор хариу авсан. 46 нь шалгарсан. 12 гэрээ хийгдсэн — нийт ₮184,000,000. Урьдчилсан таамаг ₮96,000,000. **Танай зар дээрх 30 дугаар авагдаагүй үлдсэн байна** →"

---

## 7. Үнэ, багц

**Асуудал:** одоогийн үнийн загвар (credit/token) нь AI хэрэглээг хэмждэг. Гэтэл lead CRM-ийн үнэ цэн нь **суудал (ажилтан)** ба **лидийн урсгал**-аар хэмжигддэг. Kommo $25/суудал/сар-аар зардаг нь санамсаргүй биш.

**Зөвлөмж — 3 хэмжигдэхүүнтэй эрлийз загвар:**

```
Суурь = суудлын тоо  +  сарын идэвхтэй лид  +  AI credit
```

| Багц | Суудал | Идэвхтэй лид/сар | Онцлог |
|---|---|---|---|
| **Lead Start** | 2 | ~300 | Kanban, шалгаруулалт, суурь тайлан |
| **Lead Pro** | 5 | ~1,500 | Оноолт, forecast, ажилтны самбар, экспорт, дараагийн алхмын сануулга |
| **Lead Business** | 10+ | Тохиролцоно | Олон pipeline, API, босоо багц, зөвшөөрлийн audit |

**Ханшийн лавлагаа (₮ тоог тусад нь загварчлах — доорх нь зөвхөн байрлалын лавлагаа):**
- Kommo ≈ $25/суудал/сар → 5 суудал ≈ $125/сар
- Manychat $15/сар (3 суудал, 500 контакт) — доод хил
- Meta-д Монголд лид авахад CPL-ийн жишиг $16–52 → **10 лид ≈ $160–520**. Тиймээс CRM-ийн сарын үнэ 1–3 лидийн өртөгтэй тэнцүү байвал ROI нь ойлгомжтой.

> ⚠️ Хуучин ₮ түвшнүүд (`plans.ts`) руу бүү бэхлэгд — тэдгээр нь дэлгүүрийн загварт зориулагдсан. Lead багцыг **шинээр загварчлах** ёстой. `Syncly_Plan_Margin_Model.xlsx` дээр lead sheet нэмж, суудал × лид × credit гурвыг оруулж margin шалгана.

**Шилжилтийн дүрэм:** одоо байгаа commerce хэрэглэгчид үнэ өөрчлөгдөхгүй. Lead багц бол **шинэ SKU**, шинэ ICP-д зарагдана.

---

## 8. Roadmap (12 долоо хоног)

### Phase 0 — Батлах (1 дх)
- [ ] 2 босоо сонгох: **Үл хөдлөх/Авто** + **Сургалт**
- [ ] 5 пилот бизнестэй ярилцлага: одоо лидээ юугаар удирддаг вэ? (Excel? тэмдэглэлийн дэвтэр? Messenger өөрөө?)
- [ ] "Хэдэн лид алдсанаа мэдэх нь хэдэн ₮-ийн үнэтэй вэ" гэдгийг тэднээр хэлүүлэх → үнийн таамаглал батлах
- **Гарц:** батлагдсан ICP + үнийн таамаглал

### Phase 1 — Лидийн суурь (3 дх)
- [ ] `leads` → `website_inquiries` нэр солих + `/api/leads/route.ts` засах (B6)
- [ ] `pipelines`, `pipeline_stages`, `leads`, `lead_activities` migration + RLS
- [ ] Босоо төрлөөр default pipeline template
- [ ] `collect_contact_info`-ийн архетип-мэдрэмжтэй `next_action` (B2)
- [ ] `comment_leads` → `leads` гүүр (аль хэдийн барьсан утсууд бүгд лид болно)
- [ ] Kanban самбар UI (`/dashboard/leads`) — drag & drop, эзэн хуваарилах, дүн оруулах
- [ ] `/api/dashboard/leads/*` route-ууд — **`getAuthUserShop()` заавал**
- **Гарц:** гэрээ хөтлөх боломжтой самбар

### Phase 2 — Шалгаруулалт ба SLA (2 дх)
- [ ] `create_lead`, `qualify_lead`, `handoff_to_rep` tool-ууд
- [ ] `lead-capture.ts` prompt: Need→Timeline→Budget→Authority, 3–5 асуулт
- [ ] Дүрэмд суурилсан оноо + Халуун/Дулаан/Хүйтэн
- [ ] `next_action_at` + хугацаа хэтэрсэн push мэдэгдэл (одоо байгаа cron дээр)
- [ ] Давхардал илрүүлэх + нэгтгэх
- **Гарц:** "Өнөөдөр 6 халуун лид, 3 нь хугацаа хэтэрсэн"

### Phase 3 — Тайлан v2 (2 дх)
- [ ] `LeadsReport` бүрэн шинэчлэл (6-р бүлэг)
- [ ] Хариу өгсөн хугацааны график (гол зарагдах хэсэг)
- [ ] Ажилтны самбар, алдагдсан шалтгаан, forecast
- [ ] Excel / PDF экспорт (`excelExport` flag дахин ашиглана)
- **Гарц:** сар бүр илгээх тайлан → сунгалтын шалтгаан

### Phase 4 — Хууль зүйн бэхжилт (1–2 дх)
- [ ] `lead_consents` + эхний холбоо барихад зөвшөөрлийн текст
- [ ] "ТАТГАЛЗАХ" урсгал → `consent_status='revoked'`, bulk-аас хасах
- [ ] `capture_type='missed'` лидийг **bulk-д хэзээ ч оруулахгүй** гэсэн хатуу хамгаалалт
- [ ] Нууцлалын бодлого шинэчлэх, shop-д зориулсан заавар
- **Гарц:** ₮20 сая хүртэлх торгуулийн эрсдэл хаагдана

### Phase 5 — Дагалт (nurture) (2 дх)
- [ ] 0–24ц AI автомат · 1–7 хоног `human_agent` (AI ноорог бичнэ, **хүн илгээнэ**)
- [ ] 7+ хоног: утас/SMS даалгавар + Marketing Messages opt-in
- [ ] Хуучин message tag-уудыг кодоос устгасан эсэхийг шалгах (2026-04-27-с error 100)
- **Гарц:** бодлого зөрчихгүй дагалтын систем

### Phase 6 — Босоо багц (2 дх)
- [ ] Үл хөдлөх/Авто: талбар, үе шат, тайлангийн загвар
- [ ] Сургалт: хөтөлбөр, элсэлтийн үе шат
- [ ] `appointments.product_id` nullable + `lead_id` (B4) → үзлэг/уулзалт лидтэй холбогдоно
- **Гарц:** "Үл хөдлөхийн CRM" гэж зарагддаг бүтээгдэхүүн

---

## 9. Амжилтын хэмжүүр

**Бүтээгдэхүүн (shop-д харагдах):**
- Эхний хариу медиан **< 60 сек** (AI), 95% нь < 5 мин
- Алдагдсан лид (`missed`) **сар бүр буурах**
- Лид → уулзалт хувь, Лид → won хувь (суурь → 30 хоногийн дараа)

**Бизнес (Syncly-д):**
- Пилот 5 → төлбөрт 20 lead-shop (6 сар)
- Lead багцын ARPU нь commerce ARPU-аас **≥1.5x**
- Суудлын тоо/shop ≥ 2 (суудлын загвар ажиллаж байгаагийн шинж)
- Lead shop-ын 6 сарын retention ≥ 80% (CRM нь дэлгүүрийн ботоос наалдамхай — өгөгдөл нь дотор нь хуримтлагдана)

---

## 10. Эрсдэл ба сааруулалт

| Эрсдэл | Магадлал | Сааруулалт |
|---|---|---|
| Meta 24ц/7 хоногийн бодлого дагалтыг хаана | Өндөр | Дизайныг эхнээс нь утас/SMS fallback-тай (7-р бүлэг). Автомат мессежийг `human_agent`-аар **хэзээ ч бүү** явуул |
| PDPL зөрчил (`missed` лид) | **Өндөр** | Phase 4-ийг хойш бүү тавь. Зөвшөөрөлгүй лидийг зөвхөн 1:1 хариултад ашигла |
| Одоогийн commerce хэрэглэгчид эвдрэх | Дунд | Archetype-аар салгана; commerce урсгалд нэг ч мөр өөрчлөгдөхгүй. `next_action` засварт тест заавал |
| "Хоёр бүтээгдэхүүн" болж баг тарах | Дунд | Нэг цөм (AI + inbox + billing), гурван архетип. Тусдаа код бааз **бүү** үүсгэ |
| Хэрэглэгч Kanban ойлгохгүй | Дунд | Анхдагч 6 үе шат бэлэн, "гар аргаар тохируулах" сонголтыг v2 хүртэл нуу. Утсан дээр жагсаалт хэлбэрээр |
| Лидийн өгөгдөл бохирдох (давхардал) | Өндөр | `phone_normalized` + `duplicate_of` + нэгтгэх UI-г Phase 2-т багтаа |
| Босоо хэт олон зэрэг барих | Өндөр | v1-д **зөвхөн 2** |

---

## 11. Дараагийн шууд алхам (энэ долоо хоног)

1. **Босоо 2-ыг батал** — үл хөдлөх/авто + сургалт (эсвэл өөр).
2. **5 пилот бизнес ол** — одоогийн `realestate_auto` / `education` төрөлтэй shop байгаа эсэхийг DB-ээс шалга.
3. **B2 засвар** (`collect_contact_info`-ийн `create_order` таамаглал) — 1 өдрийн ажил, шууд хийж болно.
4. **B6 нэр солих** — `leads` → `website_inquiries`, дараагийн бүх migration-ы зам нээгдэнэ.
5. Үнийн загварыг `Syncly_Plan_Margin_Model.xlsx`-д lead sheet болгон нэм.

---

## Хавсралт: судалгааны эх сурвалжууд

**Хурд / хөрвүүлэлт**
- [Perspective AI — Lead Response Time 2026](https://getperspective.ai/blog/lead-response-time-2026-benchmarks-and-what-actually-converts)
- [Aloware — Lead Response Time Benchmarks 2026](https://aloware.com/blog/lead-response-time-benchmarks)
- [Digital Applied — Speed-to-Lead Benchmarks 2026](https://www.digitalapplied.com/blog/speed-to-lead-response-time-benchmarks-2026-data-playbook)

**Шалгаруулалт / BANT**
- [SetSmart — BANT Lead Qualification AI-Adapted 2026](https://setsmart.io/blog/bant-lead-qualification)
- [Ovox — How Do Chatbots Qualify Leads](https://ovox.ai/learn/do-chatbots-qualify-leads/)
- [Heeya — AI Chatbot Lead Generation Playbook 2026](https://heeya.fr/en/blog/ai-chatbot-lead-generation-guide-2026)

**Зар / CPL**
- [Enrich Labs — Meta Ads Benchmarks 2026](https://www.enrichlabs.ai/blog/meta-ads-benchmarks-2025)
- [admanage.ai — Facebook Ads CPL by Industry 2026](https://admanage.ai/blog/facebook-ads-cost-per-lead-benchmarks)
- [27five — B2B Meta Ads Benchmarks 2026](https://27five.com/blog/b2b-meta-ads-benchmarks-cpl-cpc-roas/)
- [Meta for Business — Lead Ads that Click to Message](https://www.facebook.com/business/ads/ad-objectives/lead-generation/lead-ads-with-messaging)

**Meta бодлого**
- [Messenger Platform & IG Messaging API Policy](https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy)
- [Manychat — Message Tags deprecation](https://community.manychat.com/product-updates/meta-s-deprecation-of-the-message-tags-feature-on-messenger-9010)
- [keyapi.ai — Instagram 24-Hour Window 2026](https://www.keyapi.ai/blog/instagram-messaging-api-policy/)

**Монголын хууль / зах зээл**
- [DLA Piper — Data protection laws in Mongolia](https://www.dlapiperdataprotection.com/index.html?t=law&c=MN)
- [Mondaq — New Law on Protection of Personal Data in Mongolia](https://www.mondaq.com/data-protection/1181270/new-law-on-protection-of-personal-data-in-mongolia)
- [Pandectes — Mongolia's Data Privacy Law](https://pandectes.io/blog/mongolias-data-privacy-law-key-features-and-implications-explained/)
- [ApplabX — Top Digital Marketing Agencies in Mongolia 2026](https://blog.applabx.com/top-10-digital-marketing-agencies-in-mongolia-in-2026/)

**Өрсөлдөгч / CRM дизайн**
- [respond.io — Kommo vs Manychat vs respond.io](https://respond.io/blog/kommo-vs-manychat)
- [respond.io — Best Manychat Alternatives 2026](https://respond.io/blog/manychat-alternative)
- [Qontak — Pricing](https://qontak.com/en/pricing/)
- [Pipeline CRM — Best Pipeline CRM 2026](https://pipelinecrm.com/blog/best-pipeline-crm/)
- [Nimble — Sales Pipeline Stage Examples](https://www.nimble.com/blog/examples-of-sales-pipeline-stages-in-the-crm/)
- [Dialectica — Rise of Vertical CRM](https://www.dialectica.io/blog/the-future-of-customer-relationship-management-hyper-personalization-and-the-rise-of-vertical-crm)
- [Mordor Intelligence — SEA CRM Market](https://www.mordorintelligence.com/industry-reports/south-east-asia-crm-market)
