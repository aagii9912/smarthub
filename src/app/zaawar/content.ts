/**
 * /zaawar — Интерактив зааврын mind map контент
 * Эх сурвалж: Syncly Бизнесийн гарын авлага + dashboard-ын бодит хуудсууд
 */

import type { LucideIcon } from "lucide-react";
import {
    Rocket,
    Plug,
    Package,
    Bot,
    MessageCircle,
    ShoppingCart,
    Zap,
    BarChart3,
    Gem,
} from "lucide-react";

export interface ZaawarStep {
    title: string;
    desc: string;
}

export interface TopicColor {
    /** Icon болон акцент текстийн өнгө */
    text: string;
    /** Bubble-ийн градиент фон */
    bubble: string;
    /** Bubble-ийн хүрээ */
    ring: string;
    /** Hover үеийн сүүдэр */
    glow: string;
    /** Дугаарын badge-ийн фон */
    badge: string;
    /** SVG холбоос шугамын өнгө */
    stroke: string;
}

export interface ZaawarTopic {
    id: string;
    /** Хөтөчийн санал болгох дараалал (1-ээс эхэлнэ) */
    order: number;
    title: string;
    /** Bubble доторх богино шошго (2 мөрөнд багтахаар) */
    label: string;
    /** Panel дээрх нэг өгүүлбэр тайлбар */
    short: string;
    icon: LucideIcon;
    /** Desktop mind map дээрх байрлал — 1000×660 координатын огторгуйд */
    pos: { x: number; y: number };
    color: TopicColor;
    steps: ZaawarStep[];
    tip?: string;
    href?: string;
    hrefLabel?: string;
}

const indigo: TopicColor = {
    text: "text-indigo-300",
    bubble: "from-indigo-500/25 to-indigo-500/[0.06]",
    ring: "ring-indigo-400/30",
    glow: "hover:shadow-indigo-500/25",
    badge: "bg-indigo-500",
    stroke: "rgba(129,140,248,0.28)",
};
const violet: TopicColor = {
    text: "text-violet-300",
    bubble: "from-violet-500/25 to-violet-500/[0.06]",
    ring: "ring-violet-400/30",
    glow: "hover:shadow-violet-500/25",
    badge: "bg-violet-500",
    stroke: "rgba(167,139,250,0.28)",
};
const cyan: TopicColor = {
    text: "text-cyan-300",
    bubble: "from-cyan-500/25 to-cyan-500/[0.06]",
    ring: "ring-cyan-400/30",
    glow: "hover:shadow-cyan-500/25",
    badge: "bg-cyan-500",
    stroke: "rgba(34,211,238,0.25)",
};
const fuchsia: TopicColor = {
    text: "text-fuchsia-300",
    bubble: "from-fuchsia-500/25 to-fuchsia-500/[0.06]",
    ring: "ring-fuchsia-400/30",
    glow: "hover:shadow-fuchsia-500/25",
    badge: "bg-fuchsia-500",
    stroke: "rgba(232,121,249,0.25)",
};
const blue: TopicColor = {
    text: "text-blue-300",
    bubble: "from-blue-500/25 to-blue-500/[0.06]",
    ring: "ring-blue-400/30",
    glow: "hover:shadow-blue-500/25",
    badge: "bg-blue-500",
    stroke: "rgba(96,165,250,0.28)",
};
const emerald: TopicColor = {
    text: "text-emerald-300",
    bubble: "from-emerald-500/25 to-emerald-500/[0.06]",
    ring: "ring-emerald-400/30",
    glow: "hover:shadow-emerald-500/25",
    badge: "bg-emerald-500",
    stroke: "rgba(52,211,153,0.25)",
};
const amber: TopicColor = {
    text: "text-amber-300",
    bubble: "from-amber-500/25 to-amber-500/[0.06]",
    ring: "ring-amber-400/30",
    glow: "hover:shadow-amber-500/25",
    badge: "bg-amber-500",
    stroke: "rgba(251,191,36,0.25)",
};
const sky: TopicColor = {
    text: "text-sky-300",
    bubble: "from-sky-500/25 to-sky-500/[0.06]",
    ring: "ring-sky-400/30",
    glow: "hover:shadow-sky-500/25",
    badge: "bg-sky-500",
    stroke: "rgba(56,189,248,0.25)",
};
const gold: TopicColor = {
    text: "text-yellow-300",
    bubble: "from-yellow-500/25 to-yellow-500/[0.06]",
    ring: "ring-yellow-400/30",
    glow: "hover:shadow-yellow-500/25",
    badge: "bg-yellow-500",
    stroke: "rgba(250,204,21,0.25)",
};

