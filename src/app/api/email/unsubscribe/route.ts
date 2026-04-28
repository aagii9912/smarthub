/**
 * One-click email unsubscribe for the weekly token report digest.
 *
 * Verifies the HMAC signature from the email footer, flips
 * `shops.token_report_email_enabled` to FALSE.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

function htmlPage(title: string, body: string): NextResponse {
    return new NextResponse(
        `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;background:#f3f4f6;color:#1f2937;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
.card{background:white;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);max-width:420px;text-align:center;}
h1{font-size:18px;margin:0 0 12px;}p{font-size:14px;color:#4b5563;margin:0;}</style></head>
<body><div class="card"><h1>${title}</h1>${body}</div></body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const shopId = url.searchParams.get('shop');
    const sig = url.searchParams.get('sig');

    if (!shopId) {
        return htmlPage('Алдаа', '<p>Shop ID шаардлагатай.</p>');
    }

    // Read at runtime so tests / env changes are honored
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const expected = crypto
            .createHmac('sha256', cronSecret)
            .update(`unsubscribe:${shopId}`)
            .digest('hex');
        if (!sig || sig !== expected) {
            return htmlPage('Алдаа', '<p>Холбоосын баталгаажуулалт амжилтгүй.</p>');
        }
    }

    try {
        const supabase = supabaseAdmin();
        const { error } = await supabase
            .from('shops')
            .update({ token_report_email_enabled: false })
            .eq('id', shopId);

        if (error) {
            logger.error('Unsubscribe update failed', { shopId, error: error.message });
            return htmlPage('Алдаа', '<p>Систем дотор алдаа гарлаа. Дараа дахин оролдоно уу.</p>');
        }

        return htmlPage(
            'Захиалга цуцлагдлаа',
            '<p>Та цаашид долоо хоногийн токен зарцуулалтын тайланг хүлээн авахгүй. Дашбоарт ороод дахин идэвхжүүлж болно.</p>'
        );
    } catch (err) {
        logger.error('Unsubscribe error', { error: err instanceof Error ? err.message : String(err) });
        return htmlPage('Алдаа', '<p>Систем дотор алдаа гарлаа.</p>');
    }
}
