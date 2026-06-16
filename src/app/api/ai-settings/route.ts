/**
 * AI Settings API
 * CRUD operations for FAQ, Quick Replies, Slogans, and AI Stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { requirePermission, ForbiddenError } from '@/lib/auth/membership';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

function forbiddenResponse(error: unknown): NextResponse | null {
    if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return null;
}

// GET - Fetch all AI settings (FAQs, Quick Replies, Slogans, Stats)
export async function GET(request: NextRequest) {
    try {
        const shop = await getAuthUserShop();

        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'faqs', 'quick_replies', 'slogans', 'stats', or null for all

        const result: Record<string, any> = {};

        // FAQs
        if (!type || type === 'faqs') {
            const { data: faqs, error } = await supabase
                .from('shop_faqs')
                .select('id, shop_id, question, answer, category, sort_order')
                .eq('shop_id', shop.id)
                .order('sort_order', { ascending: true });

            if (!error) result.faqs = faqs || [];
        }

        // Quick Replies
        if (!type || type === 'quick_replies') {
            const { data: quickReplies, error } = await supabase
                .from('shop_quick_replies')
                .select('id, shop_id, name, trigger_words, response, is_exact_match, created_at')
                .eq('shop_id', shop.id)
                .order('created_at', { ascending: false });

            if (!error) result.quickReplies = quickReplies || [];
        }

        // Slogans
        if (!type || type === 'slogans') {
            const { data: slogans, error } = await supabase
                .from('shop_slogans')
                .select('id, shop_id, slogan, usage_context, created_at')
                .eq('shop_id', shop.id)
                .order('created_at', { ascending: false });

            if (!error) result.slogans = slogans || [];
        }

        // Stats
        if (!type || type === 'stats') {
            // Compute live from chat_history / customers / orders. The legacy
            // shops.ai_total_* columns are never populated (update_shop_ai_stats
            // is not invoked anywhere) so they would always read 0.
            const [messagesRes, conversationsRes, ordersRes] = await Promise.all([
                supabase
                    .from('chat_history')
                    .select('id', { count: 'exact', head: true })
                    .eq('shop_id', shop.id),
                supabase
                    .from('customers')
                    .select('id', { count: 'exact', head: true })
                    .eq('shop_id', shop.id)
                    .gt('message_count', 0),
                supabase
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('shop_id', shop.id),
            ]);

            const totalConversations = conversationsRes.count || 0;
            const totalOrders = ordersRes.count || 0;

            const aiStats = {
                total_conversations: totalConversations,
                total_messages: messagesRes.count || 0,
                // Orders per chatted customer (%)
                conversion_rate: totalConversations > 0
                    ? Math.round((totalOrders / totalConversations) * 100)
                    : 0
            };

            // Get top questions (may not exist yet if tables not created)
            interface TopQuestion {
                question_pattern: string;
                sample_question: string;
                category: string;
                count: number;
            }
            let topQuestions: TopQuestion[] = [];
            try {
                const { data, error } = await supabase
                    .from('ai_question_stats')
                    .select('question_pattern, sample_question, category, count')
                    .eq('shop_id', shop.id)
                    .order('count', { ascending: false })
                    .limit(10);
                if (error) {
                    // Table might not exist yet — but log so real failures aren't invisible
                    logger.debug('ai_question_stats query failed:', { error: error.message });
                }
                topQuestions = data || [];
            } catch (e) {
                // Table might not exist yet — but log so real failures aren't invisible
                logger.debug('ai_question_stats query threw:', { error: e instanceof Error ? e.message : String(e) });
            }

            // Get recent conversations count (last 7 days)
            let recentConversations = 0;
            try {
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const { count, error } = await supabase
                    .from('ai_conversations')
                    .select('*', { count: 'exact', head: true })
                    .eq('shop_id', shop.id)
                    .gte('started_at', weekAgo);
                if (error) {
                    // Table might not exist yet — but log so real failures aren't invisible
                    logger.debug('ai_conversations query failed:', { error: error.message });
                }
                recentConversations = count || 0;
            } catch (e) {
                // Table might not exist yet — but log so real failures aren't invisible
                logger.debug('ai_conversations query threw:', { error: e instanceof Error ? e.message : String(e) });
            }

            result.stats = {
                ...aiStats,
                recent_conversations: recentConversations,
                top_questions: topQuestions
            };
        }

        return NextResponse.json(result);
    } catch (error: unknown) {
        logger.error('AI Settings GET error:', { error: error });
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

// POST - Create new FAQ, Quick Reply, or Slogan
export async function POST(request: NextRequest) {
    try {
        // RBAC: AI тохиргоо засах эрх (owner / admin).
        const { shop } = await requirePermission('ai:write');

        const body = await request.json();
        const { type, ...data } = body;

        if (!type) {
            return NextResponse.json({ error: 'Type is required (faqs, quick_replies, slogans)' }, { status: 400 });
        }

        const supabase = supabaseAdmin();
        let tableName: string;
        let insertData: Record<string, any>;

        switch (type) {
            case 'faqs':
                tableName = 'shop_faqs';
                insertData = {
                    shop_id: shop.id,
                    question: data.question,
                    answer: data.answer,
                    category: data.category || 'general',
                    sort_order: data.sort_order || 0
                };
                break;
            case 'quick_replies':
                tableName = 'shop_quick_replies';
                insertData = {
                    shop_id: shop.id,
                    name: data.name,
                    trigger_words: Array.isArray(data.trigger_words)
                        ? data.trigger_words
                        : data.trigger_words.split(',').map((t: string) => t.trim()),
                    response: data.response,
                    is_exact_match: data.is_exact_match || false
                };
                break;
            case 'slogans':
                tableName = 'shop_slogans';
                insertData = {
                    shop_id: shop.id,
                    slogan: data.slogan,
                    usage_context: data.usage_context || 'any'
                };
                break;
            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        const { data: created, error } = await supabase
            .from(tableName)
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data: created });
    } catch (error: unknown) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) return forbidden;
        logger.error('AI Settings POST error:', { error: error });
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

// PATCH - Update FAQ, Quick Reply, or Slogan
export async function PATCH(request: NextRequest) {
    try {
        const { shop } = await requirePermission('ai:write');

        const body = await request.json();
        const { type, id, ...data } = body;

        if (!type || !id) {
            return NextResponse.json({ error: 'Type and ID are required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();
        let tableName: string;

        switch (type) {
            case 'faqs':
                tableName = 'shop_faqs';
                break;
            case 'quick_replies':
                tableName = 'shop_quick_replies';
                // Convert trigger_words string to array if needed
                if (data.trigger_words && typeof data.trigger_words === 'string') {
                    data.trigger_words = data.trigger_words.split(',').map((t: string) => t.trim());
                }
                break;
            case 'slogans':
                tableName = 'shop_slogans';
                break;
            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        const { data: updated, error } = await supabase
            .from(tableName)
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('shop_id', shop.id) // Security: only update own shop's items
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data: updated });
    } catch (error: unknown) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) return forbidden;
        logger.error('AI Settings PATCH error:', { error: error });
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

// DELETE - Remove FAQ, Quick Reply, or Slogan
export async function DELETE(request: NextRequest) {
    try {
        const { shop } = await requirePermission('ai:write');

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const id = searchParams.get('id');

        if (!type || !id) {
            return NextResponse.json({ error: 'Type and ID are required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();
        let tableName: string;

        switch (type) {
            case 'faqs':
                tableName = 'shop_faqs';
                break;
            case 'quick_replies':
                tableName = 'shop_quick_replies';
                break;
            case 'slogans':
                tableName = 'shop_slogans';
                break;
            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', id)
            .eq('shop_id', shop.id); // Security: only delete own shop's items

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) return forbidden;
        logger.error('AI Settings DELETE error:', { error: error });
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
