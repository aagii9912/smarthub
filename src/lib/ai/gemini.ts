import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',  // ✅ Зөв model нэр
    generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
    },
});

export interface ChatContext {
    shopName: string;
    products: Array<{
        id: string;
        name: string;
        price: number;
        stock: number;
        description?: string;
    }>;
    customerName?: string;
    orderHistory?: number;
}

export async function generateChatResponse(
    message: string,
    context: ChatContext
): Promise<string> {
    try {
        console.log('🔍 generateChatResponse called with:', {
            message,
            contextShopName: context.shopName,
            productsCount: context.products?.length || 0
        });

        // Validate context
        if (!context.shopName) {
            throw new Error('Shop name is required');
        }

        if (!Array.isArray(context.products)) {
            console.warn('⚠️ Products is not an array, converting to empty array');
            context.products = [];
        }

        const productsInfo = context.products.length > 0
            ? context.products.map(p => `- ${p.name}: ${p.price.toLocaleString()}₮ (${p.stock > 0 ? `${p.stock} ширхэг байна` : 'Дууссан'})`).join('\n')
            : '- Одоогоор бүтээгдэхүүн бүртгэгдээгүй байна';

        const systemPrompt = `Та "${context.shopName}" дэлгүүрийн AI туслах юм.

Таны үүрэг:
- Хэрэглэгчдэд эелдэг, найрсаг хариулах
- Бүтээгдэхүүний мэдээлэл өгөх
- Үнэ, үлдэгдэл хэлэх
- Захиалга авахад туслах
- Монгол хэлээр харилцах

Боломжит бүтээгдэхүүнүүд:
${productsInfo}

${context.customerName ? `Хэрэглэгчийн нэр: ${context.customerName}` : ''}
${context.orderHistory ? `Өмнө ${context.orderHistory} удаа захиалга өгсөн` : ''}

Дүрэм:
1. Байхгүй бараа зараад болохгүй
2. Үнийг ₮ тэмдэгтэй бичих
3. Хэт урт хариу бичихгүй байх (2-3 өгүүлбэр хангалттай)
4. Cross-sell хийх боломжтой бол санал болгох`;

        console.log('📝 System prompt prepared, length:', systemPrompt.length);

        const chat = geminiModel.startChat({
            history: [],
        });

        console.log('💬 Sending message to Gemini...');
        const result = await chat.sendMessage(`${systemPrompt}\n\nХэрэглэгчийн мессеж: ${message}`);
        
        const responseText = result.response.text();
        console.log('✅ Gemini response received, length:', responseText.length);
        
        return responseText;
    } catch (error: any) {
        console.error('❌ Gemini API Error:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
            response: error?.response
        });
        throw error; // Re-throw to be handled by caller
    }
}
