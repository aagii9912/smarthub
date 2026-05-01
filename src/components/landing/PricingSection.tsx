"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import type { LandingContent } from "@/lib/landing/types";

interface PricingSectionProps {
  content: LandingContent;
}

export function PricingSection({ content: c }: PricingSectionProps) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const getPlan = (plan: 'lite' | 'starter' | 'pro' | 'enterprise') => {
    const p = c.pricing[plan];
    return billingPeriod === 'monthly' ? p.monthly : p.yearly;
  };

  return (
    <>
      <section id="pricing" className="py-24 sm:py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.02] to-transparent" />
        <div className="mx-auto max-w-5xl relative z-10">
          <div className="text-center reveal-on-scroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-violet-400">{c.pricing.sectionLabel}</p>
            <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
              {c.pricing.sectionTitle} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">үнэ</span>
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
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Lite */}
            <div className="reveal-on-scroll rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 sm:p-8 flex flex-col hover:border-white/[0.1] transition-all duration-300">
              <p className="text-[14px] font-semibold">{c.pricing.lite.label}</p>
              <p className="text-[12px] text-slate-500 mt-0.5">{c.pricing.lite.desc}</p>
              <div className="mt-5">
                <span className="text-3xl font-bold tracking-[-0.02em]">{getPlan('lite').price}</span>
                <span className="text-[13px] text-slate-500">{getPlan('lite').period}</span>
              </div>
              {billingPeriod === "yearly" && getPlan('lite').savings && (
                <p className="mt-1 text-[11px] text-emerald-400">{getPlan('lite').savings}</p>
              )}
              <ul className="mt-6 space-y-3 flex-1">
                {c.pricing.lite.features
                  .filter((item) => !/бүтээгдэхүүн|product/i.test(item))
                  .map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[13px] text-slate-400">
                      <Check className="h-4 w-4 text-slate-600 shrink-0" /> {item}
                    </li>
                  ))}
              </ul>
              <Link
                href="/auth/register?plan=lite"
                className="mt-7 inline-flex items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] px-6 py-2.5 text-[13px] font-medium text-white hover:bg-white/[0.08] transition-all duration-200"
              >
                Эхлүүлэх
              </Link>
            </div>
            {/* Starter */}
            <div className="reveal-on-scroll rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 sm:p-8 flex flex-col hover:border-white/[0.1] transition-all duration-300">
              <p className="text-[14px] font-semibold">{c.pricing.starter.label}</p>
              <p className="text-[12px] text-slate-500 mt-0.5">{c.pricing.starter.desc}</p>
              <div className="mt-5">
                <span className="text-3xl font-bold tracking-[-0.02em]">{getPlan('starter').price}</span>
                <span className="text-[13px] text-slate-500">{getPlan('starter').period}</span>
              </div>
              {billingPeriod === "yearly" && getPlan('starter').savings && (
                <p className="mt-1 text-[11px] text-emerald-400">{getPlan('starter').savings}</p>
              )}
              <ul className="mt-6 space-y-3 flex-1">
                {c.pricing.starter.features
                  .filter((item) => !/бүтээгдэхүүн|product/i.test(item))
                  .map((item) => (
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
                <p className="text-[14px] font-semibold">{c.pricing.pro.label}</p>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-full">
                  Санал болгох
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5">{c.pricing.pro.desc}</p>
              <div className="mt-5">
                <span className="text-3xl font-bold tracking-[-0.02em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                  {getPlan('pro').price}
                </span>
                <span className="text-[13px] text-slate-500">{getPlan('pro').period}</span>
              </div>
              {billingPeriod === "yearly" && getPlan('pro').savings && (
                <p className="mt-1 text-[11px] text-emerald-400">{getPlan('pro').savings}</p>
              )}
              <ul className="mt-6 space-y-3 flex-1">
                {c.pricing.pro.features
                  .filter((item) => !/бүтээгдэхүүн|product/i.test(item))
                  .map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[13px] text-slate-300">
                      <Check className="h-4 w-4 text-indigo-400 shrink-0" /> {item}
                    </li>
                  ))}
              </ul>
              <Link
                href="/auth/register?plan=pro"
                className="mt-7 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:brightness-110 transition-all duration-200"
              >
                Эхлүүлэх
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="pb-24 sm:pb-28 px-6">
        <div className="mx-auto max-w-4xl reveal-on-scroll">
          <h3 className="text-lg font-semibold tracking-[-0.01em] mb-6">Бүх боломжуудыг харьцуулах</h3>
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.01]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left font-medium p-4 text-slate-500">Боломжууд</th>
                  <th className="font-medium p-4 text-center text-slate-400">Lite</th>
                  <th className="font-medium p-4 text-center text-slate-400">Starter</th>
                  <th className="font-medium p-4 text-center text-indigo-400">Pro</th>
                </tr>
              </thead>
              <tbody>
                {c.comparison
                  .filter((row) => row.name !== 'Бүтээгдэхүүн')
                  .map((row, i, arr) => (
                    <tr key={row.name} className={i < arr.length - 1 ? "border-b border-white/[0.04]" : ""}>
                      <td className="p-4 text-slate-400">{row.name}</td>
                      {[row.lite, row.starter, row.pro].map((val, j) => (
                        <td key={j} className="p-4 text-center">
                          {val === true ? (
                            <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                          ) : val === false ? (
                            <Minus className="h-4 w-4 text-slate-700 mx-auto" />
                          ) : (
                            <span className={j === 2 ? "text-indigo-400 font-medium" : "text-slate-500"}>
                              {val as string}
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
    </>
  );
}
