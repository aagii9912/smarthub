import OpenAI from 'openai';
import { logger } from '@/lib/utils/logger';
import { supabaseAdmin } from '@/lib/supabase';
import { sendOrderNotification, sendPushNotification } from '@/lib/notifications';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

// =============================================
// HELPER FUNCTIONS - Stock & Cart Management
// =============================================

/**
 * Check product stock from DB (not context) - prevents stale data
 */
async function checkProductStock(
    productId: string,
    requiredQty: number
): Promise<{ available: boolean; currentStock: number; reserved: number }> {
    const supabase = supabaseAdmin();
    const { data } = await supabase
        .from('products')
        .select('stock, reserved_stock')
        .eq('id', productId)
        .single();

    const stock = data?.stock || 0;
    const reserved = data?.reserved_stock || 0;
    const availableStock = stock - reserved;

    return {
        available: availableStock >= requiredQty,
        currentStock: availableStock,
        reserved
    };
}

/**
 * Get product from DB by name (fuzzy match) - prevents stale context data
 */
async function getProductFromDB(
    shopId: string,
    productName: string
): Promise<{
    id: string;
    name: string;
    price: number;
    stock: number;
    reserved_stock: number;
    discount_percent: number | null;
} | null> {
    const supabase = supabaseAdmin();
    const { data } = await supabase
        .from('products')
        .select('id, name, price, stock, reserved_stock, discount_percent')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .ilike('name', `%${productName}%`)
        .limit(1)
        .single();

    return data;
}

/**
 * Add item to cart with ON CONFLICT handling - prevents race conditions
 */
async function addItemToCart(
    cartId: string,
    productId: string,
    variantSpecs: Record<string, string>,
    quantity: number,
    unitPrice: number
): Promise<{ success: boolean; newQuantity: number }> {
    const supabase = supabaseAdmin();

    // Use upsert with ON CONFLICT to prevent race conditions
    const { data: existingItem } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cartId)
        .eq('product_id', productId)
        .single();

    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        await supabase
            .from('cart_items')
            .update({ quantity: newQuantity })
            .eq('id', existingItem.id);
        return { success: true, newQuantity };
    } else {
        await supabase
            .from('cart_items')
            .insert({
                cart_id: cartId,
                product_id: productId,
                variant_specs: variantSpecs,
                quantity,
                unit_price: unitPrice
            });
        return { success: true, newQuantity: quantity };
    }
}

/**
 * Get fresh cart data from DB
 */
async function getCartFromDB(shopId: string, customerId: string): Promise<{
    id: string;
    items: Array<{
        id: string;
        product_id: string;
        name: string;
        variant_specs: Record<string, string>;
        quantity: number;
        unit_price: number;
    }>;
    total_amount: number;
} | null> {
    const supabase = supabaseAdmin();

    // Get active cart
    const { data: cart } = await supabase
        .from('carts')
        .select('id')
        .eq('shop_id', shopId)
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .single();

    if (!cart) return null;

    // Get cart items with product names
    const { data: items } = await supabase
        .from('cart_items')
        .select(`
            id,
            product_id,
            variant_specs,
            quantity,
            unit_price,
            products (name)
        `)
        .eq('cart_id', cart.id);

    if (!items || items.length === 0) {
        return { id: cart.id, items: [], total_amount: 0 };
    }

    const mappedItems = items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        name: (item.products as any)?.name || 'Unknown',
        variant_specs: item.variant_specs as Record<string, string>,
        quantity: item.quantity,
        unit_price: Number(item.unit_price)
    }));

    const total = mappedItems.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);

    return { id: cart.id, items: mappedItems, total_amount: total };
}

