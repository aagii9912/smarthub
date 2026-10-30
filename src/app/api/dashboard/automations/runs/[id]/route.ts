import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, ForbiddenError } from '@/lib/auth/membership';
import { supabaseAdmin } from '@/lib/supabase';
import { parseWithErrors } from '@/lib/validations';
import { logger } from '@/lib/utils/logger';

const actionSchema = z.object({ action: z.enum(['approve', 'reject', 'done']) }).strict();

/**
 * POST /api/dashboard/automations/runs/[id] — эзний шийдвэр
 *   approve — батлах мессежийг дараалалд буцаана (dispatcher 5 мин дотор илгээнэ)
 *   done    — "залгах" даалгаврыг гүйцэтгэсэн гэж тэмдэглэнэ
 *   reject  — татгалзана
 * Зөвхөн awaiting_approval төлөвтэй, тухайн дэлгүүрийн run (IDOR хамгаалалт).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const access = await requirePermission('inbox:write');
        const { id } = await ctx.params;

        const validation = parseWithErrors(actionSchema, await request.json());
        if (!validation.success) {
            return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
        }
        const { action } = validation.data;

        const db = supabaseAdmin();
        const { data: run } = await db
            .from('agent_runs')
            .select('id, status, subject_type, subject_id, payload, result')
            .eq('id', id)
            .eq('shop_id', access.shop.id)
            .maybeSingle();
        if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (run.status !== 'awaiting_approval') {
            return NextResponse.json({ error: 'Энэ үйлдэл аль хэдийн шийдэгдсэн' }, { status: 409 });
        }

        const isTask = Boolean((run.result as Record<string, unknown> | null)?.task);
        if (action === 'approve' && isTask) {
            return NextResponse.json({ error: 'Даалгаврыг "done" гэж тэмдэглэнэ' }, { status: 400 });
        }
        if (action === 'done' && !isTask) {
            return NextResponse.json({ error: 'Зөвхөн даалгаврыг "done" гэж тэмдэглэнэ' }, { status: 400 });
        }

        const now = new Date().toISOString();
        const patch =
            action === 'approve'
                ? {
                      status: 'queued',
                      scheduled_for: now,
                      attempts: 0,
                      payload: { ...(run.payload as Record<string, unknown>), approved: true, approved_by: access.userId },
                  }
                : action === 'done'
                  ? {
                        status: 'sent',
                        finished_at: now,
                        result: { ...(run.result as Record<string, unknown>), task_done_by: access.userId, task_done_at: now },
                    }
                  : { status: 'rejected', finished_at: now };

        // Зэрэгцээ хоёр товшилтоос сэргийлж төлөвийг нөхцөлтэйгээр шинэчилнэ.
        const { data: updated, error } = await db
            .from('agent_runs')
            .update(patch)
            .eq('id', id)
            .eq('shop_id', access.shop.id)
            .eq('status', 'awaiting_approval')
            .select('id, status')
            .maybeSingle();
        if (error) throw error;
        if (!updated) return NextResponse.json({ error: 'Энэ үйлдэл аль хэдийн шийдэгдсэн' }, { status: 409 });

        // "Залгасан" = холбогдсон: лийдийн дагалтын дараалал (dashboard) болон
        // дараагийн lead_followup даалгавар үүнийг харж тооцно.
        if (action === 'done' && run.subject_type === 'customer' && run.subject_id) {
            const { error: contactErr } = await db
                .from('customers')
                .update({ last_contact_at: now })
                .eq('id', run.subject_id)
                .eq('shop_id', access.shop.id);
            if (contactErr) logger.warn('Automation task done: last_contact_at update failed', { error: contactErr.message });
        }

        return NextResponse.json({ run: updated });
    } catch (error: unknown) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        logger.error('Automation run action error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Failed to update run' }, { status: 500 });
    }
}
