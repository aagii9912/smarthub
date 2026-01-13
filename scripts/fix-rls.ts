// Script to check and fix RLS on all tables
// Run: npx tsx scripts/fix-rls.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function main() {
    console.log('🔍 Checking tables and RLS status...\n');

    // Query to get all tables with RLS status
    const { data: tables, error } = await supabase.rpc('exec_sql', {
        sql: `
            SELECT tablename, rowsecurity as rls_enabled
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename;
        `
    });

    if (error) {
        console.log('Direct RPC not available, using alternative method...');

        // Alternative: try to list known tables
        const knownTables = [
            'shops', 'products', 'product_variants', 'customers',
            'orders', 'order_items', 'chat_history', 'payments',
            'users', 'user_profiles', 'push_subscriptions',
            'email_logs', 'usage_logs', 'subscription_plans',
            'subscriptions', 'invoices', 'customer_tags'
        ];

        console.log('\n📋 Known tables to enable RLS on:');
        knownTables.forEach(t => console.log(`  - ${t}`));

        console.log('\n📝 Run this SQL in Supabase SQL Editor:\n');
        console.log('-- Enable RLS on all tables');
        knownTables.forEach(t => {
            console.log(`ALTER TABLE IF EXISTS public.${t} ENABLE ROW LEVEL SECURITY;`);
        });

        return;
    }

    console.log('Tables found:', tables);
}

main().catch(console.error);
