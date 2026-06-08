import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutSummary } from '@/lib/services/CheckoutService';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/checkout/[token]
 * Public endpoint — returns the checkout-review summary for a cart token.
 * No auth (customer/shop opens via shared link, same trust model as /pay).
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params;

    try {
        const summary = await getCheckoutSummary(token);
        if (!summary) {
            return NextResponse.json({ error: 'Сагс олдсонгүй' }, { status: 404 });
        }
        return NextResponse.json(summary);
    } catch (error) {
        logger.error('Checkout summary failed:', { token, error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Алдаа гарлаа' }, { status: 500 });
    }
}
