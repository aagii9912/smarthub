import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',  // ✅ Updated to latest model
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
        variants?: Array<{
            color: string | null;
            size: string | null;
            stock: number;
        }>;
    }>;
    customerName?: string;
    orderHistory?: number;
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
        console.log('🖼️ analyzeProductImage called for:', imageUrl);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // ✅ Updated
        
        // Fetch image
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

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

        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    mimeType,
                    data: base64Image
                }
            }
        ]);

        const responseText = result.response.text();
        console.log('✅ Vision response:', responseText);

        // Parse JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        return { matchedProduct: null, confidence: 0, description: 'Зургийг таньж чадсангүй.' };
    } catch (error) {
        console.error('❌ Gemini Vision Error:', error);
        return { matchedProduct: null, confidence: 0, description: 'Зураг боловсруулахад алдаа гарлаа.' };
    }
}

export interface RichChatResponse {
    text: string;
    suggestedProducts?: string[];
    quickReplies?: Array<{ title: string; payload: string }>;
}

export async function generateChatResponse(
    message: string,
    context: ChatContext
): Promise<string | RichChatResponse> {
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
            ? context.products.map(p => {
                const variantInfo = p.variants && p.variants.length > 0
                    ? `\n  Хувилбарууд: ${p.variants.map(v => `${v.color || ''} ${v.size || ''} (${v.stock > 0 ? `${v.stock}ш` : 'Дууссан'})`).join(', ')}`
                    : '';
                return `- ${p.name}: ${p.price.toLocaleString()}₮ (${p.stock > 0 ? `${p.stock}ш байна` : 'Дууссан'})${variantInfo}`;
            }).join('\n')
            : '- Одоогоор бүтээгдэхүүн бүртгэгдээгүй байна';

        const systemPrompt = `Та "${context.shopName}" дэлгүүрийн AI худалдагч юм.

Таны үүрэг:
- Барааны мэдээлэл, үнэ, үлдэгдэл (өнгө, размер) хэлэх
- Хэрэв бараа дууссан бол өөр өнгө эсвэл размер санал болгох
- Захиалга авахад туслах (утас, хаяг асуух)
- Заавал монгол хэлээр (кирилл) харилцах

Боломжит бүтээгдэхүүнүүд ба тэдгээрийн хувилбарууд:
${productsInfo}

${context.customerName ? `Хэрэглэгчийн нэр: ${context.customerName}` : ''}
${context.orderHistory ? `Энэ хэрэглэгч өмнө нь ${context.orderHistory} удаа захиалга өгсөн.` : ''}

Дүрэм:
1. Хэрэглэгч мэндлээгүй бол "Сайн байна уу" гэж хэлэх хэрэггүй, шууд асуултад нь хариул.
2. Хэрэглэгч мэндэлсэн үед л хариу мэндчил.
3. Зөвхөн дээрх жагсаалтад байгаа барааг зарах.
4. Үнийг ₮ тэмдэгтэй бичих.
5. Богино, тодорхой хариулах (2-4 өгүүлбэр).

ГАРГАХ ХЭЛБЭР (JSON FORMAT):
Хариултыг ЗААВАЛ дараах JSON бүтэцтэй гаргана уу:
{
  "text": "Таны хэлэх үг (emoji ашигла)",
  "suggestedProducts": ["Бүтээгдэхүүн 1 нэр", "Бүтээгдэхүүн 2 нэр"], // Хэрэв хэрэглэгч бараа асуусан бол энд нэрсийг нь бич (max 5)
  "quickReplies": [ // Хэрэв сонголт өгөх бол (max 3)
     {"title": "Тийм", "payload": "YES"},
     {"title": "Үгүй", "payload": "NO"}
  ]
}

Хэрэглэгч зүгээр мэндэлсэн бол suggestedProducts, quickReplies хоосон байж болно.`;

        console.log('📝 System prompt prepared, length:', systemPrompt.length);

        const chat = geminiModel.startChat({
            history: [],
        });

        console.log('💬 Sending message to Gemini...');
        const result = await chat.sendMessage(`${systemPrompt}\n\nХэрэглэгчийн мессеж: ${message}`);
        
        const responseText = result.response.text();
        console.log('✅ Gemini response received:', responseText);
        
        // Parse JSON
        try {
            // Find JSON object in response (in case Gemini adds markdown blocks)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as RichChatResponse;
            }
        } catch (e) {
            console.error('Failed to parse Gemini JSON, returning text only');
        }

        // Fallback to plain text if JSON parsing fails
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
