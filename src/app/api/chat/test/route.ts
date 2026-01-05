import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const { message, shopContext } = await request.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const systemPrompt = `Та бол SmartHub AI туслах. Та Монгол хэл дээр харилцагчдад туслах зорилготой.
    
${shopContext ? `Дэлгүүрийн мэдээлэл: ${JSON.stringify(shopContext)}` : ''}

Дүрэм:
- Эелдэг, туслахад бэлэн байна
- Богино, тодорхой хариулт өгнө
- Бүтээгдэхүүний талаар асуувал жагсаалт өгнө
- Захиалга хийхэд тусална`;

        const result = await model.generateContent([
            { text: systemPrompt },
            { text: `Хэрэглэгч: ${message}` }
        ]);

        const response = result.response;
        const aiMessage = response.text();

        return NextResponse.json({
            success: true,
            message: aiMessage,
            model: 'gemini-1.5-flash'
        });

    } catch (error: any) {
        console.error('AI Chat Error:', error);
        return NextResponse.json({
            error: 'AI processing failed',
            details: error.message
        }, { status: 500 });
    }
}
