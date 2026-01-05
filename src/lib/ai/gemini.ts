import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
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
    const systemPrompt = `Та "${context.shopName}" дэлгүүрийн AI туслах юм.

Таны үүрэг:
- Хэрэглэгчдэд эелдэг, найрсаг хариулах
- Бүтээгдэхүүний мэдээлэл өгөх
- Үнэ, үлдэгдэл хэлэх
- Захиалга авахад туслах
- Монгол хэлээр харилцах

Боломжит бүтээгдэхүүнүүд:
${context.products.map(p => `- ${p.name}: ${p.price.toLocaleString()}₮ (${p.stock > 0 ? `${p.stock} ширхэг байна` : 'Дууссан'})`).join('\n')}

${context.customerName ? `Хэрэглэгчийн нэр: ${context.customerName}` : ''}
${context.orderHistory ? `Өмнө ${context.orderHistory} удаа захиалга өгсөн` : ''}

Дүрэм:
1. Байхгүй бараа зараад болохгүй
2. Үнийг ₮ тэмдэгтэй бичих
3. Хэт урт хариу бичихгүй байх
4. Cross-sell хийх боломжтой бол санал болгох`;

    const chat = geminiModel.startChat({
        history: [],
    });

    const result = await chat.sendMessage(`${systemPrompt}\n\nХэрэглэгчийн мессеж: ${message}`);
    return result.response.text();
}
