/**
 * One-off data fix: enable `payment_integration` for starter / pro / enterprise plans.
 *
 * Mirrors supabase/migrations/20260620130000_fix_starter_pro_payment_integration.sql
 * but applied via the service-role REST client (no direct DB connection / supabase CLI
 * available locally).
 *
 * Run:  node --env-file=.env.local scripts/apply-payment-integration-fix.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const TARGET_SLUGS = ['starter', 'pro', 'professional', 'enterprise'];
const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log(`▶ Target Supabase project: ${new URL(url).host}\n`);

const fmt = (rows) =>
    rows
        .slice()
        .sort((a, b) => a.slug.localeCompare(b.slug))
        .map((p) => `   ${p.slug.padEnd(14)} payment_integration = ${p.features?.payment_integration ?? '(unset)'}`)
        .join('\n');

// ── BEFORE ──
const { data: before, error: readErr } = await supabase
    .from('plans')
    .select('id, slug, features');
if (readErr) {
    console.error('Read failed:', readErr.message);
    process.exit(1);
}
console.log('BEFORE:');
console.log(fmt(before));

// ── APPLY (read-modify-write the features JSONB per row) ──
const targets = before.filter((p) => TARGET_SLUGS.includes(p.slug.toLowerCase()));
let changed = 0;
for (const plan of targets) {
    const current = plan.features?.payment_integration;
    if (current === true) continue; // idempotent
    const nextFeatures = { ...(plan.features || {}), payment_integration: true };
    const { error: updErr } = await supabase
        .from('plans')
        .update({ features: nextFeatures, updated_at: new Date().toISOString() })
        .eq('id', plan.id);
    if (updErr) {
        console.error(`\n✗ Update failed for ${plan.slug}:`, updErr.message);
        process.exit(1);
    }
    changed++;
}

// ── AFTER ──
const { data: after } = await supabase.from('plans').select('id, slug, features');
console.log(`\nAFTER (${changed} row(s) updated):`);
console.log(fmt(after));
console.log('\n✓ Done');
