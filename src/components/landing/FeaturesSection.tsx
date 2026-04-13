import {
  Bot,
  BarChart3,
  Zap,
  CreditCard,
  Target,
  Clock,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LandingContent } from "@/lib/landing/types";

const featureStyles = [
  { icon: Bot, color: "from-indigo-500 to-blue-500", iconColor: "text-indigo-400" },
  { icon: BarChart3, color: "from-emerald-500 to-teal-500", iconColor: "text-emerald-400" },
  { icon: Zap, color: "from-amber-500 to-orange-500", iconColor: "text-amber-400" },
  { icon: CreditCard, color: "from-cyan-500 to-blue-500", iconColor: "text-cyan-400" },
  { icon: Target, color: "from-rose-500 to-pink-500", iconColor: "text-rose-400" },
];

const stepGradients = [
  "from-indigo-500 to-blue-500",
  "from-violet-500 to-purple-500",
  "from-cyan-500 to-teal-500",
];

const socialProofStyles = [
  { icon: Clock, color: "from-indigo-500 to-blue-500", iconColor: "text-indigo-400" },
  { icon: Wallet, color: "from-emerald-500 to-teal-500", iconColor: "text-emerald-400" },
  { icon: TrendingUp, color: "from-violet-500 to-purple-500", iconColor: "text-violet-400" },
];

interface SectionProps {
  content: LandingContent;
}

export function FeaturesSection({ content: c }: SectionProps) {
  return (
    <section id="features" className="relative py-24 sm:py-32 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center max-w-xl mx-auto reveal-on-scroll">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-indigo-400">{c.features.sectionLabel}</p>
          <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
            {c.features.sectionTitle}
          </h2>
          <p className="mt-3 text-slate-400 text-[15px]">
            {c.features.sectionDesc}
          </p>
        </div>

        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {c.features.items.map((feature, i) => {
            const style = featureStyles[i % featureStyles.length];
            return (
              <div
                key={feature.title}
                className="reveal-on-scroll group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300"
              >
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${style.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />
                <div className="relative z-10">
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${style.color} bg-opacity-10`}>
                    <style.icon className={`h-5 w-5 ${style.iconColor}`} />
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{feature.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection({ content: c }: SectionProps) {
  return (
    <section className="py-24 sm:py-32 px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/[0.02] to-transparent" />
      <div className="mx-auto max-w-6xl relative z-10">
        <div className="text-center max-w-xl mx-auto reveal-on-scroll">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-violet-400">{c.how_it_works.sectionLabel}</p>
          <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
            {c.how_it_works.sectionTitle}
          </h2>
        </div>

        <div className="mt-16 grid sm:grid-cols-3 gap-8">
          {c.how_it_works.items.map((item, i) => (
            <div key={item.step} className="reveal-on-scroll text-center group">
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${stepGradients[i % stepGradients.length]} shadow-lg mb-5`}>
                <span className="text-[14px] font-bold text-white">{item.step}</span>
              </div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400 max-w-xs mx-auto">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SocialProofSection({ content: c }: SectionProps) {
  return (
    <section className="py-24 sm:py-32 px-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center reveal-on-scroll">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-emerald-400">{c.social_proof.sectionLabel}</p>
          <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
            {c.social_proof.sectionTitle}
          </h2>
        </div>

        <div className="mt-14 grid sm:grid-cols-3 gap-5">
          {c.social_proof.items.map((item, i) => {
            const style = socialProofStyles[i % socialProofStyles.length];
            return (
              <div
                key={item.category}
                className="reveal-on-scroll group p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300 text-center"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${style.color} bg-opacity-10 mb-4`}>
                  <style.icon className={`h-5 w-5 ${style.iconColor}`} />
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