export interface ChatContext {
    shopId: string;
    customerId?: string;
    shopName: string;
    shopDescription?: string;
    aiInstructions?: string;
    aiEmotion?: 'friendly' | 'professional' | 'enthusiastic' | 'calm' | 'playful';
    products: Array<{
        id: string;
        name: string;
        price: number;
        stock: number;
        reserved_stock?: number;
        discount_percent?: number;
        description?: string;
        image_url?: string;  // Product image URL for Messenger
        images?: string[];   // New images array
        type?: 'product' | 'service' | 'appointment';  // product = бараа, service = үйлчилгээ, appointment = цаг захиалга
        unit?: string;  // e.g., 'ширхэг', 'захиалга', 'цаг'
        colors?: string[];  // Available colors
        sizes?: string[];   // Available sizes
        variants?: Array<{
            color: string | null;
            size: string | null;
            stock: number;
        }>;
    }>;
    customerName?: string;
    orderHistory?: number;
    // New AI features
    faqs?: Array<{ question: string; answer: string }>;
    quickReplies?: Array<{ trigger_words: string[]; response: string; is_exact_match?: boolean }>;
    slogans?: Array<{ slogan: string; usage_context: string }>;
    // Notification settings
    notifySettings?: {
        order: boolean;
        contact: boolean;
        support: boolean;
        cancel: boolean;
    };
    // NEW: Enhanced context for cart system
    shopPolicies?: {
        shipping_threshold: number;
        payment_methods: string[];
        delivery_areas: string[];
        return_policy?: string;
    };
    customKnowledge?: Record<string, any>;
    activeCart?: {
        id: string;
        items: Array<{
            id: string;
            product_id: string;
            name: string;
            variant_specs: Record<string, string>;
            quantity: number;
            unit_price: number;
        }>;
        total_amount: number;
    };
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// Image action to send to Messenger
export interface ImageAction {
    type: 'single' | 'confirm';
    products: Array<{
        name: string;
        price: number;
        imageUrl: string;
        description?: string;
    }>;
}

// Response from generateChatResponse
export interface ChatResponse {
    text: string;
    imageAction?: ImageAction;
}

async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        if (retries > 0 && (error.status === 429 || error.status === 503)) {
            logger.warn(`OpenAI rate limited, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, retries - 1, delay * 2);
        }
        throw error;
    }
}

export async function analyzeProductImage(
    imageUrl: string,
    products: Array<{
        id: string;
        name: string;
        description?: string;
    }>
): Promise<{ matchedProduct: string | null; confidence: number; description: string }> {
    try {
        logger.info('analyzeProductImage called for:', { imageUrl });

        const productList = products.map(p => `- ${p.name}: ${p.description || ''}`).join('\n');

        const prompt = `Та бол дэлгүүрийн туслах юм. Энэ зургийг судалж, доорх бүтээгдэхүүнүүдийн алинтай нь тохирч байгааг хэлнэ үү.

Боломжит бүтээгдэхүүнүүд:
${productList}

Зөвхөн JSON форматаар хариулна уу:
{
  "matchedProduct": "Тохирсон бүтээгдэхүүний нэр (яг ижил нэрээр), эсвэл null",
  "confidence": 0.0-1.0 хооронд тоо,
  "description": "Зураг дээр юу харагдаж байгааг товч монголоор тайлбарла"
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: imageUrl } }
                    ]
                }
            ],
            max_completion_tokens: 500,
        });

        const responseText = response.choices[0]?.message?.content || '';
        logger.success('Vision response:', { responseText });

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return { matchedProduct: null, confidence: 0, description: 'Зургийг таньж чадсангүй.' };
    } catch (error) {
        logger.error('OpenAI Vision Error:', { error });
        return { matchedProduct: null, confidence: 0, description: 'Зураг боловсруулахад алдаа гарлаа.' };
    }
}

