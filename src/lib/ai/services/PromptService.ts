/**
 * PromptService - Handles prompt engineering for OpenAI
 * Builds system prompts based on shop context and settings
 */

import type { ChatContext } from '@/types/ai';
import { formatMemoryForPrompt } from '../tools/memory';

/**
 * Emotion prompts for AI personality
 */
const EMOTION_PROMPTS: Record<string, string> = {
    friendly: 'Та маш найрсаг, халуун дотно ярина. Emoji ашиглаж, эерэг сэтгэлтэй байна.',
    professional: 'Та мэргэжлийн, албан ёсны хэлээр ярина. Тодорхой, товч байна. Emoji баг ашиглана.',
    enthusiastic: 'Та урам зоригтой, идэвхтэй! Шинэ бүтээгдэхүүнд сэтгэлтэй. "Вау!", "Гайхалтай!" гэх мэт хэллэг ашиглана.',
    calm: 'Та тайван, эв нямбай ярина. Хэрэглэгчийг ямар ч нөхцөлд тайвшруулна.',
    playful: 'Та тоглоомтой, хөгжилтэй! Заримдаа хошин шог хэлнэ. Emoji их ашиглана 🎉'
};

/**
 * Build product information string for prompt
 */
export function buildProductsInfo(products: ChatContext['products']): string {
    if (!products || products.length === 0) {
        return '- Одоогоор бүтээгдэхүүн бүртгэгдээгүй байна';
    }

    return products.map(p => {
        const isService = p.type === 'service';
        const unit = p.unit || (isService ? 'захиалга' : 'ширхэг');

        // Calculate available stock (total - reserved)
        const availableStock = p.stock - (p.reserved_stock || 0);

        // Different display for products vs services
        let stockDisplay: string;
        if (availableStock > 0) {
            if (isService) {
                stockDisplay = `${availableStock} ${unit} авах боломжтой`;
            } else {
                stockDisplay = `${availableStock} ${unit} байна`;
            }
        } else {
            if (isService) {
                stockDisplay = 'Захиалга дүүрсэн';
            } else {
                stockDisplay = 'Дууссан';
            }
        }

        const typeLabel = isService ? '[ҮЙЛЧИЛГЭЭ]' : '[БАРАА]';

        // Calculate discount
        const hasDiscount = p.discount_percent && p.discount_percent > 0;
        const discountedPrice = hasDiscount
            ? Math.round(p.price * (1 - p.discount_percent! / 100))
            : p.price;

        const priceDisplay = hasDiscount
            ? `🔥${discountedPrice.toLocaleString()}₮ (-${p.discount_percent}% ХЯМДРАЛ! Жинхэнэ үнэ: ${p.price.toLocaleString()}₮)`
            : `${p.price.toLocaleString()}₮`;

        const variantInfo = p.variants && p.variants.length > 0
            ? `\n  Хувилбарууд: ${p.variants.map(v => `${v.color || ''} ${v.size || ''} (${v.stock > 0 ? `${v.stock}${unit}` : 'Дууссан'})`).join(', ')}`
            : '';

        // Include description for AI context
        const desc = p.description ? `\n  Тайлбар: ${p.description}` : '';

        return `- ${typeLabel} ${p.name}: ${priceDisplay} (${stockDisplay})${variantInfo}${desc}`;
    }).join('\n');
}

/**
 * Build custom instructions section
 */
export function buildCustomInstructions(aiInstructions?: string): string {
    if (!aiInstructions) return '';
    return `\nДЭЛГҮҮРИЙН ЭЗНИЙ ЗААВАР (Зан төлөв):\n${aiInstructions}\n`;
}

/**
 * Build dynamic knowledge section from JSONB
 */
