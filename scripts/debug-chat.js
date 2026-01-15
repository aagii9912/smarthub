
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

async function debug() {
    console.log('--- Chat History Debugging ---');

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Get total chat history count
    const { count, error } = await supabase
        .from('chat_history')
        .select('*', { count: 'exact', head: true });

    console.log(`Total Chat History Records: ${error ? 'Error' : count}`);

    if (count > 0) {
        // 2. Get unique customer_ids from chat_history
        const { data: chats } = await supabase
            .from('chat_history')
            .select('customer_id, shop_id')
            .order('created_at', { ascending: false })
            .limit(100);

        const customerIds = Array.from(new Set(chats.map(c => c.customer_id).filter(Boolean)));
        console.log(`Unique Customer IDs in recent 100 chats: ${customerIds.length}`);

        if (customerIds.length > 0) {
            console.log('\nSample Customer IDs from Chat:');
            for (const id of customerIds.slice(0, 5)) {
                const { data: customer } = await supabase.from('customers').select('*').eq('id', id).single();
                console.log(`- Customer ID: ${id}`);
                console.log(`  Found in 'customers' table: ${customer ? 'YES' : 'NO'}`);
                if (customer) {
                    console.log(`  Linked to Shop ID: ${customer.shop_id}`);
                }
            }
        }
    }
}

debug();
