# 🏗️ Vertmon Hub Development Instructions

Энэхүү баримт бичиг нь "SmartHub" (Online Shop) системийг "Vertmon Hub" (Real Estate & Sales Automation) систем болгон хувиргах техникийн дэлгэрэнгүй зааварчилгаа юм.

---

## 📅 Phase 1: Setup & Infrastructure (Эхний 7 хоног)

### 1.1 Project Cloning
Одоогийн системийг эвдэхгүйн тулд шинэ фолдер руу хуулна.
```bash
cp -r smarthub vertmon-hub
cd vertmon-hub
# Update package.json name -> "vertmon-hub"
```

### 1.2 New Supabase Project
Шинэ өгөгдлийн бааз (Database) үүсгэх шаардлагатай. Хуучин дэлгүүрийн дататай хольж болохгүй.
1.  Create new project on Supabase: `vertmon-hub-prod`
2.  Update `.env.local` with new `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3.  Run migrations (start fresh):
    *   User & Auth tables (keep same)
    *   **NEW:** Properties table (instead of products)

---

## 🗄️ Phase 2: Database Schema Transformation

### 2.1 "Products" -> "Properties"
Бараа зарах биш, үл хөдлөх хөрөнгө зарах тул бүтцийг өөрчилнө.

**Table: `properties`**
*   `id` (UUID)
*   `shop_id` (UUID) - *Which construction company owns this*
*   `name` (Text) - *Project Name e.g., "Luxury Villa"*
*   `type` (Enum) - *Apartment, House, Office, Land*
*   `price_per_sqm` (Decimal) - *Үнэ м.кв*
*   `total_price` (Decimal) - *Нийт үнэ*
*   `size_sqm` (Decimal) - *Хэмжээ*
*   `rooms` (Integer) - *Өрөөний тоо*
*   `floor` (Text) - *Давхар (e.g., "5/12")*
*   `location_lat` / `location_long` (Float) - *Google Maps coordinates*
*   `status` (Enum) - *Available, Reserved, Sold*
*   `features` (JSONB) - *["Gym", "Garage", "Terrace"]*
*   `images` (Array)

### 2.2 "Orders" -> "Leads" (Deals)
Шууд сагсанд хийж авахгүй, харин "Сонирхол" (Inquiry) үүсгэнэ.

**Table: `leads`**
*   `customer_id` (UUID)
*   `property_id` (UUID)
*   `status` (Enum) - *New, Contacted, Viewing_Scheduled, Offered, Closed*
*   `budget_min` (Decimal)
*   `budget_max` (Decimal)
*   `preferred_location` (Text)
*   `hubspot_deal_id` (String) - *Link to HubSpot*

---

## 🧠 Phase 3: AI Logic Upgrade (The "Realtor" Persona)

### 3.1 System Prompt Update
`src/lib/ai/services/PromptService.ts`-ийг өөрчилж AI-г мэргэжлийн Риелтор болгоно.
```typescript
const REALTOR_PROMPT = `
You are a top-tier Real Estate Agent for [Company Name].
Your goal is not just to answer, but to SELL the lifestyle.
- When asked about price, mention the flexible payment terms (Leasing).
- If user asks for 2-bedroom, check availablity and send BEST options with images.
- ALWAYS try to schedule a viewing: "Та хэзээ ирж үзэх боломжтой вэ?"
`;
```

### 3.2 New AI Tools
`src/lib/ai/tools` дотор шинэ функцүүд нэмнэ:
1.  `search_properties(min_price, max_price, rooms, location)`: Хэрэглэгчийн хүсэлтээр хайлт хийх.
2.  `calculate_loan(amount, percentage)`: Ипотекийн зээлийн тооцоолуур.
3.  `schedule_viewing(property_id, time)`: Уулзалт товлох.

---

## 🖥️ Phase 4: Integrations (Enterprise Value)

### 4.1 HubSpot Integration
`src/lib/integrations/hubspot.ts`
*   **Trigger:** Хэрэглэгч утсаа өгөх эсвэл уулзалт товлох үед.
*   **Action:** HubSpot API руу `POST /crm/v3/objects/contacts` болон `deals` илгээнэ.

### 4.2 Multi-Page Support
`src/lib/facebook/messenger.ts`
*   Database дээр `shops` хүснэгтэд `facebook_pages` (JSONB) багана нэмж, нэг компани олон Page Access Token хадгалах боломжтой болгоно.
*   Webhook ирэх үед `recipient.id` (Page ID)-аар нь ялгаж, зөв Token-ийг ашиглаж хариулна.

---

## 📊 Phase 5: Admin Dashboard UI

1.  **Properties Page:** Excel-ээс олон байр нэг дор хуулах (Import) функцтэй хүснэгт.
2.  **CRM / Deals Board:** Канбан самбар (Trello шиг) - Шинэ Lead, Уулзалт, Гэрээ хийсэн гэсэн багануудтай.
3.  **Analytics:** Facebook Insights графикууд.

---

## 🚀 Execution Strategy (Хэрэгжүүлэх дараалал)

1.  **Week 1:** Clone project, Setup new DB, Create `properties` table.
2.  **Week 2:** Update AI prompts & create `search_properties` tool.
3.  **Week 3:** Admin Dashboard UI (Property management).
4.  **Week 4:** HubSpot Integration & Multi-Page logic.
