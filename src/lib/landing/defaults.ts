/**
 * Landing Page CMS — Default Content (fallback when DB is empty)
 * Extracted from the original hardcoded page.tsx
 */

import type { LandingContent } from './types';

export const defaultLandingContent: LandingContent = {
    hero: {
        badge: "Борлуулалтын шинэ стандарт Syncly",
        headingLine1: "0 ажилтан.",
        headingHighlight: "5х орлогын өсөлт.",
        sub: "Facebook, Instagram дээрх чат бүрд хариулж, захиалга, төлбөр тооцоог автоматаар хүлээн авч баталгаажуулна.",
        ctaText: "5x өсөлтөө эхлүүлэх",
    },

    metrics: [
        { value: "32", label: "Бизнес хэрэглэгч" },
        { value: "28+", label: "Мессеж боловсруулсан" },
        { value: "3,5K+", label: "Захиалга" },
        { value: "98%", label: "Сэтгэл ханамж" },
    ],

    features: {
        sectionLabel: "Боломжууд",
        sectionTitle: "Бизнесээ удирдахад хэрэгтэй бүх зүйл",
        sectionDesc: "Тусгай борлуулалч agent, бараа бүтээгдэхүүний үлдэгдэл, захиалгын мэдээлэл, тайлан, хэрэглэгчийн мэдээлэл бүгд нэг дор",
        items: [
            {
                title: "Тусгай Борлуулагч Agent",
                desc: "Facebook, Instagram дээр 24/7 хэрэглэгчидтэй харилцаж, бүтээгдэхүүн үйлчилгээг санал болгоно.",
            },
            {
                title: "Хянах самбар",
                desc: "Бараа бүтээгдэхүүний үлдэгдэл, борлуулалт, захиалгын тоон мэдээлэл, хэрэглэгчдийн бүртгэлийн мэдээллийг нэг дороос хянана.",
            },
            {
                title: "5 минутын суулгалт",
                desc: "Facebook, Instagram хуудастайгаа холбож, бүтээгдэхүүний мэдээллээ оруулаад Agent шууд ажиллаж эхэлнэ.",
            },
            {
                title: "Нэгдсэн төлбөрийн систем",
                desc: "Ганц товшилтоор шууд төлбөр хүлээн авч, захиалга автоматаар бүртгэнэ.",
            },
            {
                title: "CRM систем",
                desc: "Хэрэглэгчийн мэдээллийг автоматаар бүртгэж, хүргэлтийн хаяг, санал гомдол цуглуулна.",
            },
        ],
    },

    how_it_works: {
        sectionLabel: "Бүртгүүлэхэд хэцүү юу?",
        sectionTitle: "Ердөө 3-н алхам",
        items: [
            {
                step: "01",
                title: "Бүртгүүлэх",
                desc: "Бүртгэлийн мэдээллээ оруулж, Facebook, Instagram хуудастайгаа холбоно.",
            },
            {
                step: "02",
                title: "Бүтээгдэхүүн нэмэх",
                desc: "Бүтээгдэхүүн, үйлчилгээний мэдээллээ нэмж, Тусгай Борлуулагч agent-ийн тохиргоогоо хийнэ.",
            },
            {
                step: "03",
                title: "Борлуулалт эхлэх",
                desc: "Тусгай Борлуулагч agent 24/7 ажиллаж, борлуулалтаа шууд хийж эхэлнэ.",
            },
        ],
    },

    social_proof: {
        sectionLabel: "Syncly-д нэгдсэнээр та…",
        sectionTitle: "Тоо худлаа хэлдэггүй!",
        items: [
            {
                category: "Цаг Хэмнэлт",
                stat: "8+ цаг",
                statSuffix: "/өдөр",
                result: "Бизнесээ дараагийн түвшинд гаргахад зарцуулна",
            },
            {
                category: "Орлого өсөлт",
                stat: "₮500K+",
                statSuffix: "/сар",
                result: "Бизнесээ өргөжүүлнэ",
            },
            {
                category: "Бүтээмж нэмэлт",
                stat: "5x",
                statSuffix: " илүү",
                result: "Зардал буурна",
            },
        ],
    },

    pricing: {
        eyebrowNum: "05",
        sectionLabel: "Үнийн санал",
        headlineLines: {
            line1: "Танай бизнест",
            emphasis: "тохирох",
            gradient: "үнэ",
        },
        lede: "14 хоног үнэгүй туршина. Кредит карт шаардлагагүй.",
        toggle: { defaultMode: "annual", savePill: "−30% ХЯМД", discountBadge: "−30%" },
        trustLine: [
            "14 хоног үнэгүй туршилт",
            "Аль ч үед цуцлах",
            "QPay · Khan · Хаан төлбөр",
            "SOC 2 Type II",
        ],
        lite: {
            tag: "LITE",
            desc: "Хувийн жижиг дэлгүүр, шинэ туршигчид",
            accent: "warm",
            banner: { text: "ҮНЭГҮЙ", variant: "muted" },
            credit: {
                icon: "⚡",
                headline: "50 захиалга/сар",
                lines: ["30 идэвхтэй яриа", "1 Messenger хуудас"],
                fixed: { icon: "✓", text: "Үргэлжид үнэгүй" },
            },
            price: {
                monthly: { value: "₮0" },
                annual: { value: "₮0" },
                perLabel: "сар бүр, үргэлж үнэгүй",
            },
            cta: { text: "Эхлэх", href: "/auth/register?plan=lite" },
            features: [
                { kind: "ok", text: "Үндсэн AI хариулт" },
                { kind: "ok", text: "1 Messenger хуудас" },
                { kind: "no", text: "QPay интеграц" },
                { kind: "no", text: "Custom тайлан" },
                { kind: "no", text: "AI follow-up автомат" },
                { kind: "no", text: "Priority дэмжлэг" },
            ],
        },
        starter: {
            tag: "STARTER",
            desc: "Шинээр хөгжиж буй жижиг бизнес",
            accent: "lime",
            showDiscountBadge: true,
            credit: {
                icon: "📦",
                headline: "500 захиалга/сар",
                lines: ["350 идэвхтэй яриа", "3 суваг (Messenger, IG, веб)"],
                fixed: { icon: "✓", text: "Тогтмол 500 захиалга/сар" },
            },
            price: {
                monthly: { value: "₮29,000" },
                annual: { value: "₮20,300", strike: "₮29,000" },
                perLabel: "сар бүр, жилээр төл",
            },
            cta: { text: "Эхлэх", href: "/auth/register?plan=starter" },
            save: {
                annual: "₮104,400 хэмнэнэ — сартай харьцуулахад",
                monthly: "сар бүр төлбөр",
            },
            features: [
                { kind: "ok", text: "Бүх AI боломж" },
                { kind: "ok", text: "3 суваг — Messenger + IG + Web" },
                { kind: "ok", text: "QPay шууд интеграц" },
                { kind: "ok", text: "Үндсэн тайлан" },
                { kind: "no", text: "AI follow-up автомат" },
                { kind: "no", text: "Custom тайлан + API" },
            ],
        },
        pro: {
            tag: "PRO",
            desc: "Өсөж буй дэлгүүрт хязгааргүй боломж",
            accent: "pink",
            featured: true,
            showDiscountBadge: true,
            banner: { text: "★ ХАМГИЙН ИХ СОНГОЛТ", variant: "accent" },
            credit: {
                icon: "⚡",
                headline: "Хязгааргүй захиалга",
                lines: ["Сар бүр өсөн нэмэгдэж байгаа", "Бүх сувгууд + AI follow-up"],
            },
            slider: {
                label: "Идэвхтэй яриа/сар",
                value: "5,000",
                ticks: ["1,000", "5,000", "10,000+"],
                fillPercent: 50,
            },
            price: {
                monthly: { value: "₮79,000" },
                annual: { value: "₮55,300", strike: "₮79,000" },
                perLabel: "сар бүр, жилээр төл",
            },
            cta: { text: "Pro эхлэх", href: "/auth/register?plan=pro" },
            save: {
                annual: "₮284,400 хэмнэнэ — сартай харьцуулахад",
                monthly: "сар бүр төлбөр",
            },
            features: [
                { kind: "ok", text: "Starter бүх боломж" },
                { kind: "ok", text: "Бүх сувгууд + веб чат widget" },
                { kind: "ok", text: "AI follow-up автомат" },
                { kind: "ok", text: "Custom тайлан + API хандалт", pill: { text: "55% ХУРДАН", variant: "warm" } },
                { kind: "ok", text: "A/B тестийн хэрэгсэл" },
                { kind: "ok", text: "Priority дэмжлэг" },
            ],
        },
        business: {
            tag: "BUSINESS",
            desc: "Том бизнес, агентлаг, сүлжээ",
            accent: "indigo",
            showDiscountBadge: true,
            banner: { text: "★ ХАМГИЙН ИХ ҮНЭ ЦЭН", variant: "indigo" },
            credit: {
                icon: "🏢",
                headline: "3,000 кредит / нийт",
                lines: ["1,500 кредит/хэрэглэгч", "2–15 гишүүн нэг workspace-д"],
            },
            slider: {
                label: "Захиалга/сар",
                value: "3,000",
                ticks: ["1,500", "3,000", "4,500"],
                fillPercent: 38,
            },
            price: {
                monthly: { value: "₮199,000" },
                annual: { value: "₮139,300", strike: "₮199,000" },
                perLabel: "хэрэглэгч/сар, жилээр төл",
            },
            cta: { text: "Эхлэх", href: "/auth/register?plan=enterprise" },
            save: {
                annual: "₮716,400 хэмнэнэ — сартай харьцуулахад",
                monthly: "сар бүр төлбөр",
            },
            seats: { enabled: true, defaultCount: 2, label: "хэрэглэгч" },
            features: [
                { kind: "ok", text: "Pro бүх боломж" },
                { kind: "ok", text: "2–15 гишүүн нэг workspace-д" },
                { kind: "ok", text: "Хуваалцсан кредит сан" },
                { kind: "ok", text: "Зэрэгцээ боловсруулалт: 16 хүртэл", pill: { text: "PARALLEL", variant: "warm" } },
                { kind: "ok", text: "Priority дэмжлэг" },
                { kind: "section", text: "БАГИЙН БОЛОМЖ" },
                { kind: "ok", text: "Хуваалцсан элементүүд + Soul ID-ууд" },
                { kind: "ok", text: "Хэрэглээний аналитик" },
                { kind: "ok", text: "Хуваалцсан project-ууд + integrated chat" },
                { kind: "ok", text: "Custom SSO хандалт" },
                { kind: "section", text: "ХЯЗГААРГҮЙ" },
                { kind: "ok", text: "Syncly Cloud Lite", pill: { text: "365 ӨДӨР", variant: "lime" } },
                { kind: "ok", text: "Сар бүрийн backup", pill: { text: "UNLIMITED", variant: "lime" } },
            ],
        },
    },

    comparison: [
        { name: "Facebook/Instagram хуудас", lite: "1", starter: "1", pro: "3", enterprise: "Хязгааргүй" },
        { name: "Сарын AI credit", lite: "5,000", starter: "8,500", pro: "21,000", enterprise: "100,000" },
        { name: "Тусгай борлуулагч Agent", lite: true, starter: true, pro: true, enterprise: true },
        { name: "Зураг таних (Vision)", lite: false, starter: true, pro: true, enterprise: true },
        { name: "Сагс — Сагс нэмэх/устгах", lite: false, starter: true, pro: true, enterprise: true },
        { name: "Сагс — Олон хувилбар, олон бараа нэг захиалгад", lite: false, starter: false, pro: true, enterprise: true },
        { name: "Захиалгыг засах/цуцлах AI-аар", lite: false, starter: false, pro: true, enterprise: true },
        { name: "AI санах ой (хэрэглэгчийн сонголт)", lite: false, starter: false, pro: true, enterprise: true },
        { name: "Холбогдох бараа санал болгох (Cross-sell)", lite: false, starter: false, pro: true, enterprise: true },
        { name: "Цаг товлох (Appointments)", lite: false, starter: false, pro: true, enterprise: true },
        { name: "Comment auto-reply (FB/IG)", lite: false, starter: true, pro: true, enterprise: true },
        { name: "CRM — VIP/идэвхгүй автомат таг", lite: false, starter: false, pro: true, enterprise: true },
        { name: "Тайлан, дэлгэрэнгүй аналитик", lite: false, starter: false, pro: true, enterprise: true },
        { name: "Excel экспорт", lite: false, starter: false, pro: true, enterprise: true },
        { name: "QPay автомат төлбөр", lite: false, starter: true, pro: true, enterprise: true },
        { name: "Хувийн брэнднэгж (Custom branding)", lite: false, starter: false, pro: false, enterprise: true },
        { name: "24/7 дэмжлэг", lite: false, starter: false, pro: false, enterprise: true },
        { name: "Хувийн менежер", lite: false, starter: false, pro: false, enterprise: true },
    ],

    faq: {
        sectionLabel: "FAQ",
        sectionTitle: "Түгээмэл асуултууд",
        items: [
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
        ],
    },

    cta: {
        heading: "Өнөөдөр эхэлцгээе",
        sub: "5 минутад суулгаж, борлуулалтаа автоматжуулаарай.",
        buttonText: "5x өсөлтөө эхлүүлэх",
        linkText: "Үнэ харах →",
    },
};
