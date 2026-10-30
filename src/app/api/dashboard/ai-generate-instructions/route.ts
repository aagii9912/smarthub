import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { logger } from '@/lib/utils/logger';
import { persistTokenUsage } from '@/lib/ai/tokenUsage';
import { isAnthropicConfigured, resolveBackendModel, simpleCompletion } from '@/lib/ai/anthropicClient';

const PROMPT_GEN_MODEL = resolveBackendModel();

/**
 * POST /api/dashboard/ai-generate-instructions
 * Generate or improve AI agent system instructions using Claude
 */
export async function POST(request: NextRequest) {
    try {
        // Validates that the authed user owns the shop from x-shop-id
        // (falls back to the user's first shop when the header is absent).
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const shopId = shop.id;

        if (!isAnthropicConfigured()) {
            return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
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

        let generatedText = '';
        let tokensUsed = 0;
        try {
            const result = await simpleCompletion({ prompt, model: PROMPT_GEN_MODEL, maxTokens: 1024 });
            generatedText = result.text;
            tokensUsed = result.tokensUsed;
        } catch (aiError: unknown) {
            logger.error('Anthropic API error:', {
                status: (aiError as { status?: number })?.status,
                message: aiError instanceof Error ? aiError.message : String(aiError),
            });
            return NextResponse.json({ error: 'AI service error' }, { status: 502 });
        }

        if (!generatedText.trim()) {
            return NextResponse.json({ error: 'AI returned empty result' }, { status: 500 });
        }

        if (tokensUsed > 0) {
            persistTokenUsage(shopId, tokensUsed, 'system_prompt_gen', { model: PROMPT_GEN_MODEL }).catch(() => {});
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
