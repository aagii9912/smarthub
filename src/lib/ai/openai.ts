import OpenAI from 'openai';
import { logger } from '@/lib/utils/logger';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

export interface ChatContext {
    shopName: string;
    shopDescription?: string;
    aiInstructions?: string;
    products: Array<{
        id: string;
        name: string;
        price: number;
        stock: number;
        description?: string;
        variants?: Array<{
            color: string | null;
            size: string | null;
            stock: number;
        }>;
    }>;
    customerName?: string;
    orderHistory?: number;
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
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
            model: 'gpt-5-mini',
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
): Promise<string> {
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
                const variantInfo = p.variants && p.variants.length > 0
                    ? `\n  Хувилбарууд: ${p.variants.map(v => `${v.color || ''} ${v.size || ''} (${v.stock > 0 ? `${v.stock}ш` : 'Дууссан'})`).join(', ')}`
                    : '';
                return `- ${p.name}: ${p.price.toLocaleString()}₮ (${p.stock > 0 ? `${p.stock}ш байна` : 'Дууссан'})${variantInfo}`;
            }).join('\n')
            : '- Одоогоор бүтээгдэхүүн бүртгэгдээгүй байна';

        // Build custom instructions section
        const customInstructions = context.aiInstructions
            ? `\nДЭЛГҮҮРИЙН ЭЗНИЙ ЗААВАР:\n${context.aiInstructions}\n`
            : '';

        const shopInfo = context.shopDescription
            ? `\nДЭЛГҮҮРИЙН ТУХАЙ: ${context.shopDescription}`
            : '';

        // Check conversation length for recommendation logic
        const conversationLength = previousHistory.length;
        const shouldRecommend = conversationLength >= 4; // After 2 exchanges (4 messages)

        const systemPrompt = `Та "${context.shopName}" дэлгүүрийн борлуулагч.
${shopInfo}${customInstructions}
ЧУХАЛ ДҮРЭМ:
1. БОГИНО хариулт (1-2 өгүүлбэр). Урт бичвэр бүү бич!
2. "Сайн байна уу" гэж БҮҮ ХЭЛ (зөвхөн эхний удаа л хэлнэ)
3. Энгийн ярианы хэл ашигла
4. Emoji хэрэглэ 😊 гэхдээ 1-2 л
${shouldRecommend ? '5. Одоо бүтээгдэхүүн САНАЛ БОЛГО! Хэрэглэгч хангалттай ярилцсан.' : ''}

ЖИШЭЭ ХАРИУЛТ:
- "50,000₮ шүү 👍"
- "Байгаа, хар өнгө л үлдсэн"
- "Тиймээ хүргэлт үнэгүй 🚚"

БҮТЭЭГДЭХҮҮН:
${productsInfo}

${context.customerName ? `Хэрэглэгч: ${context.customerName}` : ''}
${context.orderHistory ? `VIP (${context.orderHistory}x захиалсан)` : ''}

ХОРИГЛОХ:
- Урт тайлбар бичих
- Давтан мэндлэх
- Хэт олон асуулт тавих`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...previousHistory,
            { role: 'user', content: message }
        ];

        logger.debug('System prompt prepared', { length: systemPrompt.length });

        return await retryOperation(async () => {
            logger.info('Sending message to OpenAI GPT-5 mini...');

            const response = await openai.chat.completions.create({
                model: 'gpt-5-mini',
                messages: messages,
                max_completion_tokens: 800,
            });

            const responseText = response.choices[0]?.message?.content || '';
            logger.success('OpenAI response received', { length: responseText.length });

            return responseText;
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
