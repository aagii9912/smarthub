import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { formatMemoryForPrompt, type CustomerMemory } from '@/lib/ai/tools/memory';
import { persistTokenUsage } from '@/lib/ai/tokenUsage';
import { logger } from '@/lib/utils/logger';
import { headers } from 'next/headers';

const SUMMARY_MODEL = 'gemini-3.1-flash-lite-preview';
const HISTORY_LIMIT = 30;
const COMPLAINT_LIMIT = 5;
const RATE_LIMIT_SECONDS = 30;
const MAX_OUTPUT_TOKENS = 320;

interface ChatRow {
    message: string | null;
    response: string | null;
    created_at: string;
}

interface ComplaintRow {
    complaint_type: string;
    severity: string;
    status: string;
    description: string;
}

async function resolveShopId(): Promise<string | null> {
    const authShop = await getAuthUserShop();
    if (authShop) return authShop.id;
    const headerList = await headers();
    return headerList.get('x-shop-id');
}

function buildSummaryPrompt(args: {
    name: string | null;
    totalOrders: number;
    totalSpent: number;
    isVip: boolean;
    memory: CustomerMemory | null;
    complaints: ComplaintRow[];
    chatRows: ChatRow[];
}): string {
    const memoryBlock = formatMemoryForPrompt(args.memory).trim() || 'Хоосон';

    const complaintLines = args.complaints.length
        ? args.complaints
              .map((c) => `- [${c.severity}] ${c.complaint_type}: ${c.description}`)
              .join('\n')
        : 'Идэвхтэй гомдол алга';

    const chatLines: string[] = [];
    for (const row of args.chatRows) {
        if (row.message && row.message.trim()) {
            chatLines.push(`Зочин: ${row.message.trim()}`);
        }
        if (row.response && row.response.trim()) {
            chatLines.push(`AI: ${row.response.trim()}`);
        }
    }
    const conversationBlock = chatLines.length
        ? chatLines.join('\n')
        : 'Мессеж байхгүй';

    return `Чи Mongol хэлээр ажилладаг туслах. Дэлгүүрийн эзэн зочинтой ярилцахаасаа өмнө нөхцөл байдлыг хурдан ойлгоход нь туслана.

ХЭРЭГЛЭГЧ:
- Нэр: ${args.name || 'Үл мэдэгдэх'}
- Захиалгын тоо: ${args.totalOrders}, нийт төгрөг: ${args.totalSpent}
- VIP: ${args.isVip ? 'тийм' : 'үгүй'}

САНАХ ОЙ (өмнө сурсан):
${memoryBlock}

ИДЭВХТЭЙ ГОМДОЛ:
${complaintLines}

СҮҮЛИЙН МЕССЕЖҮҮД:
${conversationBlock}

ҮҮРЭГ:
4–6 тэмдэгт цэгийн (•) тэмдэглэл бичээрэй. Маш товч (нэг өгүүлбэр тутамд). Дараах асуултуудад хариул:
1. Зочин юу хүсэж байна?
2. Шийдэгдээгүй асуудал байгаа юу?
3. Эзэн юу хийх ёстой вэ?

Зөвхөн тэмдэглэл буцаа. Эхлэл, төгсгөлийн тайлбар бүү бич. Мөр бүрийг "•" -ээр эхлүүлээрэй.`;
}

export async function POST(
    _req: NextRequest,
    ctx: { params: Promise<{ customerId: string }> }
) {
    try {
        const { customerId } = await ctx.params;

        const shopId = await resolveShopId();
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'AI provider not configured' },
                { status: 503 }
            );
        }

        const supabase = supabaseAdmin();

        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select(
                'id, name, total_orders, total_spent, is_vip, ai_memory, ai_summary, ai_summary_updated_at, ai_summary_message_count'
            )
            .eq('id', customerId)
            .eq('shop_id', shopId)
            .single();

        if (customerError || !customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        if (customer.ai_summary && customer.ai_summary_updated_at) {
            const ageMs = Date.now() - new Date(customer.ai_summary_updated_at).getTime();
            if (ageMs < RATE_LIMIT_SECONDS * 1000) {
                return NextResponse.json({
                    summary: customer.ai_summary,
                    updated_at: customer.ai_summary_updated_at,
                    message_count: customer.ai_summary_message_count ?? 0,
                    cached: true,
                });
            }
        }

        const [chatsResult, complaintsResult, totalCountResult] = await Promise.all([
            supabase
                .from('chat_history')
                .select('message, response, created_at')
                .eq('customer_id', customerId)
                .eq('shop_id', shopId)
                .order('created_at', { ascending: false })
                .limit(HISTORY_LIMIT),
            supabase
                .from('customer_complaints')
                .select('complaint_type, severity, status, description')
                .eq('customer_id', customerId)
                .eq('shop_id', shopId)
                .in('status', ['new', 'in_progress'])
                .order('created_at', { ascending: false })
                .limit(COMPLAINT_LIMIT),
            supabase
                .from('chat_history')
                .select('id', { count: 'exact', head: true })
                .eq('customer_id', customerId)
                .eq('shop_id', shopId),
        ]);

        const chatRows = ((chatsResult.data ?? []) as ChatRow[]).reverse();
        const complaints = (complaintsResult.data ?? []) as ComplaintRow[];
        const totalChatRows = totalCountResult.count ?? chatRows.length;

        const prompt = buildSummaryPrompt({
            name: customer.name,
            totalOrders: customer.total_orders ?? 0,
            totalSpent: Number(customer.total_spent ?? 0),
            isVip: !!customer.is_vip,
            memory: (customer.ai_memory ?? null) as CustomerMemory | null,
            complaints,
            chatRows,
        });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: SUMMARY_MODEL,
            generationConfig: {
                temperature: 0.3,
                topP: 0.85,
                topK: 40,
                maxOutputTokens: MAX_OUTPUT_TOKENS,
            },
        });

        let summaryText = '';
        try {
            const result = await model.generateContent(prompt);
            summaryText = result.response.text().trim();
            const tokensUsed = result.response.usageMetadata?.totalTokenCount ?? 0;
            if (tokensUsed > 0) {
                persistTokenUsage(shopId, tokensUsed, 'ai_memo', { model: SUMMARY_MODEL }).catch(() => {});
            }
        } catch (genError: unknown) {
            const msg = genError instanceof Error ? genError.message : 'Unknown';
            logger.error('Summary generation failed', { customerId, error: msg });
            return NextResponse.json(
                { error: 'Failed to generate summary', details: msg },
                { status: 502 }
            );
        }

        if (!summaryText) {
            return NextResponse.json(
                { error: 'Empty summary returned' },
                { status: 502 }
            );
        }

        const nowIso = new Date().toISOString();

        const { error: updateError } = await supabase
            .from('customers')
            .update({
                ai_summary: summaryText,
                ai_summary_updated_at: nowIso,
                ai_summary_message_count: totalChatRows,
                ai_summary_locale: 'mn',
            })
            .eq('id', customerId)
            .eq('shop_id', shopId);

        if (updateError) {
            logger.warn('Summary update failed (non-blocking)', {
                customerId,
                error: updateError.message,
            });
        }

        return NextResponse.json({
            summary: summaryText,
            updated_at: nowIso,
            message_count: totalChatRows,
            cached: false,
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Summary API error:', { error: errMsg });
        return NextResponse.json(
            { error: 'Internal server error', details: errMsg },
            { status: 500 }
        );
    }
}
