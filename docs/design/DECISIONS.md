# Дизайны шийдвэрүүд (Design Decisions)

> Төлөвлөгөө: `docs/plans/QPAY_MERCHANT_AND_UIUX_PLAN.md` · Хэсэг B, Үе шат 0.
> Шийдвэр бүр огноотой. Өөрчлөх бол шинэ мөр нэмнэ, хуучныг устгахгүй.

## D-001 · Брэнд өнгө = Violet (2026-09-02)

**Шийдвэр:** Syncly-н албан ёсны үндсэн өнгө нь **violet** (`#8B5CF6` суурь, Tailwind `violet-500`).

**Шалтгаан:** Код бодитоор violet ашигладаг (`violet-*` класс 624 удаа; `ring-violet-500` ×90,
`bg-violet-600` ×43). Харин `globals.css`-ийн `--primary` `#4A7CE7` (цэнхэр),
`docs/design/UI_UX_DESIGN_SYSTEM.md` `#4f46e5` (индиго), `skills/brand-identity` `#FA5D29`
(улбар шар) гэж гурав зөрчилдөж байсан. Хэрэглэгчийн дассан violet-ийг үнэн болгох нь
хамгийн бага өөрчлөлттэй, хамгийн бага регресстэй.

**Үр дагавар:**
- `globals.css`: `--primary`, `--ring`, `--brand` → violet scale (`--brand-50 … --brand-950`).
  `--brand-indigo` `#4A7CE7`-ыг `--brand-indigo` legacy alias болгож 1 release-ийн дараа устгана.
- `--accent` алт (`#D4AF37`) хэвээр — зөвхөн "premium/plan" контекстэд.
- `skills/brand-identity/resources/design-tokens.json` болон `UI_UX_DESIGN_SYSTEM.md`-ийг
  `globals.css`-ээс генерацлана (`scripts/gen-design-doc.ts`); гараар засахгүй.
- Codemod: `violet-600 → brand-600`, `violet-500 → brand-500`, `ring-violet-500 → ring-brand` …
  Ингэснээр дараа өнгө солих бол нэг л газар солино.
- Landing-ийн gradient (`gradient-text-brand`: indigo→violet) → violet→cyan болгож брэндтэй нийцүүлнэ.

## D-002 · Dark + Light хоёулаа (2026-09-02)

**Шийдвэр:** Dashboard, setup, auth, landing бүгд **dark ба light** хоёр горимд бүрэн ажиллана.
Default = системийн тохиргоо (`prefers-color-scheme`), хэрэглэгч гараар сольж болно,
сонголт нь хэрэглэгчээр хадгалагдана.

**Одоогийн байдал:** `.dark`/`html.dark` токен бий, `@media (prefers-color-scheme: dark)`
fallback бий, `metadata.themeColor` light/dark хоёуланг зарладаг. Гэвч
`DashboardLayoutShell` `className="dark … bg-[#09090b]"` гэж хүчээр dark тавьдаг, toggle
байхгүй, олон компонент `text-white/45`, `border-white/[0.06]` гэх dark-д л зөв харагдах
класс ашигладаг. Тиймээс light горим "байгаа ч ажилладаггүй".

**Үр дагавар (Үе шат 1-д):**
- **Theme provider:** `next-themes` нэмнэ (`attribute="class"`, `defaultTheme="system"`,
  `enableSystem`, `disableTransitionOnChange`). `<html suppressHydrationWarning>`.
  Хэрэглэгчийн сонголт `localStorage` + `profiles.theme_preference` (шинэ багана,
  олон төхөөрөмж хооронд синк).
- **`DashboardLayoutShell`:** `dark` класс болон `bg-[#09090b]`-ийг устгаж `bg-background`.
  Decorative gradient blob-уудыг токеноор (`from-brand/5`).
- **`globals.css`:** `@media (prefers-color-scheme: dark) { :root:not(.light) … }` давхардлыг
  устгана — `next-themes` system горимд `.dark`-ыг өөрөө тавьдаг. Dark-ийн `--card: #0F0B2E`
  (indigo-хар) → neutral `#111113` (violet брэндтэй зөрчилдөхгүй).
- **Semantic alpha токен:** `--surface-1/2/3`, `--text-1/2/3`, `--border-1/2`, `--overlay`
  хоёр горимд тус тусдаа тодорхойлно. Codemod: `text-white/45 → text-text-2`,
  `border-white/[0.06] → border-border-1`, `bg-white/[0.03] → bg-surface-2` г.м.
  Хэмжсэн тоо: `text-white/*` 869, `bg-white/*` 403, `border-white/*` 411, `bg-[#hex]` 155 —
  114 файлд. Эдгээр бүгд light горимд эвдэрнэ.
- **ThemeToggle:** Header-ийн user menu + Settings → "Харагдац" хэсэг (Light / Dark / System).
- **Шалгалт:** Playwright screenshot тест хоёр горимд (`colorScheme: 'light' | 'dark'`),
  axe контраст шалгалт хоёуланд; `WCAG AA` 4.5:1 текст, 3:1 UI.
- **Landing:** одоо dark-only (`bg-[#06060f]`). Light хувилбарыг Үе шат 4-т; тэр хүртэл
  landing `forcedTheme="dark"`-аар үлдэнэ (next-themes дэмждэг).

## D-003 · Design-loop bar (ШИЙДЭЭГҮЙ)

Дараах гурваас нэгийг сонгох, эсвэл өөрийн reference өгөх:
1. **Linear — Settings/Issues** · нягт dashboard, тодорхой typography scale, dark+light хоёуланд төгс.
2. **Stripe Dashboard — Payments** · төлбөр/захиалгын хүснэгт, статус badge, тайлан — Syncly-н домэйнд ойр.
3. **Shopify Admin — Orders** · e-commerce захиалга/бүтээгдэхүүн, mobile-д сайн — Syncly-н хэрэглэгчийн ойлгомжтой.

Сонгосны дараа `docs/design/bar.md`-д 5–7 механизм бичнэ (shidetzuu-ийн `bar.md` загвар).
