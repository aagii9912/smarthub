/**
 * Customer Segments API
 * GET — returns customer segment distribution for the shop
 */

import { NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { customerService } from '@/lib/services/CustomerService';
import { logger } from '@/lib/utils/logger';

export async function GET() {
    try {
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const distribution = await customerService.getSegmentDistribution(shop.id);

        return NextResponse.json(distribution);
    } catch (error) {
        logger.error('Customer segments error:', { error });
        return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 });
    }
}
