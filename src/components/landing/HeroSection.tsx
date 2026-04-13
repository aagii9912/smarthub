import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import type { LandingContent } from "@/lib/landing/types";

interface HeroSectionProps {
  content: LandingContent;
}

export function HeroSection({ content: c }: HeroSectionProps) {
  return (
    <section className="relative pt-36 pb-20 sm:pt-44 sm:pb-28 px-6 overflow-hidden">
      {/* Floating chat bubbles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="chat-bubble absolute top-[18%] left-[5%] sm:left-[8%] bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/10 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-2.5 text-[11px] text-indigo-300/60 max-w-[160px]" style={{ animationDelay: '0s' }}>
          Энэ хувцас хэдээр вэ?
        </div>
        <div className="chat-bubble absolute top-[35%] left-[2%] sm:left-[6%] bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/10 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-2.5 text-[11px] text-emerald-300/60 max-w-[140px]" style={{ animationDelay: '2s' }}>
          Захиалга өгмөөр байна
        </div>
        <div className="chat-bubble absolute top-[55%] left-[4%] sm:left-[10%] bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-2.5 text-[11px] text-cyan-300/60 max-w-[130px]" style={{ animationDelay: '4s' }}>
          Хүргэлттэй юу?
        </div>

        <div className="chat-bubble absolute top-[22%] right-[3%] sm:right-[7%] bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/10 backdrop-blur-sm rounded-2xl rounded-br-md px-4 py-2.5 text-[11px] text-violet-300/60 max-w-[170px]" style={{ animationDelay: '1s' }}>
          ₮45,000 · M, L, XL размертай 🎉
        </div>
        <div className="chat-bubble absolute top-[42%] right-[2%] sm:right-[5%] bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/10 backdrop-blur-sm rounded-2xl rounded-br-md px-4 py-2.5 text-[11px] text-amber-300/60 max-w-[150px]" style={{ animationDelay: '3s' }}>
          QPay линк илгээлээ ✅
        </div>
        <div className="chat-bubble absolute top-[60%] right-[5%] sm:right-[9%] bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/10 backdrop-blur-sm rounded-2xl rounded-br-md px-4 py-2.5 text-[11px] text-rose-300/60 max-w-[160px]" style={{ animationDelay: '5s' }}>
          Тийм, УБ доторх хүргэлттэй 🚚
        </div>
      </div>

      <div className="mx-auto max-w-3xl text-center relative z-10">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-1.5 text-[12px] font-medium text-indigo-300">
          <Zap className="h-3 w-3" />
          {c.hero.badge}
        </div>

        <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] font-bold tracking-[-0.04em]">
          {c.hero.headingLine1}
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400">
            {c.hero.headingHighlight}
          </span>
        </h1>

        <p className="mt-6 text-[clamp(1rem,2vw,1.15rem)] leading-relaxed text-slate-400 max-w-xl mx-auto">
          {c.hero.sub}
        </p>

        <div className="mt-10 flex items-center justify-center">
          <Link
            href="/auth/register"
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 px-8 py-3.5 text-[15px] font-semibold text-white shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all duration-300"
          >
            {c.hero.ctaText}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function MetricsBar({ content: c }: HeroSectionProps) {
  return (
    <section className="relative border-y border-white/[0.05] bg-white/[0.01]">
      <div className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-0 sm:divide-x divide-white/[0.06]">
        {c.metrics.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center sm:px-8">
            <span className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
              {stat.value}
            </span>
            <span className="mt-1.5 text-[12px] text-slate-500">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
