import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const { supabase } = await import('@/lib/supabase');
        const body = await request.json();

        const { name, phone, email, company, message } = body;

        if (!name || !phone) {
            return NextResponse.json(
                { error: 'Нэр болон утасны дугаар шаардлагатай' },
                { status: 400 }
            );
        }

        // Generate AI response
        let aiResponse = '';
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
            
            const prompt = `Чи Syncly компанийн найрсаг менежер шүү! 😊

Одоо ${name}${company ? ` (${company}-с)` : ''} Odoo ERP-ийн талаар сонирхож байна. Түүнд ээлтэй, хүн шиг хариулт өг.

${message ? `Түүний хэлсэн зүйл: "${message}"` : 'Ерөнхий сонирхол илэрхийлж байна.'}

Ингэж хариул:
✓ Хүн шиг, найрсаг (AI биш шиг!)
✓ 2-3 өгүүлбэр (богино л хангалттай)
✓ Дараа нь яах талаар санаа өг
✓ Emoji зөв хэрэглэ (хэтрүүлэхгүй)
✓ ${name}-ийн нэрийг ашигла

❌ Бүү хэл: "Танд тусалж чадахдаа баяртай байна", "Манай компани", "Бид таньд үйлчилнэ"
✅ Хэл: Товч, ойлгомжтой, найрсаг!

Хариулт:`;

            const result = await model.generateContent(prompt);
            aiResponse = result.response.text();
        } catch (aiError) {
            logger.error('AI response error:', { error: aiError });
            aiResponse = `Сайн байна уу ${name}! 😊

Таны хүсэлтийг хүлээн авлаа. Бид тантай удахгүй холбогдоно.

Яаралтай байвал ${phone} руу залгаарай!`;
        }

        // Save to database with AI response
        const { data, error } = await supabase
            .from('leads')
            .insert([{ 
                name, 
                phone, 
                email, 
                company, 
                message,
                ai_response: aiResponse 
            }])
            .select()
            .single();

        if (error) {
            logger.error('Lead insert error:', { error: error });
            return NextResponse.json(
                { error: 'Хүсэлт илгээхэд алдаа гарлаа' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data,
            aiResponse
        });

    } catch (error: unknown) {
        logger.error('API Error:', { error: error });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Алдаа гарлаа' },
            { status: 500 }
        );
    }
}