/** Mind map-ийн координатын огторгуй */
export const CANVAS = { w: 1000, h: 660, cx: 500, cy: 330 };

export const ZAAWAR_TOPICS: ZaawarTopic[] = [
    {
        id: "burtguuleh",
        order: 1,
        title: "Бүртгүүлэх",
        label: "Бүртгүүлэх",
        short: "Ердөө 5 минутад бүртгэл үүсгээд Syncly-г ашиглаж эхлээрэй.",
        icon: Rocket,
        pos: { x: 180, y: 130 },
        color: indigo,
        steps: [
            { title: "Сайт руу орох", desc: "syncly.mn сайт руу орно." },
            { title: "«Эхлэх» товчийг дарах", desc: "Нүүр хуудасны «Эхлэх» товчийг дарна." },
            { title: "Бүртгэл үүсгэх", desc: "Имэйл, Google эсвэл Facebook хаягаараа бүртгэл үүсгэнэ." },
            { title: "Баталгаажуулах", desc: "Имэйл рүү ирсэн холбоосоор бүртгэлээ баталгаажуулна." },
            { title: "Тохируулга руу орох", desc: "Дэлгүүрээ үүсгэх тохируулгын алхамууд автоматаар эхэлнэ." },
        ],
        href: "/auth/register",
        hrefLabel: "Бүртгүүлэх",
    },
    {
        id: "delguur-holboh",
        order: 2,
        title: "Дэлгүүрээ холбох",
        label: "Дэлгүүрээ холбох",
        short: "9 алхамтай тохируулгаар дэлгүүрээ бүрэн бэлэн болгоно.",
        icon: Plug,
        pos: { x: 105, y: 330 },
        color: violet,
        steps: [
            { title: "Бизнесийн төрлөө сонгох", desc: "Дэлгүүр, ресторан, үйлчилгээ гэх мэт төрлөө сонгоход Syncly танд тохирсон тохиргоог санал болгоно." },
            { title: "Дэлгүүрийн мэдээлэл оруулах", desc: "Дэлгүүрийн нэр, эзэмшигчийн нэр, утасны дугаараа бичнэ." },
            { title: "Facebook Page холбох", desc: "Facebook хуудсаа холбоно. Messenger чат бүрт AI 24/7 автоматаар хариулна." },
            { title: "Instagram холбох", desc: "Instagram Business акаунтаа холбоно. Direct DM-д AI шууд хариулна." },
            { title: "Бараа бүртгэх", desc: "Зарах бараа, үйлчилгээгээ нэр, үнэ, зураг, тоотойгоор оруулна." },
            { title: "Үйл ажиллагааны тохиргоо", desc: "Бараа бүртгэх арга, агуулах, НӨАТ зэргийг тохируулна (заавал биш)." },
            { title: "AI туслахаа тохируулах", desc: "AI-ийн нэр, дэлгүүрийн тайлбар, харилцах өнгө аясыг сонгоно." },
            { title: "Орлогын данс холбох", desc: "Банкны дансаа холбоно. QPay идэвхжиж, QR кодоор төлбөрөө хүлээн авна." },
            { title: "Багцаа сонгох", desc: "Бизнестээ тохирсон багцаа сонгоно. Бэлэн боллоо! 🎉" },
        ],
        tip: "Тохиргооны явцыг баруун талын утасны дэлгэц дээр шууд харж болно. Алхам бүрийг «Үргэлжлүүлэх» товчоор урагшлуулна.",
        href: "/setup",
        hrefLabel: "Тохируулга эхлүүлэх",
    },
    {
        id: "baraa",
        order: 3,
        title: "Бараа бүртгэх",
        label: "Бараа бүртгэх",
        short: "Барааг нэг бүрчлэн эсвэл Excel-ээр бөөнөөр нь оруулаарай.",
        icon: Package,
        pos: { x: 185, y: 530 },
        color: cyan,
        steps: [
            { title: "Бараа хэсэг рүү орох", desc: "Хяналтын самбараас «Бараа» цэсийг сонгоно." },
            { title: "Бараа нэмэх", desc: "«Бараа нэмэх» товчийг дараад нэр, үнэ, зураг, үлдэгдлээ оруулна." },
            { title: "Хувилбар нэмэх", desc: "Өнгө, хэмжээ зэрэг сонголттой бол хувилбар (variant) болгон бүртгэнэ." },
            { title: "Бөөнөөр оруулах", desc: "Олон бараатай бол Excel/CSV файлаар нэг дор бөөнөөр нь оруулна." },
        ],
        tip: "AI таны бүртгэсэн барааг чат дээр автоматаар санал болгож, үлдэгдлийг бодит цагт шалгана.",
        href: "/dashboard/products",
        hrefLabel: "Бараа хэсэг рүү очих",
    },
    {
        id: "ai-tuslakh",
        order: 4,
        title: "AI туслахаа тохируулах",
        label: "AI туслах",
        short: "AI борлуулагчийнхаа нэр, өнгө аяс, дүрмийг өөрийн бизнест тааруулаарай.",
        icon: Bot,
        pos: { x: 430, y: 580 },
        color: fuchsia,
        steps: [
            { title: "Нэр өгөх", desc: "«AI тохиргоо» хэсэгт AI туслахдаа нэр өгнө." },
            { title: "Дэлгүүрээ танилцуулах", desc: "Дэлгүүрийн тайлбар, хүргэлт, буцаалт зэрэг дүрэм журмаа бичиж өгнө." },
            { title: "Харилцах хэв маяг сонгох", desc: "Найрсаг эсвэл албаны өнгө аяс, хариултын урт, emoji хэрэглээг тохируулна." },
            { title: "Туршиж үзэх", desc: "Туршилтын чатаар AI-гаа шалгаад, хариултыг нь сайжруулна." },
        ],
        tip: "Тайлбар хэдий дэлгэрэнгүй байна, AI төдий чинь оновчтой хариулна.",
        href: "/dashboard/ai-settings",
        hrefLabel: "AI тохиргоо руу очих",
    },
    {
        id: "inbox",
        order: 5,
        title: "Чат ба Inbox",
        label: "Чат / Inbox",
        short: "Messenger, Instagram-ын бүх чатыг нэг дороос удирдаарай.",
        icon: MessageCircle,
        pos: { x: 680, y: 545 },
        color: blue,
        steps: [
            { title: "Бүх чат нэг дор", desc: "Messenger болон Instagram DM-ийн бүх харилцан яриа «Inbox» хэсэгт нэгдэнэ." },
            { title: "AI 24/7 хариулна", desc: "Шинэ мессеж бүрт AI автоматаар, хүн шиг хариулна." },
            { title: "Өөрөө хариулах", desc: "Хүссэн үедээ тухайн чат дээр AI-г түр унтрааж, өөрөө хариулж болно." },
            { title: "Харилцагчийн мэдээлэл", desc: "Чатын хажууд харилцагчийн мэдээлэл, захиалгын түүх харагдана." },
        ],
        href: "/dashboard/inbox",
        hrefLabel: "Inbox руу очих",
    },
    {
        id: "zahialga",
        order: 6,
        title: "Захиалга удирдах",
        label: "Захиалга",
        short: "AI-ийн авсан захиалгуудыг нэг дороос хянаж, хүргэлтээ зохицуулаарай.",
        icon: ShoppingCart,
        pos: { x: 880, y: 430 },
        color: emerald,
        steps: [
            { title: "Захиалга автоматаар үүснэ", desc: "AI чатаас захиалгыг автоматаар авч, баталгаажуулна." },
            { title: "Төлөв хянах", desc: "«Захиалга» хэсгээс хүлээгдэж буй → хүргэлтэд → дууссан төлвүүдийг удирдана." },
            { title: "Төлбөр баталгаажих", desc: "QPay QR кодоор төлөгдсөн захиалга автоматаар баталгаажна." },
            { title: "Мэдэгдэл авах", desc: "Шинэ захиалга бүрт push мэдэгдэл утсан дээр чинь ирнэ." },
        ],
        href: "/dashboard/orders",
        hrefLabel: "Захиалга руу очих",
    },
    {
        id: "comment",
        order: 7,
        title: "Коммент автоматжуулалт",
        label: "Коммент хариулагч",
        short: "Постны коммент бүрт AI автоматаар хариулж, чат руу чиглүүлнэ.",
        icon: Zap,
        pos: { x: 895, y: 215 },
        color: amber,
        steps: [
            { title: "Автоматжуулалт үүсгэх", desc: "«Коммент автоматжуулалт» хэсгээс пост сонгоно." },
            { title: "Дүрэм тохируулах", desc: "Түлхүүр үг болон хариулах хэв маягаа тохируулна." },
            { title: "AI ажиллана", desc: "Коммент бүрт AI автоматаар хариулж, сонирхсон хүмүүсийг DM рүү урина." },
        ],
        tip: "Идэвхтэй пост дээрээ автоматжуулалт тавихад борлуулалт хамгийн их өсдөг.",
        href: "/dashboard/comment-automation",
        hrefLabel: "Автоматжуулалт руу очих",
    },
    {
        id: "tailan",
        order: 8,
        title: "Тайлан ба харилцагчид",
        label: "Тайлан / CRM",
        short: "Орлого, захиалга, харилцагчдын мэдээллээ бодит цагт хараарай.",
        icon: BarChart3,
        pos: { x: 740, y: 95 },
        color: sky,
        steps: [
            { title: "Хяналтын самбар", desc: "Өдрийн орлого, захиалгын тоо, AI-ийн гүйцэтгэлийг бодит цагт харна." },
            { title: "Тайлан татах", desc: "«Тайлан» хэсгээс борлуулалтын дэлгэрэнгүй тайлангаа үзнэ." },
            { title: "Харилцагчийн сан", desc: "Чатаар холбогдсон бүх харилцагч CRM-д автоматаар бүртгэгдэнэ." },
        ],
        href: "/dashboard/reports",
        hrefLabel: "Тайлан руу очих",
    },
    {
        id: "bagts",
        order: 9,
        title: "Багц ба төлбөр",
        label: "Багц сонгох",
        short: "Бизнесийнхээ хэмжээнд тохирсон багцаа сонгоорой.",
        icon: Gem,
        pos: { x: 455, y: 75 },
        color: gold,
        steps: [
            { title: "Багцаа сонгох", desc: "Бизнесийнхээ хэмжээнд тохирсон багцыг «Багц» хэсгээс сонгоно." },
            { title: "Төлбөр төлөх", desc: "QPay-ээр QR код уншуулан төлбөрөө хялбар төлнө." },
            { title: "Хэрэглээгээ хянах", desc: "Багцын эрх, хэрэглээгээ мөн хэсгээс бодит цагт харна." },
        ],
        href: "/dashboard/subscription",
        hrefLabel: "Багц хэсэг рүү очих",
    },
];
