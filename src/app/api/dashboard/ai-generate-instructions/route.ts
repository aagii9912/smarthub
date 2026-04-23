import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * POST /api/dashboard/ai-generate-instructions
 * Generate or improve AI agent system instructions using Gemini
 */
export async function POST(request: NextRequest) {
    try {
        const shopId = request.headers.get('x-shop-id');
        if (!shopId) {
            return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
        }

        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
        }

        const { mode, currentInstructions, shopName, shopDescription, emotion } = await request.json();

        // Build the meta-prompt
        let prompt = '';

        if (mode === 'generate') {
            prompt = `Чи Монгол хэл дээр ажиллах AI борлуулалтын агентын заавар бичигч юм.

Дэлгүүрийн мэдээлэл:
- Нэр: ${shopName || 'Тодорхойгүй'}
- Тайлбар: ${shopDescription || 'Тодорхойгүй'}
- AI зан төлөв: ${emotion || 'friendly'}

Дараах шаардлагыг хангасан system prompt (заавар) монгол хэлээр бич:

1. AI агент нь ${shopName || 'энэ дэлгүүрийн'} борлуулалтын мэргэжилтний үүрэг гүйцэтгэнэ
2. Хэрэглэгчийг угтан авах, бараа санал болгох, захиалга авахад чиглүүлэх
3. Үнэ, нөөц, хүргэлтийн талаар тодорхой мэдээлэл өгөх
4. Хэрэглэгчийн сэтгэл ханамжийг дээд зэргээр хангах
5. Хэт урт биш, 150-300 үгтэй байх
6. Bullet point хэлбэрээр бичэгдсэн байх

Зөвхөн зааврын текстийг бич, тайлбар нэмэх хэрэггүй.`;
        } else if (mode === 'improve') {
            prompt = `Чи AI агентын system prompt-г сайжруулагч юм.

Одоогийн заавар:
"""
${currentInstructions}
"""

Дэлгүүрийн мэдээлэл:
- Нэр: ${shopName || 'Тодорхойгүй'}
- Тайлбар: ${shopDescription || 'Тодорхойгүй'}
- AI зан төлөв: ${emotion || 'friendly'}

Дараах зүйлсийг анхааран сайжруулсан хувилбарыг бич:
1. Монгол хэл дээр байх (хэрэв англиар бичсэн бол монголоор хөрвүүл)
2. Борлуулалтын чиглэлд илүү оновчтой болгох
3. Тодорхой, товч бөгөөд үр дүнтэй зааварчилгаа байх
4. Дутуу хэсгийг нэмэх (хүргэлт, буцаалт, утас асуух гэх мэт)
5. 150-300 үгтэй, bullet point хэлбэрээр
6. Өмнөх зааврын сайн талыг хадгалах

Зөвхөн сайжруулсан зааврын текстийг бич, тайлбар нэмэх хэрэггүй.`;
        } else {
            return NextResponse.json({ error: 'Invalid mode. Use "generate" or "improve"' }, { status: 400 });
        }

        // Call Gemini API
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    },
                }),
            }
        );

        if (!geminiRes.ok) {
            const errBody = await geminiRes.text();
            logger.error('Gemini API error:', { status: geminiRes.status, body: errBody });
            return NextResponse.json({ error: 'AI service error' }, { status: 502 });
        }

        const geminiData = await geminiRes.json();
        const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!generatedText.trim()) {
            return NextResponse.json({ error: 'AI returned empty result' }, { status: 500 });
        }

        return NextResponse.json({
            instructions: generatedText.trim(),
            mode,
        });

    } catch (error) {
        logger.error('AI instruction generation error:', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
