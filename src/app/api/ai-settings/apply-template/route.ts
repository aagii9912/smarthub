/**
 * POST /api/ai-settings/apply-template
 *
 * Body: { templateId: string, replaceExisting?: boolean }
 *
 * Applies a smart-default template (FAQ + slogan + instructions + role/caps)
 * onto the caller's active shop. By default merges with existing data — if
 * `replaceExisting: true`, deletes existing FAQs/slogans first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { getTemplateById } from '@/lib/ai/agents';

export async function POST(request: NextRequest) {
    try {
        const shop = await getAuthUserShop();

        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as {
            templateId?: string;
            replaceExisting?: boolean;
        };

        if (!body.templateId) {
            return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
        }

        const template = getTemplateById(body.templateId);
        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        const supabase = supabaseAdmin();

        // Update shop-level AI fields from the template.
        const shopUpdate = {
            ai_emotion: template.defaultEmotion,
            ai_instructions: template.defaultInstructions,
            ai_agent_role: template.role,
            ai_agent_capabilities: template.capabilities,
            ai_agent_name: template.defaultName,
        };

        const { error: shopErr } = await supabase
            .from('shops')
            .update(shopUpdate)
            .eq('id', shop.id);
        if (shopErr) {
            logger.error('apply-template: shop update failed', { error: shopErr });
            return NextResponse.json({ error: shopErr.message }, { status: 500 });
        }

        // Replace OR merge FAQ rows.
        if (body.replaceExisting) {
            await supabase.from('shop_faqs').delete().eq('shop_id', shop.id);
            await supabase.from('shop_slogans').delete().eq('shop_id', shop.id);
        }

        if (template.suggestedFAQs.length > 0) {
            const faqRows = template.suggestedFAQs.map((f, idx) => ({
                shop_id: shop.id,
                question: f.question,
                answer: f.answer,
                sort_order: idx,
                is_active: true,
            }));
            await supabase.from('shop_faqs').insert(faqRows);
        }

        if (template.suggestedSlogans && template.suggestedSlogans.length > 0) {
            const sloganRows = template.suggestedSlogans.map((s) => ({
                shop_id: shop.id,
                slogan: s,
                usage_context: '',
                is_active: true,
            }));
            await supabase.from('shop_slogans').insert(sloganRows);
        }

        return NextResponse.json({
            ok: true,
            template: {
                id: template.id,
                role: template.role,
                capabilities: template.capabilities,
                defaultName: template.defaultName,
            },
        });
    } catch (err) {
        logger.error('apply-template: error', { error: err });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
