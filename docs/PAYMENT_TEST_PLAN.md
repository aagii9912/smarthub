# 💳 QPay Төлбөрийн Тест Даалгавар

> **Зорилго:** Syncly платформ дээрх 2 төрлийн QPay төлбөрийн урсгалыг бүрэн тестлэх
> **Хугацаа:** 2026.04.15  
> **Орчин:** Production (syncly.mn)

---

## 📋 Тестийн өмнө бэлтгэх

### Environment Variables (Vercel Dashboard)
Дараах env variables Vercel дээр тохируулагдсан эсэхийг шалгах:

| Variable | Утга | Шалгах |
|---|---|---|
| `QPAY_BASE_URL` | `https://quickqr.qpay.mn` | ☐ |
| `QPAY_USERNAME` | QPay username | ☐ |
| `QPAY_PASSWORD` | QPay password | ☐ |
| `QPAY_MERCHANT_ID` | Syncly master merchant ID | ☐ |
| `QPAY_BANK_CODE` | Syncly банк код | ☐ |
| `QPAY_ACCOUNT_NUMBER` | Syncly дансны дугаар | ☐ |
| `QPAY_ACCOUNT_NAME` | Syncly данс эзэмшигч | ☐ |

### Database Migration
Supabase SQL Editor дээр migration ажиллуулсан эсэх:
- ☐ `20260414_qpay_multi_merchant.sql` — shops болон payments хүснэгтэд шинэ баганууд

---

## 🧪 ТЕСТ #1: Syncly Subscription Төлбөр

> **Зорилго:** Хэрэглэгч Syncly-н subscription plan-д бүртгүүлэхэд QPay-р төлбөр хийх урсгал

### Алхам 1: Subscription хуудас руу орох
1. ☐ `https://syncly.mn` руу нэвтрэх (бүртгэлтэй хаягаар)
2. ☐ Dashboard → **Subscription** хуудас руу очих
3. ☐ Plan-уудын жагсаалт зөв харагдаж байна уу? (Lite, Starter, Pro)

### Алхам 2: Plan сонгох
4. ☐ **Starter** plan дээр "Захиалах" товч дарах
5. ☐ Billing cycle сонгох (Сарын / Жилийн)
6. ☐ QPay QR код / төлбөрийн холбоос гарч ирэх ёстой

### Алхам 3: Төлбөр хийх
7. ☐ Утаснаасаа банкны аппаар QR код уншуулах **ЭСВЭЛ**
8. ☐ Landing page-н банкны товч дарж апп руу шилжих
9. ☐ **100₮** (тест дүн) төлбөр хийх

### Алхам 4: Төлбөр баталгаажсан эсэх
10. ☐ Landing page дээр "Төлбөр амжилттай" гэсэн мессеж гарах (auto-polling)
11. ☐ Dashboard дээр subscription статус **Active** болсон эсэх
12. ☐ Supabase → `payments` хүснэгтэд `status = 'paid'` болсон эсэх
13. ☐ Supabase → `subscriptions` хүснэгтэд `status = 'active'` болсон эсэх

### Хүлээгдэх үр дүн
- ✅ QPay invoice амжилттай үүсэх
- ✅ Банкны аппаар төлбөр хийгдэх
- ✅ Auto-polling 3 секунд тутам шалгаж, амжилттай болмогц UI шинэчлэгдэх
- ✅ Subscription идэвхжих

### Алдаа гарвал бичих
```
Алхам #: ___
Алдааны мессеж: ___
Screenshot: (хавсаргах)
Browser console error: ___
```

---

## 🧪 ТЕСТ #2: Shop Order Төлбөр (AI Chat-р)

> **Зорилго:** Хэрэглэгч Messenger/Instagram-р бараа захиалахад AI agent төлбөрийн линк илгээх урсгал

### Урьдчилсан нөхцөл
- ☐ Shop дээр бараа бүтээгдэхүүн нэмсэн байх (хамгийн багадаа 1 бараа)
- ☐ Shop-н QPay merchant бүртгэл хийгдсэн байх (`/api/shop/qpay-setup`)

### Алхам 1: QPay Merchant бүртгэл (анх удаа)
1. ☐ Dashboard → Settings → Төлбөрийн тохиргоо
2. ☐ Банк сонгох (жишээ: Хаан банк — `050000`)
3. ☐ Дансны дугаар оруулах
4. ☐ Данс эзэмшигчийн нэр оруулах
5. ☐ "Хадгалах" дарах
6. ☐ "QPay merchant амжилттай бүртгэгдлээ" мессеж харагдах
7. ☐ Supabase → `shops` хүснэгтэд `qpay_merchant_id` утга бөглөгдсөн эсэх
8. ☐ `qpay_status = 'active'` болсон эсэх