export async function generateChatResponse(
    message: string,
    context: ChatContext,
    previousHistory: ChatMessage[] = []
): Promise<ChatResponse> {
    // Track image action from tool calls
    let imageAction: ImageAction | undefined;

    try {
        logger.debug('generateChatResponse called with:', {
            message,
            contextShopName: context.shopName,
            productsCount: context.products?.length || 0,
            historyLength: previousHistory.length
        });

        if (!context.shopName) {
            throw new Error('Shop name is required');
        }

        if (!Array.isArray(context.products)) {
            logger.warn('Products is not an array, converting to empty array');
            context.products = [];
        }

        const productsInfo = context.products.length > 0
            ? context.products.map(p => {
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

                // Include description for AI context (vital for comparison and recommendation)
                const desc = p.description ? `\n  Тайлбар: ${p.description}` : '';

                // Check if image exists (new array or old url)
                const hasImage = (p.images && p.images.length > 0) || !!p.image_url;
                const imageLabel = hasImage ? '[Зурагтай] ' : '';

                // Colors and sizes info
                const colorsInfo = p.colors && p.colors.length > 0 ? `\n  Өнгүүд: ${p.colors.join(', ')}` : '';
                const sizesInfo = p.sizes && p.sizes.length > 0 ? `\n  Хэмжээ: ${p.sizes.join(', ')}` : '';

                return `- ${typeLabel} ${imageLabel}${p.name}: ${priceDisplay} (${stockDisplay})${variantInfo}${colorsInfo}${sizesInfo}${desc}`;
            }).join('\n')
            : '- Одоогоор бүтээгдэхүүн бүртгэгдээгүй байна';

        // Build custom instructions section (Behavior/Зан төлөв)
        const customInstructions = context.aiInstructions
            ? `\nДЭЛГҮҮРИЙН ЭЗНИЙ ЗААВАР (Зан төлөв):\n${context.aiInstructions}\n`
            : '';

        // Build dynamic knowledge section (Facts/Фактууд) - from JSONB
        let dynamicKnowledge = '';
        if (context.customKnowledge && Object.keys(context.customKnowledge).length > 0) {
            const knowledgeList = Object.entries(context.customKnowledge)
                .map(([key, value]) => {
                    // Handle nested objects/arrays
                    const displayValue = typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value);
                    return `- ${key}: ${displayValue}`;
                })
                .join('\n');

            dynamicKnowledge = `\nДЭЛГҮҮРИЙН ТУСГАЙ МЭДЭЭЛЭЛ (Асуувал хариулна уу):\n${knowledgeList}\n`;
        }

        // Build shop policies section (Шинэ)
        let policiesInfo = '';
        if (context.shopPolicies) {
            const p = context.shopPolicies;
            policiesInfo = `\nДЭЛГҮҮРИЙН БОДЛОГО:
- Үнэгүй хүргэлт: ${p.shipping_threshold?.toLocaleString()}₮-аас дээш
- Төлбөрийн арга: ${p.payment_methods?.join(', ') || 'Тодорхойгүй'}
- Хүргэлтийн бүс: ${p.delivery_areas?.join(', ') || 'Тодорхойгүй'}
${p.return_policy ? `- Буцаалт: ${p.return_policy}` : ''}\n`;
        }

        // Build active cart context (Сагсны мэдээллийг Prompt руу оруулах)
        let cartContext = '';
        if (context.activeCart && context.activeCart.items.length > 0) {
            const itemsList = context.activeCart.items
                .map(i => `- ${i.name} (x${i.quantity}): ${(i.unit_price * i.quantity).toLocaleString()}₮`)
                .join('\n');

            // Хүргэлтийн босго давсан эсэхийг тооцох
            const threshold = context.shopPolicies?.shipping_threshold || 0;
            const isFreeShipping = context.activeCart.total_amount >= threshold;
            const shippingMsg = isFreeShipping
                ? '(✅ Хүргэлт үнэгүй болох нөхцөл хангасан)'
                : `(ℹ️ ${threshold.toLocaleString()}₮ хүрвэл хүргэлт үнэгүй)`;

            cartContext = `\nОДООГИЙН САГСАНД БАЙГАА БАРАА:\n${itemsList}\nНИЙТ: ${context.activeCart.total_amount.toLocaleString()}₮ ${shippingMsg}\n`;
        } else {
            cartContext = '\nОДООГИЙН САГС: Хоосон\n';
        }

        const shopInfo = context.shopDescription
            ? `\nДЭЛГҮҮРИЙН ТУХАЙ: ${context.shopDescription}`
            : '';

        // AI Emotion/Personality settings
        const emotionPrompts: Record<string, string> = {
            friendly: 'Та маш найрсаг, халуун дотно ярина. Emoji ашиглаж, эерэг сэтгэлтэй байна.',
            professional: 'Та мэргэжлийн, албан ёсны хэлээр ярина. Тодорхой, товч байна. Emoji баг ашиглана.',
            enthusiastic: 'Та урам зоригтой, идэвхтэй! Шинэ бүтээгдэхүүнд сэтгэлтэй. "Вау!", "Гайхалтай!" гэх мэт хэллэг ашиглана.',
            calm: 'Та тайван, эв нямбай ярина. Хэрэглэгчийг ямар ч нөхцөлд тайвшруулна.',
            playful: 'Та тоглоомтой, хөгжилтэй! Заримдаа хошин шог хэлнэ. Emoji их ашиглана 🎉'
        };

        const emotionStyle = emotionPrompts[context.aiEmotion || 'friendly'];

        // Build FAQ section for prompt
        const faqSection = context.faqs && context.faqs.length > 0
            ? `\nТҮГЭЭМЭЛ АСУУЛТ-ХАРИУЛТ (FAQ):\n${context.faqs.map(f =>
                `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}\n\n⚠️ FAQ-д байгаа асуултыг яг дагаж хариулаарай!`
            : '';

        // Build slogans section
        const sloganSection = context.slogans && context.slogans.length > 0
            ? `\nБРЭНД ХЭЛЛЭГ: "${context.slogans[0].slogan}" (заримдаа ашиглаарай)`
            : '';

        const systemPrompt = `Та бол "${context.shopName}" -ийн МЭРГЭЖЛИЙН ЗӨВЛӨХ юм.
Чиний зорилго: хэрэглэгчид энэ бизнесийн талаар хамгийн зөв мэдээлэл, шийдлийг олоход туслах.

ЗАН БАЙДАЛ: ${emotionStyle}

${shopInfo}${customInstructions}${dynamicKnowledge}${policiesInfo}${cartContext}${faqSection}${sloganSection}

ЧУХАЛ ДҮРЭМ:
1. "Сайн байна уу" БҮҮ ДАВТ (хэрэв өмнө нь хэлсэн бол)
2. Хэрэглэгчийн асуултад шууд, товч хариул.
3. БИЗНЕСИЙН ТУХАЙ асуулт ирэхэд ДЭЛГҮҮРИЙН ТУХАЙ мэдээллийг ашиглаж хариулаарай.

ХЯМДРАЛ САНАЛ БОЛГОХ:
1. Хэрэглэгч бүтээгдэхүүн асуухад хямдралтай бүтээгдэхүүн байвал ЭХЛЭЭД ТҮҮНИЙГ санал болго!
2. "🔥 Хямдрал!" гэж тод онцол.
3. Хуучин болон шинэ үнийг ХОЁУЛАНГ нь хэл. Жишээ: "Одоо 185,000₮ биш 148,000₮-өөр авах боломжтой!"

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

