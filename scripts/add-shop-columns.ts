/**
 * Add feature columns to shops table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addShopColumns() {
    console.log('🚀 Adding feature columns to shops table...\n');

    try {
        // Try to select the columns first to see if they exist
        const { data: testShop, error: testError } = await supabase
            .from('shops')
            .select('id, enabled_features, limit_overrides')
            .limit(1);

        if (testError && testError.message.includes('column')) {
            console.log('⚠️ Columns do not exist yet. Please run the following SQL in Supabase Dashboard:\n');
            console.log(`
ALTER TABLE shops ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT '{}';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS limit_overrides JSONB DEFAULT '{}';
            `);

            // Alternative: Try using RPC if available
            console.log('\n🔄 Attempting to add columns via Supabase...');

            // Update all shops with empty overrides (this will fail if columns don't exist)
            const { error: updateError } = await supabase
                .from('shops')
                .update({
                    enabled_features: {},
                    limit_overrides: {}
                })
                .is('enabled_features', null);

            if (updateError) {
                console.error('❌ Could not add columns automatically.');
                console.log('\n📋 Copy and paste this SQL into Supabase SQL Editor:');
                console.log(`
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT '{}';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS limit_overrides JSONB DEFAULT '{}';

-- Verify columns were added
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'shops' AND column_name IN ('enabled_features', 'limit_overrides');
                `);
            }
        } else {
            console.log('✅ Columns already exist!');
            console.log('Sample shop data:', testShop?.[0]);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

addShopColumns();