### Алхам 2: Хэрэглэгч чатаар бараа захиалах
9. ☐ Facebook Messenger / Instagram DM-р shop-н хуудас руу мессеж бичих
10. ☐ AI agent-д бараа захиалах хүсэлт илгээх:
    - _"Сайн байна уу, [барааны нэр] захиалмаар байна"_
11. ☐ AI agent барааг олж, баталгаажуулах хариу өгөх
12. ☐ _"Тийм, захиалъя"_ гэж баталгаажуулах
13. ☐ AI agent захиалга үүсгэж, **төлбөрийн линк** илгээх:
    - `https://syncly.mn/pay/[payment_id]` холбоос ирэх ёстой

### Алхам 3: Төлбөрийн Landing Page
14. ☐ Линк дарахад `syncly.mn/pay/[id]` хуудас нээгдэх
15. ☐ Хуудсан дээр харагдах зүйлс:
    - ☐ Shop-н нэр
    - ☐ Төлбөрийн дүн
    - ☐ QR код (desktop-с сканнердах бол)
    - ☐ 19 банкны товчнууд (deep link)
    - ☐ Хугацаа дуусах countdown timer

### Алхам 4: Банкны аппаар төлөх
16. ☐ Банкны апп-н товч дарах (жишээ: Хаан банк)
17. ☐ Банкны апп шууд нээгдэж, төлбөрийн мэдээлэл бөглөгдсөн байх
18. ☐ Төлбөр баталгаажуулах (PIN / FaceID)
19. ☐ Буцаж ирэхэд landing page дээр **"✅ Төлбөр амжилттай"** харагдах

### Алхам 5: Баталгаажилт
20. ☐ AI agent хэрэглэгчид "Захиалга баталгаажлаа" мессеж явуулах
21. ☐ Dashboard → Orders хуудсанд захиалга **"Paid"** статустай харагдах
22. ☐ Supabase → `payments` хүснэгт: `status = 'paid'`, `payment_type = 'order'`
23. ☐ Supabase → `orders` хүснэгт: `status = 'paid'`
24. ☐ **Мөнгө shop-н банкны данс руу шууд орсон эсэх** (банкны app-с шалгах)

### Хүлээгдэх үр дүн
- ✅ AI agent checkout хийхэд төлбөрийн линк (QR биш) илгээдэг
- ✅ Landing page mobile-д зөв харагдаж, банкны deep link ажилладаг
- ✅ Төлбөр хийсний дараа 3 секундын дотор статус шинэчлэгддэг
- ✅ Мөнгө Syncly-н дансаар дамжихгүй, шууд shop-н данс руу ордог

### Алдаа гарвал бичих
```
Алхам #: ___
Алдааны мессеж: ___
Screenshot: (хавсаргах)
Browser console error: ___
Банкны апп error: ___
```

---

## 🧪 ТЕСТ #3: Хувь хүний QPay Merchant бүртгэл

### Урьдчилсан нөхцөл
- Migration `20260902120000_qpay_person_merchant.sql` хэрэгжсэн (`shops.owner_last_name`, `qpay_merchant_type`, `qpay_last_error` … баганууд бий)
- Дэлгүүр `qpay_status = 'none'` (Settings → Банкны мэдээлэл → "QPay салгах" хийсэн байж болно)
- `QPAY_USERNAME`, `QPAY_PASSWORD` sandbox эсвэл production vendor эрхтэй

### Алхам 1: Зөв мэдээллээр бүртгэх
```bash
curl -X POST https://www.syncly.mn/api/shop/qpay-setup \
  -H "Cookie: <auth cookie>" -H "x-shop-id: <shop uuid>" -H "Content-Type: application/json" \
  -d '{
    "merchant_type": "person",
    "last_name": "Дорж", "first_name": "Бат-Эрдэнэ",
    "register_number": "ya12345678",
    "bank_code": "050000", "account_number": "5012 345 678", "account_name": "Бат-Эрдэнэ",
    "phone": "+976 9988 7766", "email": "test@example.com"
  }'
```
- [ ] Хариу `{ success: true, merchant_id, status: "active", reused: "none" }`
- [ ] `shops` мөр: `qpay_merchant_type = 'person'`, `register_number = 'УА12345678'` (латин → кирилл normalize), `qpay_mcc_code` дэлгүүрийн `business_type`-д тохирсон, `qpay_p2p_terminal_id` бөглөгдсөн, `qpay_registered_at` тавигдсан
- [ ] QPay merchant portal дээр `last_name = Дорж`, `first_name = Бат-Эрдэнэ`

