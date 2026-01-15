
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to load .env.local manually
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
    console.log('--- CRM Debugging Script (JS) ---');

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Missing Supabase environment variables');
        console.log('Keys found:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
        return;
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
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
        console.log(`Found ${shops.length} shops.`);
        for (const shop of shops) {
            const { count, error: countError } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('shop_id', shop.id);

            console.log(`Shop: ${shop.name} (${shop.id})`);
            console.log(`  User ID: ${shop.user_id}`);
            console.log(`  Customer Count: ${countError ? 'Error: ' + countError.message : count}`);
        }
    }

    // 2. Check for customers without valid shop_id
    console.log('\n--- Orphaned Customers ---');
    const { count: orphanedCount, error: orphanError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .is('shop_id', null);

    console.log(`Orphaned Customers (shop_id IS NULL): ${orphanError ? 'Error' : orphanedCount}`);
}

debug();
