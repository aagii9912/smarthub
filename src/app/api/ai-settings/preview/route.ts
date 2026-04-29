/**
 * POST /api/ai-settings/preview
 *
 * Run a single AI turn against a draft (unsaved) agent config so the user
 * can preview their setup live in the wizard. The draft does NOT touch
 * persistent shop state — instead, the request body carries an override
 * payload that the AI router consumes for one call.
 *
 * Body:
 *   {
 *     message: string;
 *     draft: {
 *       agentRole: AgentRole;
 *       capabilities: AgentCapability[];
 *       agentName?: string;
 *       emotion?: AIEmotion;
 *       instructions?: string;
 *     }
 *   }
 *
 * Returns: { text: string, usedTools?: string[] }
 *
 * Token usage is tracked normally — preview turns count against the
 * shop's monthly token pool.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { routeToAI } from '@/lib/ai/AIRouter';
import { getAIFeatures, mapShopProductsToAI } from '@/lib/webhook/services/shop.service';
import { logger } from '@/lib/utils/logger';
import type { AgentRole, AgentCapability } from '@/lib/ai/agents/types';
import type { AIEmotion } from '@/types/ai';

export async function POST(request: NextRequest) {
    try {
        const shop = await getAuthUserShop();

        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as {
            message?: string;
            draft?: {
                agentRole?: AgentRole;
                capabilities?: AgentCapability[];
                agentName?: string;
                emotion?: AIEmotion;
                instructions?: string;
            };
        };

        if (!body.message || typeof body.message !== 'string' || body.message.length > 500) {
            return NextResponse.json(
                { error: 'message is required (max 500 chars)' },
                { status: 400 },
            );
        }

        const draft = body.draft ?? {};

        const supabase = supabaseAdmin();
        const { data: shopRow } = await supabase
            .from('shops')
            .select('*, products(*)')
            .eq('id', shop.id)
            .single();

        if (!shopRow) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        const aiFeatures = await getAIFeatures(shop.id);
        const products = mapShopProductsToAI(
            (shopRow as unknown as { products?: Parameters<typeof mapShopProductsToAI>[0] }).products,
        );

        const response = await routeToAI(
            body.message,
            {
                shopId: shop.id,
                userId: (shopRow as unknown as { user_id?: string }).user_id,
                customerId: undefined,
                shopName: (shopRow as unknown as { name: string }).name,
                shopDescription: (shopRow as unknown as { description?: string | null }).description ?? undefined,
                aiInstructions: draft.instructions ?? (shopRow as unknown as { ai_instructions?: string | null }).ai_instructions ?? undefined,
                aiEmotion: (draft.emotion ?? (shopRow as unknown as { ai_emotion?: AIEmotion }).ai_emotion ?? 'friendly') as AIEmotion,
                aiAgentRole: draft.agentRole ?? (shopRow as unknown as { ai_agent_role?: AgentRole }).ai_agent_role ?? 'sales',
                aiAgentCapabilities:
                    draft.capabilities ??
                    (shopRow as unknown as { ai_agent_capabilities?: AgentCapability[] }).ai_agent_capabilities ?? ['sales'],
                aiAgentName: draft.agentName ?? (shopRow as unknown as { ai_agent_name?: string | null }).ai_agent_name ?? undefined,
                products,
                customerName: 'Хэрэглэгч',
                orderHistory: 0,
                faqs: aiFeatures.faqs,
                quickReplies: aiFeatures.quickReplies,
                slogans: aiFeatures.slogans,
                customKnowledge: (shopRow as unknown as { custom_knowledge?: Record<string, unknown> | null }).custom_knowledge ?? undefined,
                subscription: {
                    plan: (shopRow as unknown as { subscription_plan?: string | null }).subscription_plan ?? 'starter',
                    status: (shopRow as unknown as { subscription_status?: string | null }).subscription_status ?? 'active',
                    trialEndsAt: (shopRow as unknown as { trial_ends_at?: string | null }).trial_ends_at ?? undefined,
                },
                messageCount: 0,
                tokenUsageTotal: (shopRow as unknown as { token_usage_total?: number }).token_usage_total ?? 0,
            },
            [],
        );

        if (response.limitReached) {
            return NextResponse.json(
                { error: response.text, limitReached: true },
                { status: 402 },
            );
        }

        return NextResponse.json({
            text: response.text,
            usage: response.usage,
        });
    } catch (err) {
        logger.error('preview: error', { error: err });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
