/**
 * Run Feature Gating Migration on Supabase
 * Execute this script to expand the features schema
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('🚀 Running Feature Gating Migration...\n');

    try {
        console.log('📊 Updating plans with expanded features...');

        // Get current plans
        const { data: plans, error: fetchError } = await supabase
            .from('plans')
            .select('*');

        if (fetchError) {
            console.error('Error fetching plans:', fetchError);
            return;
        }

        console.log(`Found ${plans?.length || 0} plans to update\n`);

        // Update each plan with expanded features
        for (const plan of plans || []) {
            const slug = plan.slug;
            const expandedFeatures = {
                ...plan.features,
                ai_model: ['professional', 'enterprise'].includes(slug) ? 'gpt-4o' : 'gpt-4o-mini',
                sales_intelligence: ['professional', 'enterprise'].includes(slug),
                ai_memory: ['professional', 'enterprise'].includes(slug),
                cart_system: slug === 'enterprise' ? 'full' : ['professional', 'starter'].includes(slug) ? 'basic' : 'none',
                payment_integration: ['professional', 'enterprise'].includes(slug),
                crm_analytics: slug === 'enterprise' ? 'full' : slug === 'professional' ? 'advanced' : slug === 'starter' ? 'basic' : 'none',
                auto_tagging: ['professional', 'enterprise'].includes(slug),
                appointment_booking: slug === 'enterprise',
                bulk_marketing: slug === 'enterprise',
                excel_export: ['starter', 'professional', 'enterprise'].includes(slug),
                custom_branding: slug === 'enterprise',
                comment_reply: ['starter', 'professional', 'enterprise'].includes(slug),
            };

            const { error: updateError } = await supabase
                .from('plans')
                .update({ features: expandedFeatures })
                .eq('id', plan.id);

            if (updateError) {
                console.error(`❌ Failed to update ${plan.name}:`, updateError.message);
            } else {
                console.log(`✅ Updated ${plan.name} (${slug})`);
            }
        }

        // Add columns to shops table
        console.log('\n📦 Adding override columns to shops table...');

        // These need to be run via SQL Editor in Supabase Dashboard
        console.log(`
⚠️  Please run these SQL statements in Supabase SQL Editor:

ALTER TABLE shops ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT '{}';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS limit_overrides JSONB DEFAULT '{}';
        `);

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

runMigration();
