import type { AgentTemplate } from './types';
import type { BusinessType } from '@/lib/constants/business-types';

/**
 * Smart-default templates for each business_type × role combination.
 *
 * When a user picks a business type and role in the setup wizard, the matching
 * template autofills FAQ examples, instructions, slogans, and tone — so they
 * can launch a useful agent in minutes.
 *
 * Templates are not exhaustive; they're starting points the user can edit.
 */
export const AGENT_TEMPLATES: AgentTemplate[] = [
    // ── RETAIL / ECOMMERCE ──────────────────────────────────────────
    {
        id: 'retail-sales',
        businessType: 'retail',
        role: 'sales',
        capabilities: ['sales', 'support'],
        defaultName: 'Найз',
        defaultEmotion: 'friendly',
        defaultInstructions:
            'Та манай дэлгүүрийн борлуулалтын туслах. Хэрэглэгчид зөв бараа санал болгож, захиалга авч, төлбөр төлөх хүртэл дагалдаарай.',
        suggestedFAQs: [
            {
                question: 'Хүргэлт хэр удсан үргэлжилдэг вэ?',
                answer: 'Захиалга өгсөн өдөр УБ дотор 1-2 хоногийн дотор, орон нутагт 3-5 хоногт хүргэдэг.',
            },
            {
                question: 'Буцаах боломжтой юу?',
                answer: 'Тийм, барааг хүлээн авснаас 7 хоногийн дотор анхны савлагаагаар нь буцаах боломжтой.',
            },
            {
                question: 'Төлбөрийн ямар сонголт байдаг вэ?',
                answer: 'QPay, Хаан банк дансаар шилжүүлэх, хүргэлт дээр бэлэн төлөх боломжтой.',
            },
        ],
        suggestedSlogans: [
            'Чанартай бараа, найдвартай хүргэлт',
            'Танд хамгийн дөтөөр хүрнэ',
        ],
        label: { mn: 'Дэлгүүр — борлуулалт', en: 'Retail — Sales' },
        description: {
            mn: 'Сонгодог дэлгүүрийн ажиллагаа: бараа санал, захиалга, төлбөр, хүргэлт',
            en: 'Classic retail flow: recommend, order, pay, deliver',
        },
    },
    {
        id: 'ecommerce-sales',
        businessType: 'ecommerce',
        role: 'sales',
        capabilities: ['sales', 'support'],
        defaultName: 'Туслах',
        defaultEmotion: 'friendly',
        defaultInstructions:
            'Онлайн дэлгүүрийн борлуулалтын туслах. Бараа танилцуулж, хямдрал/хямрал дурдаж, захиалга бүртгэж checkout явуулна.',
        suggestedFAQs: [
            {
                question: 'Зөвхөн онлайн худалдан авах боломжтой юу?',
                answer: 'Тийм. Манай бүтээгдэхүүнүүд зөвхөн онлайнаар захиалагдана.',
            },
            {
                question: 'Хямдрал ямар үед явдаг вэ?',
                answer: 'Сар бүрийн эцэст flash sale явдаг. Шинэ мэдээллийг манай хуудаснаас аваарай.',
            },
            {
                question: 'Хүргэлтийн төлбөр хэд вэ?',
                answer: 'УБ дотор үнэгүй, орон нутагт 5,000₮.',
            },
        ],
        suggestedSlogans: ['Онлайн худалдан авалт хялбар, хурдан, итгэлтэй'],
        label: { mn: 'E-commerce — борлуулалт', en: 'E-commerce — Sales' },
        description: {
            mn: 'Онлайн дэлгүүрт зориулсан sales agent template',
            en: 'Sales agent template for online-only stores',
        },
    },

    // ── RESTAURANT (HYBRID) ─────────────────────────────────────────
    {
        id: 'restaurant-hybrid',
        businessType: 'restaurant',
        role: 'hybrid',
        capabilities: ['sales', 'booking', 'information'],
        defaultName: 'Хоолны зөвлөх',
        defaultEmotion: 'friendly',
        defaultInstructions:
            'Та манай рестораны туслах. Хоолны цэс танилцуулж, ширээ товлох, хүргэлтийн захиалга авч, ажлын цаг/хаяг асуултанд хариулна.',
        suggestedFAQs: [
            {
                question: 'Хүргэлтийн үйлчилгээ байгаа юу?',
                answer: 'Тийм, УБ дотор 19:00 хүртэл хүргэлт авдаг. Хүргэлтийн төлбөр 3,000₮.',
            },
            {
                question: 'Ширээ урьдчилан захиалж болох уу?',
                answer: 'Болно. Маргаашийн өдрийн ширээг 1 өдрийн өмнө захиалаарай.',
            },
            {
                question: 'Vegan хоол байдаг уу?',
                answer: 'Тийм, манай цэснээс vegan, vegetarian тэмдэг бүхий хоолуудыг сонгож болно.',
            },
        ],
        suggestedSlogans: ['Шинэхэн орц, гэрийн амтат хоол'],
        label: { mn: 'Ресторан — олон үүрэг', en: 'Restaurant — Hybrid' },
        description: {
            mn: 'Хоол захиалга + ширээ товлолт + асуулт хариулт',
            en: 'Order + table booking + Q&A in one agent',
        },
    },

    // ── SERVICE (BOOKING) ───────────────────────────────────────────
    {
        id: 'service-booking',
        businessType: 'service',
        role: 'booking',
        capabilities: ['booking', 'information'],
        defaultName: 'Цаг товлогч',
        defaultEmotion: 'professional',
        defaultInstructions:
            'Үйлчилгээ үзүүлдэг бизнесийн цаг товлогч туслах. Боломжит цаг харуулж, цаг товлох, өөрчлөх ажлыг гүйцэтгэнэ.',
        suggestedFAQs: [
            {
                question: 'Цагаа хэр өмнө захиалах ёстой вэ?',
                answer: 'Хамгийн багадаа 1-2 хоногийн өмнө захиалаарай.',
            },
            {
                question: 'Цагаа цуцлах боломжтой юу?',
                answer: 'Тийм, цагаасаа 3 цагийн өмнө бол үнэ төлбөргүй цуцалж болно.',
            },
        ],
        suggestedSlogans: ['Танд тохирох цаг'],
        label: { mn: 'Үйлчилгээ — цаг товлолт', en: 'Service — Booking' },
        description: {
            mn: 'Цаг захиалгат үйлчилгээний тоног төхөөрөмж бүхий agent',
            en: 'Booking-first agent for service businesses',
        },
    },

    // ── BEAUTY (BOOKING) ────────────────────────────────────────────
    {
        id: 'beauty-booking',
        businessType: 'beauty',
        role: 'booking',
        capabilities: ['booking', 'information'],
        defaultName: 'Гоо сайхны зөвлөх',
        defaultEmotion: 'enthusiastic',
        defaultInstructions:
            'Та гоо сайхны салоны цаг товлогч. Боломжит цаг харуулж, үйлчилгээний талаар зөвлөж, цаг бүртгэнэ.',
        suggestedFAQs: [
            {
                question: 'Цаг авахаас өмнө юу бэлдэх вэ?',
                answer: 'Тусгай бэлтгэл шаардлагагүй. Цэвэр царайтай ирээрэй.',
            },
            {
                question: 'Үйлчилгээ хэр удаан үргэлжилдэг вэ?',
                answer: 'Үйлчилгээний төрлөөс хамаараад 30 минутаас 2 цаг хүртэл.',
            },
        ],
        label: { mn: 'Гоо сайхан — цаг товлолт', en: 'Beauty — Booking' },
        description: {
            mn: 'Салон, спа-д тохирсон цаг товлогч',
            en: 'Booking flow tuned for salons & spas',
        },
    },

    // ── HEALTHCARE (HYBRID) ─────────────────────────────────────────
    {
        id: 'healthcare-hybrid',
        businessType: 'healthcare',
        role: 'hybrid',
        capabilities: ['booking', 'information'],
        defaultName: 'Эрүүл мэндийн туслах',
        defaultEmotion: 'calm',
        defaultInstructions:
            'Та эрүүл мэндийн байгууллагын туслах. Цаг товлох, ажлын цаг, эмчийн талаарх асуултад хариулна. Эмчилгээний санал зөвлөгөө өгөх ХОРИОТОЙ — эмчтэй уулзахыг сурталчил.',
        suggestedFAQs: [
            {
                question: 'Цагаа хэрхэн авах вэ?',
                answer: 'Сонирхож буй эмч/үйлчилгээгээ хэлээд боломжит цагаа сонгоорой. Бид үлдээгдсэн утсан дээр баталгаажуулна.',
            },
            {
                question: 'Эмчилгээний тухай асуултад хариулж чадах уу?',
                answer: 'Уучлаарай, эмчилгээний зөвлөгөөг зөвхөн эмч өгнө. Цаг авч уулзахыг зөвлөж байна.',
            },
            {
                question: 'Анхны үзлэг хэдэн төгрөг вэ?',
                answer: 'Үнийн мэдээллийг манай ажилтан хариулна. Утсаа үлдээж болно.',
            },
        ],
        label: { mn: 'Эрүүл мэнд — олон үүрэг', en: 'Healthcare — Hybrid' },
        description: {
            mn: 'Цаг товлох + асуулт хариулт. Эмчилгээний зөвлөгөө өгөхгүй.',
            en: 'Booking + Q&A. Never gives medical advice.',
        },
    },

    // ── EDUCATION (HYBRID) ──────────────────────────────────────────
    {
        id: 'education-hybrid',
        businessType: 'education',
        role: 'hybrid',
        capabilities: ['information', 'lead_capture'],
        defaultName: 'Сургалтын зөвлөх',
        defaultEmotion: 'professional',
        defaultInstructions:
            'Та сургалтын төв/курсын мэдээлэл зөвлөгч туслах. Хөтөлбөр, төлбөр, хуваарийн талаар мэдээлэл өгч, бүртгэх хүсэлтэй сонирхогчоос утас цуглуулна.',
        suggestedFAQs: [
            {
                question: 'Сургалтын төлбөр хэд вэ?',
                answer: 'Хөтөлбөрөөс хамаардаг. Аль курст сонирхож байгаагаа хэлээч, тохирох мэдээлэл өгье.',
            },
            {
                question: 'Хэзээ эхэлдэг вэ?',
                answer: 'Шинэ ангиуд сар бүр эхэлдэг. Сонирхсон хөтөлбөртөө бүртгүүлэх боломжтой.',
            },
            {
                question: 'Гэрчилгээ олгодог уу?',
                answer: 'Тийм, сургалт амжилттай төгссөн оюутнуудад гэрчилгээ олгоно.',
            },
        ],
        label: { mn: 'Боловсрол — олон үүрэг', en: 'Education — Hybrid' },
        description: {
            mn: 'Хөтөлбөр танилцуулга + бүртгэлийн утас цуглуулах',
            en: 'Course intro + lead capture for enrollment',
        },
    },

    // ── REAL ESTATE / AUTO (HYBRID + LEAD CAPTURE) ──────────────────
    {
        id: 'realestate-leadcapture',
        businessType: 'realestate_auto',
        role: 'hybrid',
        capabilities: ['lead_capture', 'information'],
        defaultName: 'Менежерийн туслах',
        defaultEmotion: 'professional',
        defaultInstructions:
            'Та үл хөдлөх / автомашины зар сонирхогч хүний мэдээлэл цуглуулж борлуулагч менежерт дамжуулдаг. Үнэ хэлэх ХОРИОТОЙ — менежертэй холбож өгнө.',
        suggestedFAQs: [
            {
                question: 'Үнэ хэдэн төгрөг вэ?',
                answer: 'Үнийн мэдээллийг манай менежер хувийн ярилцлагаар өгнө. Утсаа үлдээж болно.',
            },
            {
                question: 'Очиж үзэж болох уу?',
                answer: 'Болно. Танай тохирох цагт менежертэй уулзах боломжтой.',
            },
            {
                question: 'Зээл, лизинг боломжтой юу?',
                answer: 'Тийм, банктай хамтран зээлийн боломжтой. Менежер дэлгэрэнгүй танилцуулна.',
            },
        ],
        label: { mn: 'Үл хөдлөх / Авто — танилцуулга', en: 'Real Estate / Auto — Lead' },
        description: {
            mn: 'Сонирхогчийн утас цуглуулж менежер рүү шилжүүлэх',
            en: 'Capture lead, hand off to a sales rep',
        },
    },

    // ── OTHER (FALLBACK) ────────────────────────────────────────────
    {
        id: 'other-sales',
        businessType: 'other',
        role: 'sales',
        capabilities: ['sales'],
        defaultName: 'Туслах',
        defaultEmotion: 'friendly',
        defaultInstructions:
            'Та манай бизнесийн туслах. Хэрэглэгчийн асуултад хариулж, шаардлагатай үед холбоо барих утсыг авна.',
        suggestedFAQs: [
            {
                question: 'Та юу хийдэг газар вэ?',
                answer: 'Манай үйл ажиллагааны талаар дэлгүүрийн тайлбараас уншуулъя!',
            },
        ],
        label: { mn: 'Бусад — энгийн туслах', en: 'Other — Generic' },
        description: {
            mn: 'Бусад төрлийн бизнест зориулсан энгийн template',
            en: 'Generic template for other business types',
        },
    },
];

/**
 * Find the best matching template for a business type.
 * Returns the first matching template, or the `other-sales` fallback.
 */
export function getDefaultTemplateForBusinessType(
    businessType: BusinessType,
): AgentTemplate {
    return (
        AGENT_TEMPLATES.find((t) => t.businessType === businessType) ??
        AGENT_TEMPLATES.find((t) => t.id === 'other-sales')!
    );
}

/**
 * Find all templates available for a business type (in case multiple roles
 * are valid). For now there's one per type.
 */
export function getTemplatesForBusinessType(
    businessType: BusinessType,
): AgentTemplate[] {
    return AGENT_TEMPLATES.filter((t) => t.businessType === businessType);
}

export function getTemplateById(id: string): AgentTemplate | undefined {
    return AGENT_TEMPLATES.find((t) => t.id === id);
}
