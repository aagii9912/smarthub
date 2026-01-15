
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    console.log('--- CRM Debugging Script ---');

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Check all shops
    console.log('\n--- Shops ---');
    const { data: shops, error: shopError } = await supabase
        .from('shops')
        .select('id, name, user_id, created_at');

    if (shopError) {
        console.error('Error fetching shops:', shopError);
        return;
    }

    if (!shops || shops.length === 0) {
        console.log('No shops found in database.');
    } else {
        for (const shop of shops) {
            // 2. Count customers for each shop
            const { count, error: countError } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('shop_id', shop.id);

            console.log(`Shop: ${shop.name} (${shop.id})`);
            console.log(`  User ID: ${shop.user_id}`);
            console.log(`  Customer Count: ${countError ? 'Error: ' + countError.message : count}`);
        }
    }

    // 3. Check for customers without valid shop_id
    console.log('\n--- Orphaned Customers ---');
    const { count: orphanedCount, error: orphanError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .is('shop_id', null);

    console.log(`Orphaned Customers (shop_id IS NULL): ${orphanError ? 'Error' : orphanedCount}`);

    // 4. Check for customers with non-existent shop_id
    const { data: allCustomerShopIds } = await supabase
        .from('customers')
        .select('shop_id');

    const uniqueIds = Array.from(new Set(allCustomerShopIds?.map(c => c.shop_id).filter(Boolean)));
    const invalidIds = [];
    for (const id of uniqueIds) {
        const { data: shop } = await supabase.from('shops').select('id').eq('id', id).single();
        if (!shop) invalidIds.push(id);
    }
    console.log(`Unique shop_ids in customers table: ${uniqueIds.length}`);
    console.log(`Invalid shop_ids found: ${invalidIds.length}`);
    if (invalidIds.length > 0) {
        console.log('Invalid IDs:', invalidIds);
    }
}

debug();