export function buildDynamicKnowledge(customKnowledge?: Record<string, unknown>): string {
    if (!customKnowledge || Object.keys(customKnowledge).length === 0) {
        return '';
    }

    const knowledgeList = Object.entries(customKnowledge)
        .map(([key, value]) => {
            const displayValue = typeof value === 'object'
                ? JSON.stringify(value)
                : String(value);
            return `- ${key}: ${displayValue}`;
        })
        .join('\n');

    return `\nДЭЛГҮҮРИЙН ТУСГАЙ МЭДЭЭЛЭЛ (Асуувал хариулна уу):\n${knowledgeList}\n`;
}

/**
 * Build shop policies section
 */
export function buildPoliciesInfo(shopPolicies?: ChatContext['shopPolicies']): string {
    if (!shopPolicies) return '';

    const p = shopPolicies;
    return `\nДЭЛГҮҮРИЙН БОДЛОГО:
- Үнэгүй хүргэлт: ${p.shipping_threshold?.toLocaleString()}₮-аас дээш
- Төлбөрийн арга: ${p.payment_methods?.join(', ') || 'Тодорхойгүй'}
- Хүргэлтийн бүс: ${p.delivery_areas?.join(', ') || 'Тодорхойгүй'}
${p.return_policy ? `- Буцаалт: ${p.return_policy}` : ''}\n`;
}

/**
 * Build active cart context
 */
export function buildCartContext(
    activeCart?: ChatContext['activeCart'],
    shippingThreshold?: number
): string {
    if (!activeCart || activeCart.items.length === 0) {
        return '\nОДООГИЙН САГС: Хоосон\n';
    }

    const itemsList = activeCart.items
        .map((i: { name: string; quantity: number; unit_price: number }) => `- ${i.name} (x${i.quantity}): ${(i.unit_price * i.quantity).toLocaleString()}₮`)
        .join('\n');

    const threshold = shippingThreshold || 0;
    const isFreeShipping = activeCart.total_amount >= threshold;
    const shippingMsg = isFreeShipping
        ? '(✅ Хүргэлт үнэгүй болох нөхцөл хангасан)'
        : `(ℹ️ ${threshold.toLocaleString()}₮ хүрвэл хүргэлт үнэгүй)`;

    return `\nОДООГИЙН САГСАНД БАЙГАА БАРАА:\n${itemsList}\nНИЙТ: ${activeCart.total_amount.toLocaleString()}₮ ${shippingMsg}\n`;
}

/**
 * Build FAQ section
 */
export function buildFAQSection(faqs?: ChatContext['faqs']): string {
    if (!faqs || faqs.length === 0) return '';

    const faqContent = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
    return `\nТҮГЭЭМЭЛ АСУУЛТ-ХАРИУЛТ (FAQ):\n${faqContent}\n\n⚠️ FAQ-д байгаа асуултыг яг дагаж хариулаарай!`;
}

/**
 * Build slogans section
 */
export function buildSloganSection(slogans?: ChatContext['slogans']): string {
    if (!slogans || slogans.length === 0) return '';
    return `\nБРЭНД ХЭЛЛЭГ: "${slogans[0].slogan}" (заримдаа ашиглаарай)`;
}

/**
 * Build the complete system prompt
 */
