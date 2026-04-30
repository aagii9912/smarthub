'use client';

import Link from 'next/link';
import {
    HelpCircle,
    MessageSquare,
    Facebook,
    Package,
    Mail,
    ArrowRight,
    ExternalLink,
    Sparkles,
    ChevronDown,
} from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { cn } from '@/lib/utils';

const FAQS = [
    {
        question: 'AI чатбот хэрхэн ажилладаг вэ?',
        answer:
            'Syncly AI Sales agent нь таны Facebook Page-тэй холбогдож, Messenger-ээр ирсэн мессежүүдэд автоматаар хариулна. Мэргэшсэн AI загвар ашиглан хэрэглэгчийн асуултад зөв хариулт өгнө.',
    },
    {
        question: 'Facebook Page-ээ хэрхэн холбох вэ?',
        answer:
            'Тохиргоо хуудсанд орж "Facebook-ээр холбох" товчийг дарна уу. Facebook бүртгэлээрээ нэвтэрч, чатбот ажиллуулах Page-ээ сонгоно.',
    },
    {
        question: 'Бүтээгдэхүүн нэмж болох уу?',
        answer:
            'Тийм! Dashboard дээрх "Бүтээгдэхүүн" хэсэгт орж шинэ бүтээгдэхүүн нэмэх боломжтой. Чатбот эдгээр бүтээгдэхүүнүүдийг харилцагчдад танилцуулна.',
    },
    {
        question: 'Захиалга хэрхэн үүсдэг вэ?',
        answer:
            'Харилцагч Messenger-ээр бүтээгдэхүүн захиалахад системд автоматаар захиалга бүртгэгдэнэ. Dashboard дээр захиалгуудыг удирдах боломжтой.',
    },
    {
        question: 'Чатбот ажиллахгүй байна?',
        answer:
            'Facebook Page зөв холбогдсон эсэхийг шалгана уу. Тохиргоо хуудсанд очиж "Чатбот идэвхтэй" гэсэн тэмдэглэгээ байгаа эсэхийг шалгаарай.',
    },
];

const QUICK_LINKS = [
    {
        href: '/setup',
        icon: Facebook,
        iconTone: 'text-[var(--brand-indigo-400)]',
        iconBg: 'bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)]',
        title: 'Facebook холбох',
        desc: 'Page-ээ холбож чатбот идэвхжүүлэх',
        cta: 'Тохируулах',
    },
    {
        href: '/dashboard/products',
        icon: Package,
        iconTone: 'text-[var(--success)]',
        iconBg: 'bg-[color-mix(in_oklab,var(--success)_18%,transparent)]',
        title: 'Бүтээгдэхүүн',
        desc: 'Бүтээгдэхүүн нэмж удирдах',
        cta: 'Бүтээгдэхүүнүүд',
    },
    {
        href: '/dashboard',
        icon: Sparkles,
        iconTone: 'text-[var(--brand-violet-500)]',
        iconBg: 'bg-[color-mix(in_oklab,var(--brand-violet-500)_18%,transparent)]',
        title: 'Dashboard',
        desc: 'Борлуулалт, захиалга хянах',
        cta: 'Хянах самбар',
    },
];

export default function HelpPage() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PageHero
                eyebrow={
                    <span className="inline-flex items-center gap-2">
                        <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Тусламж
                    </span>
                }
                title="Тусламж & FAQ"
                subtitle="Syncly ашиглахад тусламж хэрэгтэй юу? Хурдан холбоосууд, түгээмэл асуултуудаас хариултаа олно уу."
            />

            {/* Quick links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {QUICK_LINKS.map((link) => {
                    const Icon = link.icon;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="card-outlined p-5 group hover:border-white/[0.12] transition-colors"
                        >
                            <div
                                className={cn(
                                    'w-11 h-11 rounded-xl flex items-center justify-center mb-4',
                                    link.iconBg
                                )}
                            >
                                <Icon className={cn('w-5 h-5', link.iconTone)} strokeWidth={1.7} />
                            </div>
                            <p className="text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-1">
                                {link.title}
                            </p>
                            <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
                                {link.desc}
                            </p>
                            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--brand-indigo-400)] group-hover:gap-1.5 transition-all">
                                {link.cta}
                                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.8} />
                            </span>
                        </Link>
                    );
                })}
            </div>

            {/* FAQ */}
            <div className="space-y-3">
                <h2 className="text-[15px] font-semibold text-foreground tracking-[-0.02em] px-1">
                    Түгээмэл асуултууд
                </h2>
                <div className="space-y-2">
                    {FAQS.map((faq, index) => (
                        <details
                            key={index}
                            className="group card-outlined overflow-hidden"
                        >
                            <summary className="px-5 py-4 cursor-pointer flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors list-none">
                                <span className="text-[13.5px] font-medium text-foreground tracking-[-0.01em]">
                                    {faq.question}
                                </span>
                                <ChevronDown
                                    className="h-4 w-4 text-muted-foreground shrink-0 group-open:rotate-180 transition-transform"
                                    strokeWidth={1.8}
                                />
                            </summary>
                            <div className="px-5 pb-4 -mt-1 text-[13px] text-muted-foreground leading-relaxed">
                                {faq.answer}
                            </div>
                        </details>
                    ))}
                </div>
            </div>

            {/* Contact */}
            <div className="card-outlined p-6 md:p-8 text-center">
                <h3 className="text-[16px] font-semibold text-foreground tracking-[-0.02em] mb-2">
                    Дэмжлэг хэрэгтэй юу?
                </h3>
                <p className="text-[13px] text-muted-foreground mb-5">
                    Бидэнтэй холбоо барина уу
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <a
                        href="mailto:support@syncly.mn"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.15] transition-colors"
                    >
                        <Mail className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.7} />
                        <span className="text-[13px] font-medium text-foreground">support@syncly.mn</span>
                    </a>
                    <a
                        href="https://m.me/synclymn"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe0] text-white transition-colors"
                    >
                        <MessageSquare className="w-4 h-4" strokeWidth={1.7} />
                        <span className="text-[13px] font-medium">Messenger</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-70" strokeWidth={1.7} />
                    </a>
                </div>
            </div>
        </div>
    );
}
