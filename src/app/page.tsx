"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Menu,
  X,
  MessageSquare,
  BarChart3,
  Zap,
  Bot,
  CreditCard,
  Target,
  Minus,
  Sparkles,
  Star,
} from "lucide-react";

// ─── Data ───
const pricingPlans = {
  monthly: {
    starter: { price: "₮49,000", period: "/сар" },
    business: { price: "₮99,000", period: "/сар" },
    enterprise: { price: "Тохиролцоно", period: "" },
  },
  yearly: {
    starter: { price: "₮490,000", period: "/жил", savings: "2 сар үнэгүй" },
    business: { price: "₮990,000", period: "/жил", savings: "2 сар үнэгүй" },
    enterprise: { price: "Тохиролцоно", period: "" },
  },
};

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Scroll-triggered reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal-on-scroll").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#06060f] text-white antialiased overflow-x-hidden">

      {/* ══════ BACKGROUND EFFECTS ══════ */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Top gradient orb */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-gradient-to-b from-indigo-600/[0.15] via-violet-600/[0.08] to-transparent blur-3xl" />
        {/* Left accent */}
        <div className="absolute top-[40%] left-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-500/[0.04] blur-3xl" />
        {/* Right accent */}
        <div className="absolute top-[60%] right-[-10%] w-[400px] h-[400px] rounded-full bg-violet-500/[0.04] blur-3xl" />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* ══════ NAV ══════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-[#06060f]/70 backdrop-blur-2xl">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Syncly" width={28} height={28} />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">Syncly</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-[13px] text-slate-400">
            <a href="#features" className="hover:text-white transition-colors duration-200">Боломжууд</a>
            <a href="#pricing" className="hover:text-white transition-colors duration-200">Үнэ</a>
            <a href="#faq" className="hover:text-white transition-colors duration-200">Түгээмэл асуулт</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button href="/auth/login" variant="ghost" size="sm" className="text-[13px] text-slate-300 hover:text-white">
              Нэвтрэх
            </Button>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-[13px] font-medium text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:brightness-110 transition-all duration-200"
            >
              Эхлэх
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.05] bg-[#06060f]/95 backdrop-blur-2xl px-6 py-4 space-y-3">
            <a href="#features" className="block text-sm text-slate-400 hover:text-white">Боломжууд</a>
            <a href="#pricing" className="block text-sm text-slate-400 hover:text-white">Үнэ</a>
            <a href="#faq" className="block text-sm text-slate-400 hover:text-white">Түгээмэл асуулт</a>
            <div className="pt-3 border-t border-white/[0.05] flex gap-3">
              <Button href="/auth/login" variant="ghost" size="sm" className="flex-1">Нэвтрэх</Button>
              <Link href="/auth/register" className="flex-1 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium">Эхлэх</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══════ HERO ══════ */}
      <section className="relative pt-36 pb-20 sm:pt-44 sm:pb-28 px-6">
        <div className="mx-auto max-w-3xl text-center relative z-10">
          {/* Badge */}
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-1.5 text-[12px] font-medium text-indigo-300">
            <Sparkles className="h-3 w-3" />
            Syncly
          </div>

          {/* Heading */}
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] font-bold tracking-[-0.04em]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400">
              47 захиалга.
            </span>{" "}
            24 цаг.
            <br />
            0 хүн.
          </h1>

          {/* Sub */}
          <p className="mt-6 text-[clamp(1rem,2vw,1.15rem)] leading-relaxed text-slate-400 max-w-xl mx-auto">
            Messenger, Instagram дээрх мессеж бүрд хариулж, захиалга авч, төлбөр цуглуулна. Та оролцохгүй. Тоо өөрөө ярина.
          </p>

          {/* CTA */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 px-8 py-3.5 text-[15px] font-semibold text-white shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all duration-300"
            >
              Үнэгүй эхлэх
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-1 text-[14px] text-slate-400 hover:text-white transition-colors"
            >
              Дэлгэрэнгүй
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Trust line */}
          <p className="mt-12 text-[12px] text-slate-500">
            5 минутад суулгана · Картгүй · Хэзээ ч цуцална
          </p>
        </div>
      </section>

      {/* ══════ METRICS BAR ══════ */}
      <section className="relative border-y border-white/[0.05] bg-white/[0.01]">
        <div className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-0 sm:divide-x divide-white/[0.06]">
          {[
            { value: "500+", label: "Бизнес хэрэглэгч" },
            { value: "2M+", label: "Мессеж боловсруулсан" },
            { value: "50K+", label: "Захиалга" },
            { value: "98%", label: "Сэтгэл ханамж" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center sm:px-8">
              <span className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
                {stat.value}
              </span>
              <span className="mt-1.5 text-[12px] text-slate-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════ FEATURES ══════ */}
      <section id="features" className="relative py-24 sm:py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-xl mx-auto reveal-on-scroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-indigo-400">Боломжууд</p>
            <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
              Бизнесээ удирдахад хэрэгтэй бүх зүйл
            </h2>
            <p className="mt-3 text-slate-400 text-[15px]">
              Нэг платформд AI чатбот, захиалга, аналитик, CRM бүгд байна.
            </p>
          </div>

          {/* Grid */}
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: MessageSquare,
                title: "AI Чатбот",
                desc: "Facebook Messenger дээр 24/7 харилцагчидтай автоматаар харилцана. Бүтээгдэхүүний мэдээлэл, үнэ, захиалгын мэдээлэл өгнө.",
                color: "from-indigo-500 to-blue-500",
                iconColor: "text-indigo-400",
              },
              {
                icon: BarChart3,
                title: "Аналитик самбар",
                desc: "Борлуулалт, харилцагчид, захиалгын статистик нэг дэлгэцнээс хянах.",
                color: "from-emerald-500 to-teal-500",
                iconColor: "text-emerald-400",
              },
              {
                icon: Zap,
                title: "5 минутын суулгалт",
                desc: "Facebook хуудастайгаа холбож, бүтээгдэхүүнээ оруулаад AI шууд ажиллаж эхэлнэ.",
                color: "from-amber-500 to-orange-500",
                iconColor: "text-amber-400",
              },
              {
                icon: Bot,
                title: "Gemini AI",
                desc: "Google-ийн хамгийн сүүлийн үеийн AI загвар ашиглана. Монгол хэлийг бүрэн дэмждэг.",
                color: "from-violet-500 to-purple-500",
                iconColor: "text-violet-400",
              },
              {
                icon: CreditCard,
                title: "QPay төлбөр",
                desc: "QPay-ээр шууд төлбөр хүлээн авч, захиалга автоматаар бүртгэнэ.",
                color: "from-cyan-500 to-blue-500",
                iconColor: "text-cyan-400",
              },
              {
                icon: Target,
                title: "CRM систем",
                desc: "Харилцагчийн мэдээлэл автоматаар хадгалж, шошгоор ангилна.",
                color: "from-rose-500 to-pink-500",
                iconColor: "text-rose-400",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="reveal-on-scroll group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300"
              >
                {/* Glow on hover */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />
                <div className={`relative z-10`}>
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} bg-opacity-10`}>
                    <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section className="py-24 sm:py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/[0.02] to-transparent" />
        <div className="mx-auto max-w-6xl relative z-10">
          <div className="text-center max-w-xl mx-auto reveal-on-scroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-violet-400">Хэрхэн ажилладаг</p>
            <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
              3 алхамд эхлээрэй
            </h2>
          </div>

          <div className="mt-16 grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Бүртгүүлэх",
                desc: "Syncly-д бүртгүүлж, Facebook хуудастайгаа холбоно.",
                gradient: "from-indigo-500 to-blue-500",
              },
              {
                step: "02",
                title: "Бүтээгдэхүүн нэмэх",
                desc: "Бүтээгдэхүүнээ нэмж, AI тохиргоогоо хийнэ.",
                gradient: "from-violet-500 to-purple-500",
              },
              {
                step: "03",
                title: "Борлуулалт эхлэх",
                desc: "AI чатбот 24/7 ажиллаж, борлуулалтаа нэмэгдүүлнэ.",
                gradient: "from-cyan-500 to-teal-500",
              },
            ].map((item) => (
              <div key={item.step} className="reveal-on-scroll text-center group">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} shadow-lg mb-5`}>
                  <span className="text-[14px] font-bold text-white">{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400 max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ SOCIAL PROOF ══════ */}
      <section className="py-24 sm:py-32 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="text-center reveal-on-scroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Хэрэглэгчид</p>
            <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
              Бизнес эрхлэгчдийн сэтгэгдэл
            </h2>
          </div>

          <div className="mt-14 grid sm:grid-cols-2 gap-5">
            {[
              {
                quote: "Syncly ашигласнаас хойш борлуулалт 40%-иар өссөн. AI чатбот маш зөв хариулт өгдөг.",
                name: "Батжаргал Г.",
                role: "Хувцасны дэлгүүр",
                color: "from-indigo-500 to-violet-500",
              },
              {
                quote: "Шөнийн цагаар ч захиалга хүлээн авдаг болсон. Ажилтан хөлслөхгүйгээр 24/7 ажилладаг.",
                name: "Сарантуяа Б.",
                role: "Гоо сайхны бүтээгдэхүүн",
                color: "from-violet-500 to-purple-500",
              },
              {
                quote: "QPay интеграц маш хялбар. Харилцагчид шууд төлбөрөө хийгээд захиалга баталгаажна.",
                name: "Энхболд Д.",
                role: "Электрон бараа",
                color: "from-cyan-500 to-blue-500",
              },
              {
                quote: "CRM функц нь харилцагчдаа ангилж, тэдэнтэй илүү зөв харилцах боломж өгсөн.",
                name: "Оюунчимэг Т.",
                role: "Гар урлал",
                color: "from-emerald-500 to-teal-500",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="reveal-on-scroll group p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300"
              >
                <div className="flex gap-0.5 mb-4">
                  {[1, 2, 3, 4, 5].map(s => <Star key={s} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-[14px] leading-relaxed text-slate-300">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-[12px] font-bold text-white`}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{t.name}</p>
                    <p className="text-[11px] text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PRICING ══════ */}
      <section id="pricing" className="py-24 sm:py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.02] to-transparent" />
        <div className="mx-auto max-w-5xl relative z-10">
          <div className="text-center reveal-on-scroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-violet-400">Үнийн төлөвлөгөө</p>
            <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
              Энгийн, ойлгомжтой үнэ
            </h2>
          </div>

          {/* Toggle */}
          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-1 text-[13px]">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`rounded-full px-5 py-2 font-medium transition-all duration-200 ${billingPeriod === "monthly"
                  ? "bg-white text-black shadow-sm"
                  : "text-slate-400 hover:text-white"
                  }`}
              >
                Сар бүр
              </button>
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`rounded-full px-5 py-2 font-medium transition-all duration-200 ${billingPeriod === "yearly"
                  ? "bg-white text-black shadow-sm"
                  : "text-slate-400 hover:text-white"
                  }`}
              >
                Жилээр
                <span className="ml-1.5 text-[11px] text-emerald-400 font-medium">-17%</span>
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="mt-12 grid sm:grid-cols-3 gap-5">
            {/* Starter */}
            <div className="reveal-on-scroll rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 sm:p-8 flex flex-col hover:border-white/[0.1] transition-all duration-300">
              <p className="text-[14px] font-semibold">Starter</p>
              <p className="text-[12px] text-slate-500 mt-0.5">Жижиг бизнест</p>
              <div className="mt-5">
                <span className="text-3xl font-bold tracking-[-0.02em]">
                  {pricingPlans[billingPeriod].starter.price}
                </span>
                <span className="text-[13px] text-slate-500">{pricingPlans[billingPeriod].starter.period}</span>
              </div>
              {billingPeriod === "yearly" && pricingPlans.yearly.starter.savings && (
                <p className="mt-1 text-[11px] text-emerald-400">{pricingPlans.yearly.starter.savings}</p>
              )}
              <ul className="mt-6 space-y-3 flex-1">
                {["1 Facebook хуудас", "500 мессеж/сар", "50 бүтээгдэхүүн", "Энгийн AI чатбот"].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-[13px] text-slate-400">
                    <Check className="h-4 w-4 text-slate-600 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/register?plan=starter"
                className="mt-7 inline-flex items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] px-6 py-2.5 text-[13px] font-medium text-white hover:bg-white/[0.08] transition-all duration-200"
              >
                Эхлүүлэх
              </Link>
            </div>

            {/* Business — featured */}
            <div className="reveal-on-scroll rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/[0.06] to-transparent p-7 sm:p-8 flex flex-col relative shadow-xl shadow-indigo-500/[0.05]">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 rounded-t-2xl" />
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold">Business</p>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-full">
                  Алдартай
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5">Дунд бизнест</p>
              <div className="mt-5">
                <span className="text-3xl font-bold tracking-[-0.02em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                  {pricingPlans[billingPeriod].business.price}
                </span>
                <span className="text-[13px] text-slate-500">{pricingPlans[billingPeriod].business.period}</span>
              </div>
              {billingPeriod === "yearly" && pricingPlans.yearly.business.savings && (
                <p className="mt-1 text-[11px] text-emerald-400">{pricingPlans.yearly.business.savings}</p>
              )}
              <ul className="mt-6 space-y-3 flex-1">
                {["3 Facebook хуудас", "Хязгааргүй мессеж", "Хязгааргүй бүтээгдэхүүн", "Ахисан AI + CRM", "QPay холболт", "Тайлан, аналитик"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[13px] text-slate-300">
                      <Check className="h-4 w-4 text-indigo-400 shrink-0" /> {item}
                    </li>
                  )
                )}
              </ul>
              <Link
                href="/auth/register?plan=business"
                className="mt-7 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:brightness-110 transition-all duration-200"
              >
                Эхлүүлэх
              </Link>
            </div>

            {/* Enterprise */}
            <div className="reveal-on-scroll rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 sm:p-8 flex flex-col hover:border-white/[0.1] transition-all duration-300">
              <p className="text-[14px] font-semibold">Enterprise</p>
              <p className="text-[12px] text-slate-500 mt-0.5">Том байгууллагуудад</p>
              <div className="mt-5">
                <span className="text-3xl font-bold tracking-[-0.02em]">
                  {pricingPlans[billingPeriod].enterprise.price}
                </span>
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {["Хязгааргүй хуудас", "Хязгааргүй бүтээгдэхүүн", "Тусгай AI тохиргоо", "24/7 дэмжлэг", "API холболт", "Хувийн менежер"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[13px] text-slate-400">
                      <Check className="h-4 w-4 text-slate-600 shrink-0" /> {item}
                    </li>
                  )
                )}
              </ul>
              <Link
                href="/contact"
                className="mt-7 inline-flex items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] px-6 py-2.5 text-[13px] font-medium text-white hover:bg-white/[0.08] transition-all duration-200"
              >
                Холбогдох
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ COMPARISON TABLE ══════ */}
      <section className="pb-24 sm:pb-28 px-6">
        <div className="mx-auto max-w-4xl reveal-on-scroll">
          <h3 className="text-lg font-semibold tracking-[-0.01em] mb-6">Бүх боломжуудыг харьцуулах</h3>
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.01]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left font-medium p-4 text-slate-500">Боломжууд</th>
                  <th className="font-medium p-4 text-center text-slate-400">Starter</th>
                  <th className="font-medium p-4 text-center text-indigo-400">Business</th>
                  <th className="font-medium p-4 text-center text-slate-400">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Facebook хуудас", s: "1", b: "3", e: "Хязгааргүй" },
                  { name: "Сарын мессеж", s: "500", b: "Хязгааргүй", e: "Хязгааргүй" },
                  { name: "Бүтээгдэхүүн", s: "50", b: "Хязгааргүй", e: "Хязгааргүй" },
                  { name: "AI чатбот", s: "Энгийн", b: "Ахисан", e: "Тусгай" },
                  { name: "CRM систем", s: false, b: true, e: true },
                  { name: "QPay төлбөр", s: false, b: true, e: true },
                  { name: "Тайлан, аналитик", s: false, b: true, e: true },
                  { name: "API хандалт", s: false, b: false, e: true },
                  { name: "Хувийн менежер", s: false, b: false, e: true },
                ].map((row, i) => (
                  <tr key={row.name} className={i < 8 ? "border-b border-white/[0.04]" : ""}>
                    <td className="p-4 text-slate-400">{row.name}</td>
                    {[row.s, row.b, row.e].map((val, j) => (
                      <td key={j} className="p-4 text-center">
                        {val === true ? (
                          <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                        ) : val === false ? (
                          <Minus className="h-4 w-4 text-slate-700 mx-auto" />
                        ) : (
                          <span className={j === 1 ? "text-indigo-400 font-medium" : "text-slate-500"}>
                            {val}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section id="faq" className="py-24 sm:py-32 px-6 border-t border-white/[0.05]">
        <div className="mx-auto max-w-2xl">
          <div className="text-center reveal-on-scroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-cyan-400">FAQ</p>
            <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
              Түгээмэл асуултууд
            </h2>
          </div>

          <div className="mt-12 space-y-0 divide-y divide-white/[0.06] border-y border-white/[0.06]">
            {[
              {
                q: "Суулгалт хэр удаан шаарддаг вэ?",
                a: "Facebook хуудастайгаа холбоход 5 минут л хангалттай. Бүтээгдэхүүнээ нэмсний дараа AI шууд ажиллаж эхэлнэ.",
              },
              {
                q: "AI хэр зөв хариулт өгдөг вэ?",
                a: "Google-ийн Gemini AI загвар ашиглаж байгаа тул 95%+ нарийвчлалтай хариулт өгдөг. Монгол хэлийг бүрэн дэмждэг.",
              },
              {
                q: "Төлбөрийн ямар сонголтууд байдаг вэ?",
                a: "QPay, дансаар шилжүүлэг, эсвэл картаар төлбөр хийж болно. Сар бүр эсвэл жилээр төлөх сонголттой.",
              },
              {
                q: "Туршилтын хугацаа байдаг уу?",
                a: "Тийм, 14 хоногийн үнэгүй туршилт байгаа. Картын мэдээлэл оруулах шаардлагагүй.",
              },
              {
                q: "Хэзээ ч цуцалж болох уу?",
                a: "Тийм, ямар ч үед цуцалж болно. Урьдчилсан төлбөр байхгүй, гэрээ байхгүй.",
              },
            ].map((item, i) => (
              <div key={i} className="reveal-on-scroll">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left text-[14px] font-medium hover:text-white text-slate-200 transition-colors"
                >
                  {item.q}
                  <ChevronDown
                    className={`h-4 w-4 text-slate-500 shrink-0 ml-4 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""
                      }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${openFaq === i ? "max-h-40 pb-5" : "max-h-0"
                    }`}
                >
                  <p className="text-[13px] leading-relaxed text-slate-400">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ CTA ══════ */}
      <section className="py-24 sm:py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/[0.04] to-transparent" />
        <div className="mx-auto max-w-2xl text-center relative z-10 reveal-on-scroll">
          <h2 className="text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
            Өнөөдөр эхэлцгээе
          </h2>
          <p className="mt-3 text-slate-400 text-[15px]">
            14 хоногийн үнэгүй туршилт. Картын мэдээлэл шаардлагагүй.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 px-8 py-3.5 text-[15px] font-semibold text-white shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all duration-300"
            >
              Үнэгүй турших
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#pricing"
              className="text-[14px] text-slate-400 hover:text-white transition-colors"
            >
              Үнэ харах →
            </a>
          </div>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="border-t border-white/[0.05] bg-white/[0.01]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2.5">
                <Image src="/logo.png" alt="Syncly" width={24} height={24} />
                <span className="text-[14px] font-semibold">Syncly</span>
              </div>
              <p className="mt-3 text-[12px] text-slate-500 leading-relaxed">
                AI-тэй худалдааны платформ.
                <br />
                Монгол бизнесүүдэд зориулсан.
              </p>
              <p className="mt-2 text-[11px] text-slate-600">
                A product of MM LINE TRACKING LLC
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-3">
                Бүтээгдэхүүн
              </p>
              <ul className="space-y-2 text-[13px] text-slate-500">
                <li><a href="#features" className="hover:text-white transition-colors">Боломжууд</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Үнэ</a></li>
                <li><Link href="/docs" className="hover:text-white transition-colors">API Баримт</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-3">
                Компани
              </p>
              <ul className="space-y-2 text-[13px] text-slate-500">
                <li><Link href="/about" className="hover:text-white transition-colors">Бидний тухай</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Блог</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Холбоо барих</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-3">
                Хууль
              </p>
              <ul className="space-y-2 text-[13px] text-slate-500">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Нууцлалын бодлого</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Үйлчилгээний нөхцөл</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-white/[0.05] text-center">
            <p className="text-[11px] text-slate-600">
              © {new Date().getFullYear()} MM LINE TRACKING LLC. Бүх эрх хуулиар хамгаалагдсан.
            </p>
          </div>
        </div>
      </footer>

      {/* ══════ REVEAL + GLOW STYLES ══════ */}
      <style jsx global>{`
        .reveal-on-scroll {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal-on-scroll.revealed {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