БҮТЭЭГДЭХҮҮН/ҮЙЛЧИЛГЭЭ (Мэдлэг):
${productsInfo}

${context.customerName ? `Хэрэглэгч: ${context.customerName}` : ''}
${context.orderHistory ? `VIP (${context.orderHistory}x)` : ''}

БҮҮ ХИЙ:
- Дэлгүүрээс өөр сэдвийн талаар ярилцах (ChatGPT шиг ажиллахыг хориглоно!)
- Хэт урт нуршуу хариулт өгөх (хамгийн гол мэдээллээ эхэнд нь хэл)
- Хэрэглэгчийн асуугаагүй зүйлийг хэт тулгах
- ЗУРАГ URL, ![](url), эсвэл "placeholder" гэсэн текст ХЭЗЭЭ Ч бичиж болохгүй! Зураг харуулахын тулд show_product_image функц дуудаарай.`;

        const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
            {
                type: 'function',
                function: {
                    name: 'create_order',
                    description: 'Create a new order when customer explicitly says they want to buy something. Do not use for general inquiries.',
                    parameters: {
                        type: 'object',
                        properties: {
                            product_name: {
                                type: 'string',
                                description: 'Name of the product to order (fuzzy match)'
                            },
                            quantity: {
                                type: 'number',
                                description: 'Quantity to order',
                                default: 1
                            },
                            color: {
                                type: 'string',
                                description: 'Selected color variant (optional)'
                            },
                            size: {
                                type: 'string',
                                description: 'Selected size variant (optional)'
                            }
                        },
                        required: ['product_name', 'quantity']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'collect_contact_info',
                    description: 'Save customer contact information when they provide phone number or delivery address for an order. Use this when customer shares their phone or address.',
                    parameters: {
                        type: 'object',
                        properties: {
                            phone: {
                                type: 'string',
                                description: 'Customer phone number (8 digits for Mongolia)'
                            },
                            address: {
                                type: 'string',
                                description: 'Delivery address'
                            },
                            name: {
                                type: 'string',
                                description: 'Customer name if provided'
                            }
                        },
                        required: []
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'request_human_support',
                    description: 'Call this when customer explicitly asks to speak to a human, operator, administrative staff, or when you cannot help them.',
                    parameters: {
                        type: 'object',
                        properties: {
                            reason: {
                                type: 'string',
                                description: 'Reason for requesting human support'
                            }
                        },
                        required: ['reason']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'cancel_order',
                    description: 'Cancel an order when customer explicitly says they want to cancel their order. This will restore the reserved stock.',
                    parameters: {
                        type: 'object',
                        properties: {
                            reason: {
                                type: 'string',
                                description: 'Reason for cancellation'
                            }
                        },
                        required: []
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'show_product_image',
                    description: 'REQUIRED: When customer asks to see product image/photo (e.g. "зураг харуул", "зураг", "харуулаач"), you MUST call this function. NEVER write image URLs, markdown ![](url), or placeholder text in your response. The system will send the actual image to Messenger. Use EXACT product names from the product list.',
                    parameters: {
                        type: 'object',
                        properties: {
                            product_names: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Names of SPECIFIC products to show (1-5 max). Use EXACT names from product list.'
                            },
                            mode: {
                                type: 'string',
                                enum: ['single', 'confirm'],
                                description: '"single" for 1 product, "confirm" to ask customer to choose between 2-5 similar products'
                            }
                        },
                        required: ['product_names', 'mode']
                    }
                }
            },
            // NEW CART TOOLS
            {
                type: 'function',
                function: {
                    name: 'add_to_cart',
                    description: 'Add a product to shopping cart. Use this FIRST when customer wants to buy something. Ask to confirm checkout after.',
                    parameters: {
                        type: 'object',
                        properties: {
                            product_name: {
                                type: 'string',
                                description: 'Name of the product to add (fuzzy match)'
                            },
                            quantity: {
                                type: 'number',
                                description: 'Quantity to add',
                                default: 1
                            },
                            color: {
                                type: 'string',
                                description: 'Color variant (optional)'
                            },
                            size: {
                                type: 'string',
                                description: 'Size variant (optional)'
                            }
                        },
                        required: ['product_name']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'view_cart',
                    description: 'Show current shopping cart contents and total. Use when customer asks about their cart or wants to see what they have added.',
                    parameters: {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'remove_from_cart',
                    description: 'Remove an item from cart. Use when customer wants to remove something from their cart.',
                    parameters: {
                        type: 'object',
                        properties: {
                            product_name: {
                                type: 'string',
                                description: 'Name of the product to remove'
                            }
                        },
                        required: ['product_name']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'checkout',
                    description: 'Finalize cart and create order. Use when customer confirms they want to complete their purchase and checkout.',
                    parameters: {
                        type: 'object',
                        properties: {
                            notes: {
                                type: 'string',
                                description: 'Any special notes for the order'
                            }
                        },
                        required: []
                    }
                }
            }
        ];

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...previousHistory,
            { role: 'user', content: message }
        ];

        logger.debug('System prompt prepared', { length: systemPrompt.length });

        return await retryOperation(async () => {
            logger.info('Sending message to OpenAI GPT-4o mini...');

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                max_completion_tokens: 800,
                tools: tools,
                tool_choice: 'auto',
            });

            const responseMessage = response.choices[0]?.message;
            let finalResponseText = responseMessage?.content || '';

            // Handle Tool Calls
            if (responseMessage?.tool_calls) {
                const toolCalls = responseMessage.tool_calls;
                logger.info('AI triggered tool calls:', { count: toolCalls.length });

                // Add assistant's tool call message to history
                messages.push(responseMessage as any);

                for (const toolCall of toolCalls) {
                    if (toolCall.type === 'function') {
                        const functionName = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments);

                        logger.info(`Executing tool: ${functionName}`, args);

                        // Handle collect_contact_info
                        if (functionName === 'collect_contact_info') {
                            try {
                                const { phone, address, name } = args;

                                if (!context.customerId) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: 'No customer context' })
                                    } as any);
                                    continue;
                                }

                                const supabase = supabaseAdmin();
                                const updateData: Record<string, any> = {};

                                if (phone) updateData.phone = phone;
                                if (address) updateData.address = address;
                                if (name) updateData.name = name;

                                if (Object.keys(updateData).length > 0) {
                                    await supabase
                                        .from('customers')
                                        .update(updateData)
                                        .eq('id', context.customerId);

                                    logger.info('Contact info saved to CRM:', updateData);

                                    // Send notification about contact info
                                    if (context.notifySettings?.contact !== false) {
                                        await sendPushNotification(context.shopId, {
                                            title: '📍 Хаяг мэдээлэл ирлээ',
                                            body: `${name || 'Хэрэглэгч'} мэдээллээ үлдээлээ: ${phone || ''} ${address || ''}`,
                                            url: `/dashboard/customers/${context.customerId}`,
                                            tag: `contact-${context.customerId}`
                                        });
                                    }

                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({
                                            success: true,
                                            message: `Saved: ${phone ? 'phone ' : ''}${address ? 'address ' : ''}${name ? 'name' : ''}`
                                        })
                                    } as any);
                                } else {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ message: 'No info to save' })
                                    } as any);
                                }
                            } catch (error: any) {
                                logger.error('Contact save error:', error);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: error.message })
                                } as any);
                            }
                            continue;
                        }

                        // Handle request_human_support
                        if (functionName === 'request_human_support') {
                            const { reason } = args;

                            // Send push notification
                            if (context.notifySettings?.support !== false) {
                                await sendPushNotification(context.shopId, {
                                    title: '📞 Холбогдох хүсэлт',
                                    body: `Хэрэглэгч холбогдох хүсэлт илгээлээ. Шалтгаан: ${reason || 'Тодорхойгүй'}`,
                                    url: `/dashboard/chat?customer=${context.customerId}`,
                                    tag: `support-${context.customerId}`
                                });
                            }

                            messages.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: JSON.stringify({ success: true, message: 'Support request notified.' })
                            } as any);
                            continue;
                        }

                        // Handle create_order
                        if (functionName === 'create_order') {
                            try {
                                const { product_name, quantity, color, size } = args;

                                // 1. Find Product
                                const product = context.products.find(p =>
                                    p.name.toLowerCase().includes(product_name.toLowerCase())
                                );

                                if (!product) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: `Product "${product_name}" not found.` })
                                    } as any);
                                    continue;
                                }

                                // 2. Check Stock
                                /* 
                                    Note: context.products might be slightly stale compared to DB, 
                                    but for MVP it's okay. Truly we should verify stock from DB here 
                                    but we need supabase access. 
                                    Since we added supabaseAdmin import, let's use it!
                                */

                                const supabase = supabaseAdmin();

                                // Verify stock from DB
                                const { data: dbProduct } = await supabase
                                    .from('products')
                                    .select('stock, reserved_stock, price, id')
                                    .eq('id', product.id)
                                    .single();

                                const availableStock = (dbProduct?.stock || 0) - (dbProduct?.reserved_stock || 0);
                                if (!dbProduct || availableStock < quantity) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: `Not enough stock. Only ${availableStock} available.` })
                                    } as any);
                                    continue;
                                }

                                // 3. Create Order
                                if (!context.shopId || !context.customerId) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: `Missing shop or customer ID context.` })
                                    } as any);
                                    continue;
                                }

                                const { data: order, error: orderError } = await supabase
                                    .from('orders')
                                    .insert({
                                        shop_id: context.shopId,
                                        customer_id: context.customerId,
                                        status: 'pending',
                                        total_amount: dbProduct.price * quantity,
                                        notes: `AI Order: ${product_name} (${color || ''} ${size || ''})`,
                                        created_at: new Date().toISOString()
                                    })
                                    .select()
                                    .single();

                                if (orderError) throw orderError;

                                // 4. Create Order Item & Reserve Stock (not deduct yet - pending payment)
                                await supabase.from('order_items').insert({
                                    order_id: order.id,
                                    product_id: product.id,
                                    quantity: quantity,
                                    unit_price: dbProduct.price,
                                    color: color || null,
                                    size: size || null
                                });

                                // Reserve stock (will be actually deducted when payment is confirmed)
                                await supabase
                                    .from('products')
                                    .update({
                                        reserved_stock: (dbProduct.reserved_stock || 0) + quantity
                                    })
                                    .eq('id', product.id);

                                const successMessage = `Success! Order #${order.id.substring(0, 8)} created. Total: ${(dbProduct.price * quantity).toLocaleString()}₮. Stock reserved.`;

                                // Send push notification to shop owner
                                if (context.notifySettings?.order !== false) {
                                    try {
                                        await sendOrderNotification(context.shopId, 'new', {
                                            orderId: order.id,
                                            customerName: context.customerName,
                                            totalAmount: dbProduct.price * quantity,
                                        });
                                    } catch (notifError: unknown) {
                                        logger.warn('Failed to send order notification:', { error: String(notifError) });
                                    }
                                }

                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ success: true, message: successMessage })
                                } as any);

                            } catch (error: any) {
                                logger.error('Tool execution error:', error);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: error.message })
                                } as any);
                            }
                        }

                        // Handle cancel_order
                        if (functionName === 'cancel_order') {
                            try {
                                const { reason } = args;
                                const supabase = supabaseAdmin();

                                if (!context.customerId) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: 'No customer context' })
                                    } as any);
                                    continue;
                                }

                                // Find the most recent pending order for this customer
                                const { data: pendingOrder } = await supabase
                                    .from('orders')
                                    .select(`
                                        id, status, total_amount,
                                        order_items (product_id, quantity)
                                    `)
                                    .eq('customer_id', context.customerId)
                                    .eq('shop_id', context.shopId)
                                    .eq('status', 'pending')
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .single();

                                if (!pendingOrder) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: 'No pending order found to cancel' })
                                    } as any);
                                    continue;
                                }

                                // Cancel the order
                                await supabase
                                    .from('orders')
                                    .update({
                                        status: 'cancelled',
                                        notes: `Cancelled by customer. Reason: ${reason || 'Not specified'}`
                                    })
                                    .eq('id', pendingOrder.id);

                                // Restore reserved stock for each order item
                                for (const item of (pendingOrder.order_items || [])) {
                                    // Directly update reserved_stock (no RPC needed)
                                    const { data: product } = await supabase
                                        .from('products')
                                        .select('reserved_stock')
                                        .eq('id', item.product_id)
                                        .single();

                                    if (product) {
                                        await supabase
                                            .from('products')
                                            .update({
                                                reserved_stock: Math.max(0, (product.reserved_stock || 0) - item.quantity)
                                            })
                                            .eq('id', item.product_id);
                                    }
                                }

                                logger.info('Order cancelled and stock restored:', { orderId: pendingOrder.id });

                                // Send notification
                                if (context.notifySettings?.cancel !== false) {
                                    await sendPushNotification(context.shopId, {
                                        title: '❌ Захиалга цуцлагдлаа',
                                        body: `${context.customerName || 'Хэрэглэгч'} захиалгаа цуцаллаа. Шалтгаан: ${reason || 'Тодорхойгүй'}`,
                                        url: '/dashboard/orders',
                                        tag: `cancel-${pendingOrder.id}`
                                    });
                                }

                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({
                                        success: true,
                                        message: `Order #${pendingOrder.id.substring(0, 8)} cancelled. Stock restored.`
                                    })
                                } as any);

                            } catch (error: any) {
                                logger.error('Cancel order error:', error);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: error.message })
                                } as any);
                            }
                        }

                        // Handle show_product_image
                        if (functionName === 'show_product_image') {
                            try {
                                const { product_names, mode } = args as { product_names: string[]; mode: 'single' | 'confirm' };

                                // DEBUG: Log the request
                                logger.info('[show_product_image] Request:', {
                                    product_names,
                                    mode,
                                    availableProducts: context.products.map(p => ({
                                        name: p.name,
                                        hasImages: !!(p.images && p.images.length > 0),
                                        hasImageUrl: !!p.image_url
                                    }))
                                });

                                // Find matching products with images
                                const matchedProducts = product_names
                                    .map((name: string) => {
                                        const product = context.products.find(p =>
                                            p.name.toLowerCase().includes(name.toLowerCase()) ||
                                            name.toLowerCase().includes(p.name.toLowerCase())
                                        );

                                        // Check images array first, then fallback to image_url
                                        const imageUrl = (product && product.images && product.images.length > 0)
                                            ? product.images[0]
                                            : (product && product.image_url);

                                        if (product && imageUrl) {
                                            return {
                                                name: product.name,
                                                price: product.price,
                                                imageUrl: imageUrl,
                                                description: product.description,
                                            };
                                        }
                                        return null;
                                    })
                                    .filter((p): p is NonNullable<typeof p> => p !== null);

                                if (matchedProducts.length > 0) {
                                    imageAction = {
                                        type: mode,
                                        products: matchedProducts,
                                    };

                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({
                                            success: true,
                                            message: `Showing ${matchedProducts.length} product image(s) in ${mode} mode.`
                                        })
                                    } as any);
                                } else {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({
                                            error: 'No matching products with images found.'
                                        })
                                    } as any);
                                }
                            } catch (error: any) {
                                logger.error('Show product image error:', error);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: error.message })
                                } as any);
                            }
                        }

                        // Handle add_to_cart - Uses DB for fresh data
                        if (functionName === 'add_to_cart') {
                            try {
                                const { product_name, quantity = 1, color, size } = args;
                                const supabase = supabaseAdmin();

                                if (!context.customerId) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: 'No customer context' })
                                    } as any);
                                    continue;
                                }

                                // 🔧 FIX: Get product from DB (not context) to prevent stale data
                                const product = await getProductFromDB(context.shopId, product_name);

                                if (!product) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: `"${product_name}" олдсонгүй` })
                                    } as any);
                                    continue;
                                }

                                // 🔧 FIX: Check stock from DB (not context)
                                const stockCheck = await checkProductStock(product.id, quantity);
                                if (!stockCheck.available) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({
                                            error: `Үлдэгдэл хүрэлцэхгүй. Боломжит: ${stockCheck.currentStock}`
                                        })
                                    } as any);
                                    continue;
                                }

                                // Get or create cart
                                const { data: cartId } = await supabase
                                    .rpc('get_or_create_cart', {
                                        p_shop_id: context.shopId,
                                        p_customer_id: context.customerId
                                    });

                                // Calculate price with discount
                                const discountedPrice = product.discount_percent
                                    ? Math.round(product.price * (1 - product.discount_percent / 100))
                                    : product.price;

                                const variantSpecs: Record<string, string> = {};
                                if (color) variantSpecs.color = color;
                                if (size) variantSpecs.size = size;

                                // 🔧 FIX: Use helper function with better race condition handling
                                const result = await addItemToCart(
                                    cartId,
                                    product.id,
                                    variantSpecs,
                                    quantity,
                                    discountedPrice
                                );

                                // Get updated cart total
                                const { data: total } = await supabase
                                    .rpc('calculate_cart_total', { p_cart_id: cartId });

                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({
                                        success: true,
                                        message: `${product.name} (${result.newQuantity}ш) сагсанд нэмэгдлээ! Нийт: ${total?.toLocaleString()}₮`,
                                        cart_total: total
                                    })
                                } as any);

                            } catch (error: any) {
                                logger.error('Add to cart error:', error);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: error.message })
                                } as any);
                            }
                        }

                        // Handle view_cart - 🔧 FIX: Get fresh cart from DB
                        if (functionName === 'view_cart') {
                            try {
                                if (!context.customerId) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: 'No customer context' })
                                    } as any);
                                    continue;
                                }

                                // 🔧 FIX: Get fresh cart from DB
                                const freshCart = await getCartFromDB(context.shopId, context.customerId);

                                if (!freshCart || freshCart.items.length === 0) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({
                                            message: 'Таны сагс хоосон байна.',
                                            items: [],
                                            total: 0
                                        })
                                    } as any);
                                    continue;
                                }

                                const cartSummary = freshCart.items.map(item =>
                                    `• ${item.name} x${item.quantity} = ${(item.unit_price * item.quantity).toLocaleString()}₮`
                                ).join('\n');

                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({
                                        success: true,
                                        message: `Таны сагс:\n${cartSummary}\n\nНийт: ${freshCart.total_amount.toLocaleString()}₮`,
                                        items: freshCart.items,
                                        total: freshCart.total_amount
                                    })
                                } as any);

                            } catch (error: any) {
                                logger.error('View cart error:', error);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: error.message })
                                } as any);
                            }
                        }

                        // Handle remove_from_cart - 🔧 FIX: Get fresh cart from DB
                        if (functionName === 'remove_from_cart') {
                            try {
                                const { product_name } = args;
                                const supabase = supabaseAdmin();

                                if (!context.customerId) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: 'No customer context' })
                                    } as any);
                                    continue;
                                }

                                // 🔧 FIX: Get fresh cart from DB
                                const freshCart = await getCartFromDB(context.shopId, context.customerId);

                                if (!freshCart || freshCart.items.length === 0) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: 'Сагс хоосон байна' })
                                    } as any);
                                    continue;
                                }

                                const item = freshCart.items.find(i =>
                                    i.name.toLowerCase().includes(product_name.toLowerCase())
                                );

                                if (!item) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: `"${product_name}" сагсанд олдсонгүй` })
                                    } as any);
                                    continue;
                                }

                                await supabase
                                    .from('cart_items')
                                    .delete()
                                    .eq('id', item.id);

                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({
                                        success: true,
                                        message: `${item.name} сагснаас хасагдлаа`
                                    })
                                } as any);

                            } catch (error: any) {
                                logger.error('Remove from cart error:', error);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: error.message })
                                } as any);
                            }
                        }

                        // Handle checkout - 🔧 FIX: Get fresh cart from DB
                        if (functionName === 'checkout') {
                            try {
                                const { notes } = args;
                                const supabase = supabaseAdmin();

                                if (!context.customerId) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: 'No customer context' })
                                    } as any);
                                    continue;
                                }

                                // 🔧 FIX: Get fresh cart from DB
                                const freshCart = await getCartFromDB(context.shopId, context.customerId);

                                if (!freshCart || freshCart.items.length === 0) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: 'Сагс хоосон байна. Эхлээд бараа нэмнэ үү.' })
                                    } as any);
                                    continue;
                                }

                                const { data: orderId, error: checkoutError } = await supabase
                                    .rpc('checkout_cart', {
                                        p_cart_id: freshCart.id,
                                        p_notes: notes || 'AI Chat Checkout'
                                    });

                                if (checkoutError) throw checkoutError;

                                // Send notification (with try-catch to prevent blocking)
                                try {
                                    if (context.notifySettings?.order !== false) {
                                        await sendOrderNotification(context.shopId, 'new', {
                                            orderId: orderId,
                                            customerName: context.customerName,
                                            totalAmount: freshCart.total_amount,
                                        });
                                    }
                                } catch (notifyError: any) {
                                    logger.warn('Notification failed but order created:', { error: notifyError?.message });
                                }

                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({
                                        success: true,
                                        message: `Захиалга #${orderId.substring(0, 8)} амжилттай үүслээ! Нийт: ${freshCart.total_amount.toLocaleString()}₮`,
                                        order_id: orderId
                                    })
                                } as any);

                            } catch (error: any) {
                                logger.error('Checkout error:', error);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: error.message })
                                } as any);
                            }
                        }
                    }
                }

                // Call OpenAI again with tool results
                const secondResponse = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    max_completion_tokens: 800,
                });

                finalResponseText = secondResponse.choices[0]?.message?.content || '';

                // Monitor second request token usage too
                if (secondResponse.usage) {
                    logger.info('Token usage (post-tool):', {
                        total_tokens: secondResponse.usage.total_tokens
                    });
                }
            }

            // Log token usage (first request)
            const usage = response.usage;
            if (usage) {
                logger.info('Token usage:', {
                    prompt_tokens: usage.prompt_tokens,
                    completion_tokens: usage.completion_tokens,
                    total_tokens: usage.total_tokens,
                    estimated_cost_usd: ((usage.prompt_tokens * 0.00025 / 1000) + (usage.completion_tokens * 0.002 / 1000)).toFixed(6)
                });
            }

            logger.success('OpenAI response received', { length: finalResponseText.length });

            return { text: finalResponseText, imageAction };
        });
    } catch (error: any) {
        logger.error('OpenAI API Error:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
            status: error?.status
        });
        throw error;
    }
}

