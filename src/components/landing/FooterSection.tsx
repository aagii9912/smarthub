"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { LandingContent } from "@/lib/landing/types";

interface SectionProps {
  content: LandingContent;
}

export function FAQSection({ content: c }: SectionProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 sm:py-32 px-6 border-t border-white/[0.05]">
      <div className="mx-auto max-w-2xl">
        <div className="text-center reveal-on-scroll">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-cyan-400">{c.faq.sectionLabel}</p>
          <h2 className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
            {c.faq.sectionTitle}
          </h2>
        </div>

        <div className="mt-12 space-y-0 divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {c.faq.items.map((item, i) => (
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
  );
}

export function CTASection({ content: c }: SectionProps) {
  return (
    <section className="py-24 sm:py-32 px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/[0.04] to-transparent" />
      <div className="mx-auto max-w-2xl text-center relative z-10 reveal-on-scroll">
        <h2 className="text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
          {c.cta.heading}
        </h2>
        <p className="mt-3 text-slate-400 text-[15px]">
          {c.cta.sub}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/register"
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 px-8 py-3.5 text-[15px] font-semibold text-white shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all duration-300"
          >
            {c.cta.buttonText}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <a
            href="#pricing"
            className="text-[14px] text-slate-400 hover:text-white transition-colors"
          >
            {c.cta.linkText}
          </a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
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
  );
}