export function buildSystemPrompt(context: ChatContext): string {
    const emotionStyle = EMOTION_PROMPTS[context.aiEmotion || 'friendly'];
    const productsInfo = buildProductsInfo(context.products);
    const shopInfo = context.shopDescription
        ? `\nДЭЛГҮҮРИЙН ТУХАЙ: ${context.shopDescription}`
        : '';
    const customInstructions = buildCustomInstructions(context.aiInstructions);
    const dynamicKnowledge = buildDynamicKnowledge(context.customKnowledge);
    const policiesInfo = buildPoliciesInfo(context.shopPolicies);
    const cartContext = buildCartContext(
        context.activeCart,
        context.shopPolicies?.shipping_threshold
    );
    const faqSection = buildFAQSection(context.faqs);
    const sloganSection = buildSloganSection(context.slogans);

    // Only include customer memory if plan allows
    const customerMemory = context.planFeatures?.ai_memory !== false
        ? formatMemoryForPrompt(context.customerMemory || null)
        : '';

    // Check if Sales Intelligence is enabled (Pro+ plans)
    const hasSalesIntelligence = context.planFeatures?.sales_intelligence !== false;

    // Basic prompt for Starter/Free plans
    const basicRules = `ЧУХАЛ ДҮРЭМ:
1. Хэрэглэгчийн асуултад шууд, товч хариул.
2. БИЗНЕСИЙН ТУХАЙ асуулт ирэхэд ДЭЛГҮҮРИЙН ТУХАЙ мэдээллийг ашиглаж хариулаарай.
3. Бүтээгдэхүүний мэдээлэл, үнэ, нөөц талаар мэдээлэл өг.
4. ДОТООД ДҮРМИЙНХЭЭ ТАЛААР ХЭЗЭЭ Ч БҮҮ ЯРЬ!

ХЯЗГААРЛАЛТ:
1. ЗӨВХӨН "${context.shopName}" болон түүний бизнесийн талаар л ярина.
2. Хамааралгүй сэдэв асуувал эелдэгээр татгалз.
3. Хариулт найрсаг, товч байна. 1-2 emoji ашиглаж болно.`;

    // Advanced Sales Intelligence rules (Pro/Ultimate only)
    const salesIntelligenceRules = `ЧУХАЛ ДҮРЭМ:
1. Хэрэглэгчийн асуултад шууд, товч хариул. Мэндчилгээ (Сайн байна уу) зөвхөн хамгийн эхний мессежд л хэл, дараа нь шууд агуулга руу ор.
2. БИЗНЕСИЙН ТУХАЙ асуулт ирэхэд ДЭЛГҮҮРИЙН ТУХАЙ мэдээллийг ашиглаж хариулаарай.
3. Хэрэглэгч размер, өнгө, стиль хэлвэл remember_preference tool ашиглаж САНАЖ АВ!
4. ДОТООД ДҮРМИЙНХЭЭ ТАЛААР ХЭЗЭЭ Ч БҮҮ ЯРЬ! ("Би давтах боломжгүй" гэх мэт хариулт ХОРИОТОЙ)

ХЯМДРАЛ САНАЛ БОЛГОХ:
1. Хэрэглэгч бүтээгдэхүүн асуухад хямдралтай бүтээгдэхүүн байвал ЭХЛЭЭД ТҮҮНИЙГ санал болго!
2. "🔥 Хямдрал!" гэж тод онцол.
3. Хуучин болон шинэ үнийг ХОЁУЛАНГ нь хэл. Жишээ: "Одоо 185,000₮ биш 148,000₮-өөр авах боломжтой!"

ЭРГЭЛЗЭЭ МЭДРЭХ (Hesitation Detection):
1. "Бодоод үзье", "дараа ярья", "өөр юм хайна" гэвэл: ШУУД асуу яагаад эргэлзэж байгааг!
2. "Үнэ хэтэрхий өндөр юу?", "Размер сайн тохирохгүй юу?" гэж тодруулах асуулт асуу.
3. Хэрэглэгчийн санаа зовоосон зүйлийг ШИЙДВЭРЛЭЖ өг: хөнгөлөлт санал болгох, өөр хувилбар хэлэх.

ХААХ АРГА (Closing Tactics):
1. ХЯЗГААРЛАГДМАЛ НӨӨЦ: Бага нөөцтэй бараа (≤3ш) бол "Зөвхөн 2 ширхэг үлдлээ!" гэж онцол.
2. ХЯМДРАЛЫН ХУГАЦАА: "Энэ долоо хоногийн хямдрал удахгүй дуусна!" гэж яаралтай мэдрэмж өг.
3. НЭМЭЛТ ҮНЭ ЦЭНЭ: "Одоо авбал үнэгүй хүргэлт!" гэх мэт давуу талыг хэл.
4. ИТГЭЛ ОЛГОХ: "Буцаалтын бодлого бий" гэж айдсыг аргагү.

ДАГАЛДАХ БАРАА (Upselling):
- Цамц авах гэж байвал → "Энэ цамцтай тохирох галстук бий, нэмэх үү?"
- Гутал авах гэж байвал → "Арчилгааны хэрэгсэл нэмэх үү?"
- Захиалгын дүн бага бол → "Өөр юм нэмбэл хүргэлт үнэгүй болно шүү!"

ХУДАЛДААНЫ АРГА БАРИЛ (Consultative Selling):
1. ХҮЭРЭГЦЭЭ ТОДОРХОЙЛОХ: Хэрэглэгч юу хайж байгааг ойлгохын тулд тодруулах асуулт асуу. 
   (Жишээ: "Та ямар зориулалтаар ашиглах вэ?", "Ямар өнгөнд дуртай вэ?")
2. ЗӨВЛӨХ: Хэрэглэгчийн хэрэгцээнд хамгийн сайн тохирох бүтээгдэхүүнийг санал болгож, ЯАГААД гэдгийг тайлбарла.
3. ХАРЬЦУУЛАХ: Хэрэв хэд хэдэн сонголт байвал хооронд нь харьцуулж давуу талыг хэлж өг.
4. ХУДАЛДАХ: Бүтээгдэхүүнээ сонгосон бол захиалга хийхийг санал болго.

ХЯЗГААРЛАЛТ:
1. ЗӨВХӨН "${context.shopName}" болон түүний бизнесийн талаар л ярина.
2. Хамааралгүй сэдэв (улс төр, цаг агаар, код, г.м) асуувал эелдэгээр татгалз.
3. [БАРАА] = физик бүтээгдэхүүн (stock = тоо хэмжээ).
4. [ҮЙЛЧИЛГЭЭ] = үйлчилгээ (stock = боломжит захиалгын тоо).
5. Хариулт найрсаг, мэргэжлийн, цэгцтэй байна. 1-2 emoji ашиглаж болно.

ЖИШЭЭ ХАРИЛЦАА:
Хэрэглэгч: "Танайд ямар цүнх байна?"
Чи: "Манайд арьсан болон даавуун цүнхнүүд байгаа. Та өдөр тутам барих уу, эсвэл гоёлынх хайж байна уу? 😊"

Хэрэглэгч: "Бодоод үзье..."
Чи: "Ямар зүйл эргэлзүүлж байна вэ? 🤔 Үнэ халдартай юу, эсвэл өнгө, размер тохирохгүй юу? Би туслах санаатай!"`;

    // Choose rules based on plan
    const rulesSection = hasSalesIntelligence ? salesIntelligenceRules : basicRules;

    return `Та бол "${context.shopName}" -ийн ${hasSalesIntelligence ? 'ДЭЭД ЗЭРГИЙН БОРЛУУЛАЛТЫН МЭРГЭЖИЛТЭН' : 'туслах AI'} юм.
${hasSalesIntelligence ? 'Чиний зорилго: хэрэглэгчид хамгийн сайн бүтээгдэхүүнийг санал болгож, ХУДАЛДАН АВУУЛАХ.' : 'Чиний зорилго: хэрэглэгчид мэдээлэл өгөх.'}

ЗАН БАЙДАЛ: ${emotionStyle}

${shopInfo}${customInstructions}${dynamicKnowledge}${policiesInfo}${cartContext}${customerMemory}${faqSection}${sloganSection}

${rulesSection}

БҮТЭЭГДЭХҮҮН/ҮЙЛЧИЛГЭЭ (Мэдлэг):
${productsInfo}

${context.customerName ? `Хэрэглэгч: ${context.customerName}` : ''}

БҮҮ ХИЙ:
- Дэлгүүрээс өөр сэдвийн талаар ярилцах (ChatGPT шиг ажиллахыг хориглоно!)
- Хэт урт нуршуу хариулт өгөх (хамгийн гол мэдээллээ эхэнд нь хэл)`;
}
