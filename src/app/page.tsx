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
  BarChart3,
  Zap,
  Bot,
  CreditCard,
  Target,
  Minus,
  Clock,
  TrendingUp,
  Wallet,
} from "lucide-react";

// ─── Data ───
const pricingPlans = {
  monthly: {
    starter: { price: "₮179,000", period: "/сар" },
    pro: { price: "₮379,000", period: "/сар" },
    enterprise: { price: "Тохиролцоно", period: "" },
  },
  yearly: {
    starter: { price: "₮1,790,000", period: "/жил", savings: "2 сар үнэгүй" },
    pro: { price: "₮3,379,000", period: "/жил", savings: "2 сар үнэгүй" },
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
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-gradient-to-b from-indigo-600/[0.15] via-violet-600/[0.08] to-transparent blur-3xl" />
        <div className="absolute top-[40%] left-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-500/[0.04] blur-3xl" />
        <div className="absolute top-[60%] right-[-10%] w-[400px] h-[400px] rounded-full bg-violet-500/[0.04] blur-3xl" />
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
            <Zap className="h-3 w-3" />
            Автомат борлуулалт
          </div>

          {/* Heading */}
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] font-bold tracking-[-0.04em]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400">
              5x илүү захиалга.
            </span>
            <br />
            Нэг шөнийн дотор.
          </h1>

          {/* Sub */}
          <p className="mt-6 text-[clamp(1rem,2vw,1.15rem)] leading-relaxed text-slate-400 max-w-xl mx-auto">
            Facebook, Instagram-ын мессеж бүрд автомат хариулж, захиалга бүртгэж, QPay-ээр төлбөр цуглуулна. Нэг ч мессеж алдахгүй.
          </p>

          {/* CTA */}
          <div className="mt-10 flex items-center justify-center">
            <Link
              href="/auth/register"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 px-8 py-3.5 text-[15px] font-semibold text-white shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all duration-300"
            >
              5x өсөлтөө эхлүүлэх
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Trust line */}
          <p className="mt-12 text-[12px] text-slate-500">
            Картгүй · 5 минутад суулгана · Хэзээ ч цуцална
          </p>
        </div>
      </section>

      {/* ══════ METRICS BAR ══════ */}
      <section className="relative border-y border-white/[0.05] bg-white/[0.01]">
        <div className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-0 sm:divide-x divide-white/[0.06]">
          {[
            { value: "32", label: "Бизнес хэрэглэгч" },
            { value: "28+", label: "Мессеж боловсруулсан" },
            { value: "3,5K+", label: "Захиалга" },
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
              Нэг платформд Тусгай борлуулагч agent, захиалга, аналитик, CRM бүгд байна.
            </p>
          </div>

          {/* Grid */}
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Bot,
                title: "Тусгай Борлуулагч Agent",
                desc: "Facebook Messenger, Instagram дээр 24/7 хэрэглэгчидтэй автоматаар харилцаж, бүтээгдэхүүн, үйлчилгээний мэдээлэл өгөх, захиалга авах, төлбөр хүлээн авах болон нэмэлт бүтээгдэхүүн санал болгох ухаалаг борлуулагч agent.",
                color: "from-indigo-500 to-blue-500",
                iconColor: "text-indigo-400",
              },
              {
                icon: BarChart3,
                title: "Хянах самбар",
                desc: "Борлуулалт, хэрэглэгчид, захиалгын статистик нэг дэлгэцээс хянах.",
                color: "from-emerald-500 to-teal-500",
                iconColor: "text-emerald-400",
              },
              {
                icon: Zap,
                title: "5 минутын суулгалт",
                desc: "Facebook, Instagram хуудастайгаа холбож, бүтээгдэхүүний мэдээллээ оруулаад Agent шууд ажиллаж эхэлнэ.",
                color: "from-amber-500 to-orange-500",
                iconColor: "text-amber-400",
              },
              {
                icon: CreditCard,
                title: "Нэгдсэн төлбөрийн систем",
                desc: "Ганц товшилтоор шууд төлбөр хүлээн авч, захиалга автоматаар бүртгэнэ.",
                color: "from-cyan-500 to-blue-500",
                iconColor: "text-cyan-400",
              },
              {
                icon: Target,
                title: "CRM систем",
                desc: "Хэрэглэгчийн мэдээллийг автоматаар бүртгэж, хүргэлтийн хаяг, санал гомдол цуглуулна.",
                color: "from-rose-500 to-pink-500",
                iconColor: "text-rose-400",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="reveal-on-scroll group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300"
              >
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />
                <div className="relative z-10">
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
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-violet-400">Бүртгүүлэхэд хэцүү юу?</p>
            <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
              Ердөө 3-н алхам
            </h2>
          </div>

          <div className="mt-16 grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Бүртгүүлэх",
                desc: "Бүртгэлийн мэдээллээ оруулж, Facebook, Instagram хуудастайгаа холбоно.",
                gradient: "from-indigo-500 to-blue-500",
              },
              {
                step: "02",
                title: "Бүтээгдэхүүн нэмэх",
                desc: "Бүтээгдэхүүн, үйлчилгээний мэдээллээ нэмж, Тусгай Борлуулагч agent-ийн тохиргоогоо хийнэ.",
                gradient: "from-violet-500 to-purple-500",
              },
              {
                step: "03",
                title: "Борлуулалт эхлэх",
                desc: "Тусгай Борлуулагч agent 24/7 ажиллаж, борлуулалтаа шууд хийж эхэлнэ.",
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
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Syncly-д нэгдсэнээр та…</p>
            <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
              Тоо худлаа хэлдэггүй!
            </h2>
          </div>

          <div className="mt-14 grid sm:grid-cols-3 gap-5">
            {[
              {
                icon: Clock,
                category: "Цаг",
                stat: "8+ цаг",
                statSuffix: "/өдөр",
                result: "24/7 автомат хариулт",
                color: "from-indigo-500 to-blue-500",
                iconColor: "text-indigo-400",
              },
              {
                icon: Wallet,
                category: "Мөнгө",
                stat: "₮500K+",
                statSuffix: "/сар",
                result: "Нэмэлт ажилтан шаардлагагүй",
                color: "from-emerald-500 to-teal-500",
                iconColor: "text-emerald-400",
              },
              {
                icon: TrendingUp,
                category: "Бүтээмж",
                stat: "5x",
                statSuffix: " илүү",
                result: "Бүх мессежид хариулна",
                color: "from-violet-500 to-purple-500",
                iconColor: "text-violet-400",
              },
            ].map((item) => (
              <div
                key={item.category}
                className="reveal-on-scroll group p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300 text-center"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} bg-opacity-10 mb-4`}>
                  <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-2">{item.category}</p>
                <div className="mb-4">
                  <p className="text-[10px] text-slate-600 mb-1">Хэмнэлт</p>
                  <span className="text-3xl font-bold tracking-[-0.02em] text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
                    {item.stat}
                  </span>
                  <span className="text-[13px] text-slate-500">{item.statSuffix}</span>
                </div>
                <div className="pt-4 border-t border-white/[0.06]">
                  <p className="text-[10px] text-slate-600 mb-1">Үр дүн</p>
                  <p className="text-[13px] text-slate-300 font-medium">{item.result}</p>
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
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-violet-400">Үнийн санал</p>
            <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
              Таны бизнест санал болгох <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">үнэ</span>
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
                {["1 Facebook/Instagram хуудас", "2,000 мессеж/сар", "50 бүтээгдэхүүн", "Тусгай борлуулагч Agent"].map((item) => (
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

            {/* Pro — featured */}
            <div className="reveal-on-scroll rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/[0.06] to-transparent p-7 sm:p-8 flex flex-col relative shadow-xl shadow-indigo-500/[0.05]">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 rounded-t-2xl" />
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold">Pro</p>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-full">
                  Санал болгох
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5">Дунд бизнест</p>
              <div className="mt-5">
                <span className="text-3xl font-bold tracking-[-0.02em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                  {pricingPlans[billingPeriod].pro.price}
                </span>
                <span className="text-[13px] text-slate-500">{pricingPlans[billingPeriod].pro.period}</span>
              </div>
              {billingPeriod === "yearly" && pricingPlans.yearly.pro.savings && (
                <p className="mt-1 text-[11px] text-emerald-400">{pricingPlans.yearly.pro.savings}</p>
              )}
              <ul className="mt-6 space-y-3 flex-1">
                {["3 Facebook/Instagram хуудас", "10,000 мессеж/сар", "300 бүтээгдэхүүн", "Тусгай борлуулагч Agent", "QPay холболт", "Тайлан, аналитик"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[13px] text-slate-300">
                      <Check className="h-4 w-4 text-indigo-400 shrink-0" /> {item}
                    </li>
                  )
                )}
              </ul>
              <Link
                href="/auth/register?plan=pro"
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
                {["Хязгааргүй хуудас", "Хязгааргүй бүтээгдэхүүн", "Тусгай борлуулагч Agent", "24/7 дэмжлэг", "Хувийн менежер"].map(
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
                  <th className="font-medium p-4 text-center text-indigo-400">Pro</th>
                  <th className="font-medium p-4 text-center text-slate-400">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Facebook/Instagram хуудас", s: "1", b: "3", e: "Хязгааргүй" },
                  { name: "Сарын мессеж", s: "2,000", b: "10,000", e: "Хязгааргүй" },
                  { name: "Бүтээгдэхүүн", s: "50", b: "300", e: "Хязгааргүй" },
                  { name: "Тусгай борлуулагч Agent", s: true, b: true, e: true },
                  { name: "CRM систем", s: false, b: true, e: true },
                  { name: "QPay төлбөр", s: false, b: true, e: true },
                  { name: "Тайлан, аналитик", s: false, b: true, e: true },
                  { name: "24/7 дэмжлэг", s: false, b: false, e: true },
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
                q: "Суурилуулахад хэр удах вэ?",
                a: "Facebook, Instagram хуудастайгаа холбоход 5 минут л хангалттай. Бүтээгдэхүүн, үйлчилгээний мэдээллээ нэмсний дараа Тусгай борлуулагч agent шууд ажиллаж эхэлнэ.",
              },
              {
                q: "Тусгай борлуулагч agent хэр оновчтой, зөв хариулт өгдөг вэ?",
                a: "Syncly тусгайлан хөгжүүлсэн загвар ашиглаж байгаа тул 95%+ нарийвчлалтай хариулт өгөх болно. Монгол хэлийг бүрэн дэмждэг.",
              },
              {
                q: "Төлбөрийн ямар сонголтууд байдаг вэ?",
                a: "QPay, дансаар шилжүүлэг хийх боломжтой. Сар бүр эсвэл жилээр төлөх сонголттой.",
              },
              {
                q: "Туршилтын хугацаа байдаг уу?",
                a: "Байхгүй.",
              },
              {
                q: "Хэзээ ч цуцалж болох уу?",
                a: "Тийм, ямар ч үед цуцалж болно. Мөн та цуцлах бол тухайн сараа дуустал ашиглах боломжтой.",
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
            5 минутад суулгаж, борлуулалтаа автоматжуулаарай.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 px-8 py-3.5 text-[15px] font-semibold text-white shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all duration-300"
            >
              5x өсөлтөө эхлүүлэх
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
                Тоо өөрөө ярьдаг
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
