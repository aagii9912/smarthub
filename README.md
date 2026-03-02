# Syncly 🚀

**Social Commerce AI Platform — Facebook & Instagram бизнес менежмент**

> Syncly нь Facebook Messenger болон Instagram DM-ээр ирсэн хүсэлтүүдийг AI-гаар автоматаар боловсруулж, борлуулалт, захиалга, харилцагчийн удирдлагыг нэг дор гүйцэтгэдэг платформ юм.

🌐 **Live:** [https://www.syncly.mn](https://www.syncly.mn)

---

## ✅ Хийж чаддаг зүйлс (Production)

### 🤖 AI Борлуулалтын Agent
- Google Gemini AI ашиглан харилцагчтай автоматаар харилцах
- Function Calling: бүтээгдэхүүн хайх, сагсанд нэмэх, захиалга үүсгэх, stock шалгах
- Харилцагчийн зураг таних (бүтээгдэхүүний зураг илгээх боломж)
- AI тохиргоо: арга хэв, зан чанар зэргийг дэлгүүр тус бүрд тохируулах боломж
- Чат түүх хадгалах, контекст санах

### 💬 Facebook & Instagram Integration
- Facebook Messenger webhook — мессеж автоматаар хүлээн авч хариулах
- Instagram DM webhook — Instagram мессеж боловсруулах
- Comment Automation — Facebook/Instagram постын comment-д автоматаар хариулж, DM илгээх
- Facebook Page холболт (Page Access Token)
- Instagram Business Account холболт

### 📊 Dashboard
- Real-time статистик (өнөөдрийн захиалга, орлого, харилцагч тоо)
- Бүтээгдэхүүн удирдах (CRUD, зураг, үнэ, stock)
- Захиалга удирдах (pending → confirmed → shipped → delivered)
- Харилцагчийн жагсаалт + CRM (VIP автоматаар тодорхойлох)
- Inbox — бүх чат харилцааг нэг дор харах
- Comment Automation тохиргоо
- AI тохиргоо хуудас
- Reports хуудас
- Гомдол/Complaint удирдлага

### 🔐 Authentication (Supabase Auth)
- Email/Password нэвтрэлт
- Google OAuth нэвтрэлт
- Facebook OAuth нэвтрэлт
- Session-based middleware route protection

### 🛒 Захиалга & Сагс
- Cart систем (AI-аар сагсанд нэмэх)
- Захиалга үүсгэх, статус шинэчлэх
- Захиалга notification (push)
- Stock автоматаар хасах

### 💰 Subscription & Plans
- Free / Starter / Pro / Ultimate plan-ууд
- Plan-аар feature хязгаарлалт (AI model, max messages, max shops)
- Subscription удирдлага хуудас

### 🛡️ Admin Panel
- Super Admin dashboard
- Бүх дэлгүүрүүдийг удирдах (идэвхжүүлэх/хаах, plan солих)
- Plan тохиргоо
- Subscription удирдлага
- Invoice харах
- Landing page контент засах

### 🔔 Push Notifications
- Web Push (VAPID) notification
- Захиалга ирэхэд мэдэгдэл илгээх

### 📄 Бусад
- Landing page (маркетинг хуудас)
- Privacy Policy, Terms of Service хуудсууд
- Health check endpoint
- Feedback систем
- Data Deletion хүсэлт (Meta requirement)

---

## ❌ Хийж чадахгүй / Дутুу зүйлс

| Чиглэл | Статус | Тайлбар |
|---------|--------|---------|
| 💳 QPay / SocialPay төлбөр | ❌ Хийгдээгүй | Төлбөрийн интеграц бүрэн дуусаагүй |
| 🧾 Invoice PDF үүсгэх | ⚠️ Хэсэгчлэн | Invoice route байгаа, PDF генерацийн бүрэн бий болгоогүй |
| 📧 Email notification | ⚠️ Суурь бий | Resend SDK суусан, бүрэн хэрэгжээгүй |
| 📊 Дэлгэрэнгүй analytics | ⚠️ Суурь бий | Reports хуудас бий, chart/graph дутуу |
| 📱 Mobile app | ❌ Байхгүй | Зөвхөн web (responsive) |
| 🌐 Multi-language | ❌ Байхгүй | Зөвхөн Монгол хэл |
| 📦 Excel export | ⚠️ Суурь бий | xlsx dependency бий, бүрэн UI хийгдээгүй |
| 🔄 Multi-shop удирдлага | ⚠️ Суурь бий | DB schema дэмждэг, UI бүрэн бус |
| 🧪 Test coverage | ⚠️ Хэсэгчлэн | AI module-д тест бий, UI тест дутуу |
| 📸 Instagram content publish | ❌ Хийгдээгүй | DM/comment зөвхөн хариулна, шинэ пост нийтлэхгүй |

---

## 🛠️ Tech Stack

| Технологи | Хэрэглээ |
|-----------|----------|
| **Next.js 16** | Framework (App Router, Turbopack) |
| **React 19** | UI |
| **TypeScript** | Type safety |
| **Tailwind CSS v4** | Styling |
| **Supabase** | PostgreSQL DB + Auth + RLS |
| **Google Gemini** | AI Assistant (Function Calling) |
| **Facebook Graph API** | Messenger + Instagram + Comments |
| **Vercel** | Deployment |
| **Web Push (VAPID)** | Push notifications |

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/aagii9912/smarthub.git
cd smarthub
npm install
```

### 2. Environment Setup

`.env.local` файл үүсгэж дараах env vars нэмнэ:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Facebook
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_token
FACEBOOK_VERIFY_TOKEN=your_verify_token
FACEBOOK_PAGE_ID=your_page_id

# Instagram
INSTAGRAM_ACCESS_TOKEN=your_ig_token
INSTAGRAM_ACCOUNT_ID=your_ig_account_id

# App
NEXT_PUBLIC_APP_URL=https://www.syncly.mn

# Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public
VAPID_PRIVATE_KEY=your_vapid_private
VAPID_EMAIL=mailto:your@email.com
```

### 3. Run

```bash
npm run dev
```

`http://localhost:4001` дээр ажиллана.

---

## 📁 Project Structure

```
syncly/
├── src/
│   ├── app/
│   │   ├── api/                  # API routes (25+ groups)
│   │   │   ├── webhook/          # Facebook/IG webhook
│   │   │   ├── dashboard/        # Dashboard APIs
│   │   │   ├── admin/            # Admin APIs
│   │   │   ├── orders/           # Order management
│   │   │   ├── payment/          # Payment APIs
│   │   │   ├── subscription/     # Subscription APIs
│   │   │   └── ...
│   │   ├── dashboard/            # Dashboard pages
│   │   │   ├── products/         # Бүтээгдэхүүн
│   │   │   ├── orders/           # Захиалга
│   │   │   ├── customers/        # Харилцагч
│   │   │   ├── inbox/            # Чат inbox
│   │   │   ├── comment-automation/ # Comment automation
│   │   │   ├── ai-settings/      # AI тохиргоо
│   │   │   ├── subscription/     # Subscription
│   │   │   └── reports/          # Reports
│   │   ├── admin/                # Admin panel
│   │   ├── auth/                 # Login, Register, OAuth callback
│   │   └── page.tsx              # Landing page
│   ├── components/               # React components
│   ├── contexts/                 # AuthContext
│   ├── hooks/                    # Custom hooks
│   ├── lib/
│   │   ├── ai/                   # Gemini AI (Router, Providers, Tools)
│   │   ├── services/             # Business logic services
│   │   ├── facebook/             # FB Graph API helper
│   │   ├── webhook/              # Webhook handlers
│   │   ├── auth/                 # Auth helpers
│   │   └── supabase*.ts          # Supabase clients
│   └── types/                    # TypeScript types
└── public/                       # Static files
```

---

## 🔐 Security

- Supabase Row Level Security (RLS) бүх table-д идэвхтэй
- Service Role Key зөвхөн server-side
- Middleware-д route protection (auth шаардлагатай route-ууд)
- Facebook webhook signature verification
- VAPID key-based push notifications

---

## 🙏 Credits

Built with:
- [Next.js](https://nextjs.org) • [Supabase](https://supabase.com) • [Google Gemini](https://ai.google.dev) • [Tailwind CSS](https://tailwindcss.com) • [Vercel](https://vercel.com)

---

**© 2025 Syncly — AI-Powered Social Commerce Platform**
