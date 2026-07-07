/**
 * POST /api/v1/chat — Public AI chat API (API key auth)
 *
 * Гуравдагч талын төсөл дэлгүүрийн AI чат агентад хандах нийтийн endpoint.
 * Баталгаажуулалт: `Authorization: Bearer sk_live_...` эсвэл `x-api-key`.
 *
 * Stateless: сервер тал ярианы түүх хадгалахгүй. Олон эргэлтийн context
 * хэрэгтэй бол дуудагч `history: [{ role, content }]` дамжуулна.
 *
 * Body:
 *   {
 *     "message": "Сайн байна уу, ямар бараа байгаа вэ?",
 *     "history": [
 *       { "role": "user", "content": "..." },
 *       { "role": "assistant", "content": "..." }
 *     ]
 *   }
 *
 * Returns: { text: string, usage?: {...} }
 *   401 — түлхүүр буруу/байхгүй
 *   402 — токен/эрхийн хязгаарт хүрсэн (limitReached)
 *   429 — rate limit хэтэрсэн
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveApiKey } from '@/lib/api-keys';
import { supabaseAdmin } from '@/lib/supabase';
import { routeToAI } from '@/lib/ai/AIRouter';
import { getAIFeatures, mapShopProductsToAI } from '@/lib/webhook/services/shop.service';
import {
    checkRateLimit,
    createRateLimitResponse,
    RATE_LIMIT_CONFIGS,
} from '@/lib/utils/rate-limiter';
import { logger } from '@/lib/utils/logger';
import type { AgentRole, AgentCapability } from '@/lib/ai/agents/types';
import type { AIEmotion, ChatMessage, CrossCuttingConfig } from '@/types/ai';

const bodySchema = z.object({
    message: z.string().trim().min(1, 'message is required').max(1000, 'message too long (max 1000)'),
    history: z
        .array(
            z.object({
                role: z.enum(['user', 'assistant']),
                content: z.string().trim().min(1).max(4000),
            }),
        )
        .max(20)
        .optional(),
});

export async function POST(request: NextRequest) {
    try {
        // 1) API key баталгаажуулалт
        const key = await resolveApiKey(request);
        if (!key) {
            return NextResponse.json(
                { error: 'Invalid or missing API key' },
                { status: 401 },
            );
        }

        // 2) Per-key rate limit (strict — AI дуудлага үнэтэй)
        const rl = await checkRateLimit(`apikey:${key.keyId}`, RATE_LIMIT_CONFIGS.strict);
        if (!rl.allowed) {
            return createRateLimitResponse(rl.resetAt);
        }

        // 3) Body validation
        const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
                { status: 400 },
            );
        }
        const { message, history } = parsed.data;

        // 4) Дэлгүүр + бүтээгдэхүүн + AI feature-үүдийг ачаална (preview route-тай ижил)
        const supabase = supabaseAdmin();
        const { data: shopRow } = await supabase
            .from('shops')
            .select('*, products(*)')
            .eq('id', key.shopId)
            .single();

        if (!shopRow) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        const s = shopRow as unknown as Record<string, unknown>;
        const aiFeatures = await getAIFeatures(key.shopId);
        const products = mapShopProductsToAI(
            (s as { products?: Parameters<typeof mapShopProductsToAI>[0] }).products,
        );

        // 5) Дуудагчийн түүхийг ChatMessage[] руу хөрвүүлнэ (assistant → assistant,
        // AIRouter доторх toGeminiHistory нь 'assistant'-г Gemini 'model' болгоно).
        const previousHistory: ChatMessage[] = (history ?? []).map((m) => ({
            role: m.role,
            content: m.content,
        }));

        // 6) AI router-ийг дуудна
        const response = await routeToAI(
            message,
            {
                shopId: key.shopId,
                userId: key.userId,
                customerId: undefined,
                shopName: (s.name as string) ?? 'Дэлгүүр',
                shopDescription: (s.description as string | null) ?? undefined,
                aiInstructions: (s.ai_instructions as string | null) ?? undefined,
                aiEmotion: ((s.ai_emotion as AIEmotion) ?? 'friendly') as AIEmotion,
                aiAgentRole: (s.ai_agent_role as AgentRole) ?? 'sales',
                aiAgentCapabilities: (s.ai_agent_capabilities as AgentCapability[]) ?? ['sales'],
                aiAgentName: (s.ai_agent_name as string | null) ?? undefined,
                crossCutting:
                    ((s.ai_agent_config as { cross_cutting?: CrossCuttingConfig | null } | null)
                        ?.cross_cutting ?? undefined) as CrossCuttingConfig | undefined,
                products,
                customerName: 'Хэрэглэгч',
                orderHistory: 0,
                faqs: aiFeatures.faqs,
                quickReplies: aiFeatures.quickReplies,
                slogans: aiFeatures.slogans,
                customKnowledge: (s.custom_knowledge as Record<string, unknown> | null) ?? undefined,
                subscription: {
                    plan: (s.subscription_plan as string | null) ?? 'starter',
                    status: (s.subscription_status as string | null) ?? 'active',
                    trialEndsAt: (s.trial_ends_at as string | null) ?? undefined,
                },
                messageCount: 0,
                tokenUsageTotal: (s.token_usage_total as number | undefined) ?? 0,
            },
            previousHistory,
        );

        if (response.limitReached) {
            return NextResponse.json(
                { error: response.text || 'Token limit reached', limitReached: true },
                { status: 402 },
            );
        }

        return NextResponse.json(
            { text: response.text, usage: response.usage },
            { headers: { 'X-RateLimit-Remaining': String(rl.remaining) } },
        );
    } catch (err) {
        logger.error('POST /api/v1/chat error', { error: err });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
