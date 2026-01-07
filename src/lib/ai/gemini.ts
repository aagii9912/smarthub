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
            ? context.products.map(p => {
                const variantInfo = p.variants && p.variants.length > 0
                    ? `\n  Хувилбарууд: ${p.variants.map(v => `${v.color || ''} ${v.size || ''} (${v.stock > 0 ? `${v.stock}ш` : 'Дууссан'})`).join(', ')}`
                    : '';
                return `- ${p.name}: ${p.price.toLocaleString()}₮ (${p.stock > 0 ? `${p.stock}ш байна` : 'Дууссан'})${variantInfo}`;
            }).join('\n')
            : '- Одоогоор бүтээгдэхүүн бүртгэгдээгүй байна';

        const systemPrompt = `
    TASK: You are a helpful AI sales assistant for "${context.shopName}".
    
    INSTRUCTIONS (JSON CONFIG):
    ${JSON.stringify({
        personality: "Friendly, Professional, Helpful",
        language: "Mongolian (Cyrillic)",
        formatting: {
            use_emojis: true,
            max_sentences: 3,
            currency_symbol: "₮"
        },
        rules: [
            "Never output JSON in your response",
            "Only recommend products from the list below",
            "If asked about price, show price in ₮",
            "Do NOT introduce yourself in every message (only if asked)",
            "Keep responses concise and direct"
        ]
    }, null, 2)}

    AVAILABLE PRODUCTS:
    ${productsInfo}

    ${context.customerName ? `CUSTOMER NAME: ${context.customerName}` : ''}
    ${context.orderHistory ? `ORDER HISTORY: ${context.orderHistory} previous orders (VIP Customer)` : ''}

    IMPORTANT: 
    - Read the JSON configuration above for your behavior rules.
    - BUT your final output must be PLAIN TEXT (natural conversation). 
    - DO NOT output JSON objects to the user.
    - Always answer in Mongolian.
    `;

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
