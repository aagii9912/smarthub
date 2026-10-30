/**
 * GET /api/cron/agent-scheduler — Operator runtime-ийн dispatcher (5 мин тутам).
 *
 * Industry Pack-уудын асаалттай automation-уудыг (цагийн сануулга, төлбөрийн
 * сануулга, эзний тайлан …) дараалуулж гүйцэтгэнэ. Дэлгэрэнгүй:
 * src/lib/operator/dispatcher.ts.
 *
 * Бусад cron-оос ялгаатай нь production-д CRON_SECRET-гүй бол ажиллахгүй
 * (fail-closed): энэ route үйлчлүүлэгч рүү мессеж илгээдэг.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDispatcherTick } from '@/lib/operator/dispatcher';
import { logger } from '@/lib/utils/logger';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (process.env.NODE_ENV === 'production' && !secret) {
        logger.error('agent-scheduler: CRON_SECRET is not configured — refusing to run');
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    if (secret && authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const summary = await runDispatcherTick({ budgetMs: 45_000 });
        logger.info('agent-scheduler tick', { ...summary });
        return NextResponse.json(summary);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('agent-scheduler failed', { error: message });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
