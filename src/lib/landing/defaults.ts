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
        lede: "Танд тохирох багцыг сонгож, QPay-ээр шууд төлж эхлүүлээрэй.",
        toggle: { defaultMode: "annual", savePill: "2 САР ҮНЭГҮЙ", discountBadge: "" },
        trustLine: [
            "Аль ч үед цуцлах",
            "QPay · Khan · Хаан төлбөр",
            "Монгол хэлээр",
        ],
        lite: {
            tag: "LITE",
            desc: "Бүтээгдэхүүн танилцуулах",
            accent: "warm",
            credit: {
                icon: "⚡",
                headline: "5,000 AI credit/сар",
                lines: ["1 Facebook/Instagram хуудас", "Тусгай борлуулагч Agent (Basic)"],
            },
            price: {
                monthly: { value: "₮89,000", per: "/сар" },
                annual: { value: "₮890,000", strike: "₮1,068,000", per: "/жил" },
            },
            cta: { text: "Эхлэх", href: "/auth/register?plan=lite" },
            save: {
                annual: "₮178,000 хэмнэнэ — 2 сар үнэгүй",
            },
            features: [
                { kind: "ok", text: "1 Facebook/Instagram хуудас" },
                { kind: "ok", text: "5,000 AI credit/сар" },
                { kind: "ok", text: "Тусгай борлуулагч Agent (Basic)" },
                { kind: "no", text: "Зураг таних (Vision)" },
                { kind: "no", text: "QPay холболт" },
                { kind: "no", text: "Тайлан, аналитик" },
                { kind: "no", text: "AI санах ой" },
            ],
        },
        starter: {
            tag: "STARTER",
            desc: "Жижиг бизнест",
            accent: "lime",
            credit: {
                icon: "📦",
                headline: "8,500 AI credit/сар",
                lines: ["1 Facebook/Instagram хуудас", "Зураг таних (Vision) + QPay холболт"],
            },
            price: {
                monthly: { value: "₮149,000", per: "/сар" },
                annual: { value: "₮1,788,000", per: "/жил" },
            },
            cta: { text: "Эхлэх", href: "/auth/register?plan=starter" },
            features: [
                { kind: "ok", text: "1 Facebook/Instagram хуудас" },
                { kind: "ok", text: "8,500 AI credit/сар" },
                { kind: "ok", text: "Тусгай борлуулагч Agent" },
                { kind: "ok", text: "Зураг таних (Vision)" },
                { kind: "ok", text: "QPay холболт" },
                { kind: "no", text: "Тайлан, аналитик" },
                { kind: "no", text: "AI санах ой" },
                { kind: "no", text: "Excel экспорт" },
            ],
        },
        pro: {
            tag: "PRO",
            desc: "Дунд бизнест",
            accent: "pink",
            featured: true,
            banner: { text: "★ САНАЛ БОЛГОХ", variant: "accent" },
            credit: {
                icon: "⚡",
                headline: "21,000 AI credit/сар",
                lines: ["3 Facebook/Instagram хуудас", "AI санах ой + Excel экспорт"],
            },
            price: {
                monthly: { value: "₮379,000", per: "/сар" },
                annual: { value: "₮3,790,000", strike: "₮4,548,000", per: "/жил" },
            },
            cta: { text: "Эхлэх", href: "/auth/register?plan=pro" },
            save: {
                annual: "₮758,000 хэмнэнэ — 2 сар үнэгүй",
            },
            features: [
                { kind: "ok", text: "3 Facebook/Instagram хуудас" },
                { kind: "ok", text: "21,000 AI credit/сар" },
                { kind: "ok", text: "Тусгай борлуулагч Agent" },
                { kind: "ok", text: "Зураг таних (Vision)" },
                { kind: "ok", text: "QPay холболт" },
                { kind: "ok", text: "Тайлан, аналитик" },
                { kind: "ok", text: "AI санах ой" },
                { kind: "ok", text: "Excel экспорт" },
            ],
        },
        business: {
            tag: "ENTERPRISE",
            desc: "Том байгууллагуудад",
            accent: "indigo",
            banner: { text: "★ ТОМ БИЗНЕСТ", variant: "indigo" },
            credit: {
                icon: "🏢",
                headline: "100,000 AI credit/сар",
                lines: ["Хязгааргүй Facebook/Instagram хуудас", "Хувийн менежер + 24/7 дэмжлэг"],
            },
            price: {
                monthly: { value: "Тохиролцоно" },
                annual: { value: "Тохиролцоно" },
            },
            cta: { text: "Холбогдох", href: "/auth/register?plan=enterprise" },
            features: [
                { kind: "ok", text: "Хязгааргүй Facebook/Instagram хуудас" },
                { kind: "ok", text: "100,000 AI credit/сар" },
                { kind: "ok", text: "Pro бүх боломж" },
                { kind: "ok", text: "Цаг товлох (Appointments)" },
                { kind: "ok", text: "Хувийн брэнднэгж (Custom branding)" },
                { kind: "ok", text: "24/7 дэмжлэг" },
                { kind: "ok", text: "Хувийн менежер" },
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
