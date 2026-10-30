import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, ForbiddenError } from '@/lib/auth/membership';
import { parseWithErrors } from '@/lib/validations';
import { loadShopBusinessType, updateShopAutomation } from '@/lib/operator/settings';
import { logger } from '@/lib/utils/logger';

const patchSchema = z
    .object({
        enabled: z.boolean().optional(),
        mode: z.enum(['auto', 'approve']).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
    })
    .strict();

// PATCH /api/dashboard/automations/[slug] — асаах/унтраах, горим, тохиргоо
export async function PATCH(request: Request, ctx: { params: Promise<{ slug: string }> }) {
    try {
        const access = await requirePermission('ai:write');
        const { slug } = await ctx.params;

        const validation = parseWithErrors(patchSchema, await request.json());
        if (!validation.success) {
            return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
        }

        const shopId = access.shop.id;
        const result = await updateShopAutomation(shopId, await loadShopBusinessType(shopId), slug, validation.data);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ automation: result.automation });
    } catch (error: unknown) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        logger.error('Automation PATCH error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 });
    }
}