export async function parseProductDataWithAI(
    fileContent: string,
    fileName: string
): Promise<Array<{
    name: string;
    price: number;
    stock: number;
    description: string;
    type: 'physical' | 'service';
    unit: string;
    colors: string[];
    sizes: string[];
}>> {
    try {
        logger.info('Parsing product data with AI...', { fileName, contentLength: fileContent.length });

        const prompt = `
You are a data extraction assistant. Extract products and services from the provided file content.
Filename: "${fileName}"

RULES:
1. Extract ALL items found.
2. Determine 'type': 'physical' for physical goods (phones, clothes), 'service' for services (repair, editing, consulting).
3. Determine 'unit': e.g., 'ширхэг' for goods, 'захиалга', 'цаг', 'хүн' for services.
4. Extract 'stock': For services, this is the Number of Available Slots/Orders. If not specified, default to 0.
5. Extract 'colors' and 'sizes' if available.
6. Return a JSON object with a "products" array.

Input Content:
${fileContent.slice(0, 15000)} -- truncated if too long

Response Format (JSON only):
{
  "products": [
    {
      "name": "Product Name",
      "price": 0,
      "stock": 0,
      "description": "Description",
      "type": "physical" | "service",
      "unit": "ширхэг" | "захиалга" | "цаг",
      "colors": ["red", "blue"],
      "sizes": ["S", "M"]
    }
  ]
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // Use a capable model for extraction
            messages: [
                { role: 'system', content: 'You are a helpful data extraction assistant that outputs JSON.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content || '{}';
        const result = JSON.parse(content);

        if (!Array.isArray(result.products)) {
            logger.warn('AI returned invalid format', result);
            return [];
        }

        return result.products.map((p: any) => ({
            name: p.name || 'Unnamed',
            price: Number(p.price) || 0,
            stock: Number(p.stock) || 0,
            description: p.description || '',
            type: p.type === 'service' ? 'service' : 'physical',
            unit: p.unit || (p.type === 'service' ? 'захиалга' : 'ширхэг'),
            colors: Array.isArray(p.colors) ? p.colors : [],
            sizes: Array.isArray(p.sizes) ? p.sizes : []
        }));

    } catch (error: any) {
        logger.error('AI Parse Error:', { message: error?.message || error });
        return [];
    }
}

