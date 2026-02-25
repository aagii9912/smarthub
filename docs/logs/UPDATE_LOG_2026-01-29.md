# SmartHub Update Log - 2026-01-29

## 🎯 Өнөөдрийн Шинэчлэлтүүд

### 1. Product Stock Management 📦
**Шийдсэн асуудал:** AI борлуулалт хийгдсэн ч product stock хасагдахгүй байсан

**Шийдэл:**
- `decrement_stock_on_order_paid` trigger: Төлбөр төлөгдсөн үед stock автоматаар хасагдана
- `restore_stock_on_order_cancelled` trigger: Захиалга цуцлагдахад stock буцаагдана
- Migration: `20260130100000_stock_management_triggers.sql`

---

### 2. CRM Customers Page 👥
**Сайжруулалт:**
- ✅ Email field засагдсан (буруу `address` variable → зөв `email`)
- ✅ Address field нэмэгдсэн
- ✅ Tags dropdown ажиллаж байна (add/remove)
- ✅ Notes textarea ажиллаж байна
- ✅ "Coming Soon" текстүүд устгагдсан

**Засагдсан файлууд:**
- `src/app/dashboard/customers/page.tsx`

---

### 3. Subscription Plans UI 💳
**Сайжруулалт:**
- Free plan нуугдсан
- Pro план highlight болсон (scale-105, badge)
- Feature labels Монгол хэлээр, emoji-тай
- AI model technical нэр → хэрэглэгчдэд тийм нэр (gpt-4o → Ахисан түвшний AI)

**Засагдсан файлууд:**
- `src/app/dashboard/subscription/page.tsx`

---

### 4. Customer Carts (Inbox) 🛒
**Сайжруулалт:**
- Cart item preview 2 → 4 болсон
- Бүх item-ийн нэр харуулна

**Засагдсан файлууд:**
- `src/components/dashboard/CustomerList.tsx`

---

### 5. Orders Page ✅
Шалгахад бүрэн ажиллаж байсан:
- Status filter tabs
- Date range filters  
- Quick status change buttons
- Bulk status update modal

---

## 📊 Commit Stats
```
14 files changed, 919 insertions(+), 251 deletions(-)
```

## 🔧 Technical Details

### New Files:
- `supabase/migrations/20260130100000_stock_management_triggers.sql`
- `src/lib/plan-limits.ts`
- `src/app/api/shop/disconnect/route.ts`

### Modified Files:
- `src/app/dashboard/customers/page.tsx`
- `src/app/dashboard/subscription/page.tsx`
- `src/components/dashboard/CustomerList.tsx`
- `src/app/api/features/route.ts`
- `src/hooks/useFeatures.ts`
- `src/components/dashboard/Sidebar.tsx`
- + бусад

---

## ⚠️ Git Push Issue
Permission denied error - SSH key эсвэл token шинэчлэх шаардлагатай:
```
remote: Permission to aagii9912/smarthub.git denied to aagii8999-glitch.
```

**Шийдэл:** 
```bash
git remote set-url origin https://<YOUR_TOKEN>@github.com/aagii9912/smarthub.git
# эсвэл SSH
git remote set-url origin git@github.com:aagii9912/smarthub.git
```
