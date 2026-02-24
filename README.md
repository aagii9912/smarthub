# Syncly 🚀

**Facebook Messenger Борлуулалт болон Харилцааны Автоматжуулсан Туслах**

> [!IMPORTANT]
> **Production Ready** - Core features are fully functional. Payment integration and invoice generation recommended before launch.

Syncly нь жижиг, дунд бизнесүүдэд зориулсан ухаалаг борлуулалтын систем юм. Facebook Messenger-ээр автоматаар захиалга авч, харилцагчтай харилцаж, борлуулалтын статистикийг харуулдаг.

---

## ✨ Онцлог

### 🤖 Автомат Харилцааны Туслах
- Харилцагчидтай автоматаар харилцах систем (Function Calling дэмжигдсэн)
- Автоматаар бүтээгдэхүүний мэдээлэл өгөх
- Захиалга автоматаар бүртгэх (Автомат үйлдлүүд: create_order, add_to_cart, check_stock)
- Харилцагчийн асуултад хариулах
- Зураг таних боломж

### 📊 Dashboard
- Real-time статистик (өнөөдрийн захиалга, орлого, харилцагч)
- Захиалга удирдах (pending → confirmed → shipped → delivered)
- Бүтээгдэхүүн удирдах (CRUD)
- Харилцагчийн мэдээлэл (VIP статус автоматаар)
- Чат түүх харах

### 💾 Database
- Supabase PostgreSQL
- Auto-triggers (customer stats, VIP status)
- Бодит цаг хугацаанд sync

### 🎨 Modern UI
- Next.js 15 + React 19
- Tailwind CSS
- Responsive design
- Сайхан gradient, animations

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Processing:** Advanced Language Models (Function Calling)
- **Messenger:** Facebook Graph API
- **Testing:** Vitest, React Testing Library
- **Deployment:** Vercel

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd syncly
npm install
```

### 2. Environment Setup

`.env.local` файл үүсгэж дараах мэдээллийг нэмнэ:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Facebook
FACEBOOK_PAGE_ACCESS_TOKEN=your_token
FACEBOOK_VERIFY_TOKEN=your_verify_token
FACEBOOK_APP_SECRET=your_app_secret

# Language Model API
OPENAI_API_KEY=your_openai_api_key
```

### 3. Database Setup

Дэлгэрэнгүй заавар: [SETUP_GUIDE.md](./SETUP_GUIDE.md)

1. Supabase дээр project үүсгэх
2. SQL Editor дээр `supabase/migrations/001_initial_schema.sql` ажиллуулах
3. Demo өгөгдөл автоматаар үүснэ

### 4. Run Development Server

```bash
npm run dev
```

[http://localhost:3000/dashboard](http://localhost:3000/dashboard) дээр орно

---

## 📁 Project Structure

```
syncly/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── chat/         # Messenger webhook
│   │   │   └── dashboard/    # Dashboard APIs
│   │   ├── dashboard/        # Dashboard pages
│   │   │   ├── page.tsx      # Main dashboard
│   │   │   ├── products/     # Products page
│   │   │   ├── customers/    # Customers page
│   │   │   └── orders/       # Orders page
│   │   └── odoo/             # Landing page
│   ├── components/           # React components
│   │   ├── dashboard/        # Dashboard components
│   │   └── ui/               # Reusable UI components
│   ├── lib/                  # Utilities
│   │   ├── ai/               # Gemini integration
│   │   ├── facebook/         # Messenger API
│   │   └── supabase.ts       # Database client
│   └── types/                # TypeScript types
├── supabase/
│   └── migrations/           # Database schema
└── public/                   # Static files
```

---

## 🎯 Features Roadmap

### ✅ Production Ready
- [x] Dashboard UI
- [x] Database schema  
- [x] API routes
- [x] Products CRUD
- [x] Orders management
- [x] Customers list with CRM
- [x] VIP auto-detection
- [x] Real-time stats
- [x] **Facebook Messenger integration**
- [x] **Автомат харилцааны туслах**
- [x] **Webhook handling**
- [x] **Auto stock management**

### 📋 Recommended Next Steps
- [ ] **Payment integration** (QPay, SocialPay)
- [ ] **Invoice generation**
- [ ] **Email notifications**
- [ ] Analytics charts
- [ ] Export to Excel
- [ ] Multi-shop support
- [ ] Mobile app


---

## 📊 Database Schema

### Tables

**shops** - Дэлгүүрүүд
- id, name, facebook_page_id, owner_name, phone

**products** - Бүтээгдэхүүнүүд
- id, shop_id, name, description, price, stock, is_active

**customers** - Харилцагчид
- id, shop_id, name, phone, address, total_orders, total_spent, is_vip

**orders** - Захиалгууд
- id, shop_id, customer_id, status, total_amount, delivery_address

**order_items** - Захиалгын бараа
- id, order_id, product_id, quantity, unit_price

**chat_history** - Чат түүх
- id, shop_id, customer_id, message, response, intent

---

## 🔐 Security

- Environment variables хамгаалалттай
- Supabase Row Level Security (RLS) ашиглах боломжтой
- Service role key server-side only
- API routes protected

---

## 📱 Demo

**Demo дэлгүүр:** Demo Дэлгүүр
- 5 бүтээгдэхүүн
- 4 харилцагч (2 VIP)
- Бодит статистик

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

MIT License

---

## 📞 Support

Асуулт, санал байвал issue үүсгэнэ үү.

---

## 🙏 Credits

Built with ❤️ using:
- [Next.js](https://nextjs.org)
- [Supabase](https://supabase.com)
- [Google Gemini](https://ai.google.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Lucide Icons](https://lucide.dev)

---

**Happy Selling! 🎉**
