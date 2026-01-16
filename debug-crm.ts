import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debug() {
    console.log('=== 1. CHECKING ALL SHOPS ===');
    const { data: shops } = await supabase.from('shops').select('id, name, user_id, facebook_page_id');
    console.log(JSON.stringify(shops, null, 2));

    console.log('\n=== 2. CHECKING ALL CUSTOMERS ===');
    const { data: customers, error } = await supabase.from('customers').select('*');
    console.log('Total customers:', customers?.length || 0);
    if (error) console.log('Error:', error);
    console.log(JSON.stringify(customers, null, 2));

    console.log('\n=== 3. CUSTOMERS PER SHOP ===');
    for (const shop of shops || []) {
        const { count } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shop.id);
        console.log(`Shop "${shop.name}" (user_id: ${shop.user_id}): ${count} customers`);
    }

    console.log('\n=== 4. CHECKING CHAT HISTORY (last 5) ===');
    const { data: chats } = await supabase
        .from('chat_history')
        .select('id, customer_id, shop_id, message, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
    console.log(JSON.stringify(chats, null, 2));
}

debug();