### Алхам 2: Буруу мэдээлэл (validation)
- [ ] `register_number: "1234567"` → 400, `fields.register_number` = "РД 2 кирилл үсэг + 8 тоо …"
- [ ] `phone: "9988"` → 400, `fields.phone`
- [ ] `bank_code: "999999"` → 400
- [ ] `first_name` хоосон → 400

### Алхам 3: Давхар бүртгэл
- [ ] Active дэлгүүр дээр дахин POST → 400, `code: "ALREADY_ACTIVE"`, `merchant_id` буцна
- [ ] Ижил РД-тэй **өөр** дэлгүүр (нэг хэрэглэгч) дээр POST → `reused: "local"`, QPay руу хүсэлт явахгүй (лог: "reused from sibling shop")
- [ ] `mode=disconnect`-оор салгаад дахин POST → QPay `MERCHANT_ALREADY_REGISTERED` → lookup-and-reuse, `success: true`

### Алхам 4: Timeout / алдаа
- [ ] `qpay_status='pending'`, `qpay_pending_since = now() - 11 min` гараар тавиад cron `/api/cron/process-messages` дуудах → `failed`, `qpay_last_error` = "…timeout…"
- [ ] QPay 400 буцаасан тохиолдолд `qpay_status='failed'`, `qpay_last_error`-д QPay-н текст, хариунд монгол `error` мессеж (`Утасны дугаар…` / `Регистр…`)
- [ ] `GET /api/shop/qpay-setup` → `last_error`, `merchant_type`, `terminals`, `owner_last_name/first_name` талбарууд ирнэ

### Алхам 5: Settings-ээс авто бүртгэл (legacy зам)
- [ ] Settings → Банкны мэдээлэл → банк, данс, РД, төрөл "Хувь хүн" бөглөж хадгалах → toast "QPay merchant амжилттай…"
- [ ] Овог/нэр оруулаагүй бол лог дээр "овог/нэр дутуу, дансны нэрээс хуваав" warn гарна (UI wizard ирэх хүртэл fallback)

### Хүлээгдэх үр дүн
- [ ] `npm run test` — `qpay.test.ts` 17, `qpay-merchant.test.ts` 15, `qpay-merchant-service.test.ts` 12 тест ногоон

---

## 🔍 Нэмэлт шалгалтууд

### Edge Cases

| # | Тест | Хүлээгдэх үр дүн | ☐ |
|---|---|---|---|
| E1 | Хугацаа дууссан payment линк нээх | "Хугацаа дууссан" мессеж | ☐ |
| E2 | Аль хэдийн төлсөн payment линк нээх | "Амжилттай төлөгдсөн" мессеж | ☐ |
| E3 | Буруу payment ID-тай линк | 404 алдаа | ☐ |
| E4 | QPay merchant бүртгэлгүй shop-с checkout | Алдааны мессеж ("Банкны тохиргоо хийнэ үү") | ☐ |
| E5 | Нэг payment-г 2 удаа төлөхийг оролдох | Зөвхөн 1 удаа төлөгдөх | ☐ |

### Performance

| # | Шалгах зүйл | Хүлээгдэх | ☐ |
|---|---|---|---|
| P1 | Payment landing page ачааллах хурд | < 2 секунд | ☐ |
| P2 | Auto-polling сервер ачаалал | Хэвийн (429 алдаа байхгүй) | ☐ |
| P3 | QR код зураг ачааллах | < 1 секунд | ☐ |

---

## 📱 Тестийн төхөөрөмжүүд

Доорх төхөөрөмж бүр дээр landing page тестлэх:

| Төхөөрөмж | Browser | Тест хийсэн | Тэмдэглэл |
|---|---|---|---|
| iPhone (Safari) | Safari | ☐ | |
| iPhone (Chrome) | Chrome | ☐ | |
| Android (Chrome) | Chrome | ☐ | |
| Desktop (Chrome) | Chrome | ☐ | |
| Desktop (Safari) | Safari | ☐ | |

---

## 📝 Тестийн тайлан

### Огноо: ___________
### Тестлэгч: ___________

| Тест | Үр дүн | Тэмдэглэл |
|---|---|---|
| #1 Subscription | ✅ / ❌ | |
| #2 Shop Order | ✅ / ❌ | |
| Edge Cases | ___/5 амжилттай | |
| Performance | ___/3 амжилттай | |

### Нийт үр дүн: ________

### Олдсон алдаанууд:
1. 
2. 
3. 

### Дараагийн алхам:
1. 
2. 
3. 

---

> **Анхааруулга:** Тест хийхэд бодит мөнгө ашиглана (100₮ тест дүн). Тест дууссаны дараа QPay dashboard-с refund хийх боломжтой.
