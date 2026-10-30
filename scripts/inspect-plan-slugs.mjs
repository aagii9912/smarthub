/**
 * READ-ONLY inspection of plan-slug drift before normalization.
 *
 * Verifies the live `plans.slug` values and counts every denormalized reference
 * to the legacy casing/naming ('Starter', 'professional') across user_profiles,
 * shops and payments. Also checks for slug collisions that would block a rename
 * and probes whether the exec_sql RPC is available.
 *
 * Run:  node --env-file=.env.local scripts/inspect-plan-slugs.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
console.log(`▶ Target Supabase project: ${new URL(url).host}\n`);

// ── 1. All plan rows ──
const { data: plans, error: planErr } = await supabase
    .from('plans')
    .select('id, slug, name, is_active, price_monthly')
    .order('sort_order', { ascending: true });
if (planErr) { console.error('plans read failed:', planErr.message); process.exit(1); }

console.log('PLANS (live):');
for (const p of plans) {
    console.log(`   ${String(p.slug).padEnd(14)} active=${p.is_active}  ₮${p.price_monthly ?? '?'}  "${p.name}"  (${p.id})`);
}

const slugSet = new Set(plans.map((p) => p.slug));
console.log('\nCOLLISION CHECK (rename targets must NOT already exist):');
console.log(`   'starter' exists? ${slugSet.has('starter')}   (renaming 'Starter' -> 'starter')`);
console.log(`   'pro' exists?     ${slugSet.has('pro')}   (renaming 'professional' -> 'pro')`);

// ── 2. Denormalized references in user_profiles / shops / payments ──
async function countBy(table, col, val) {
    const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(col, val);
    if (error) return `ERR(${error.message})`;
    return count;
}

console.log('\nDENORMALIZED REFERENCES TO LEGACY SLUGS:');
for (const [table, col] of [
    ['user_profiles', 'subscription_plan'],
    ['shops', 'subscription_plan'],
    ['payments', 'subscription_plan_slug'],
]) {
    for (const legacy of ['Starter', 'professional']) {
        const n = await countBy(table, col, legacy);
        console.log(`   ${table}.${col} = '${legacy}'  ->  ${n} row(s)`);
    }
}

// Distinct values actually present, to catch anything unexpected.
console.log('\nDISTINCT subscription_plan VALUES IN USE:');
for (const table of ['user_profiles', 'shops']) {
    const { data, error } = await supabase.from(table).select('subscription_plan');
    if (error) { console.log(`   ${table}: ERR ${error.message}`); continue; }
    const tally = {};
    for (const r of data) tally[r.subscription_plan ?? '(null)'] = (tally[r.subscription_plan ?? '(null)'] || 0) + 1;
    console.log(`   ${table}: ${JSON.stringify(tally)}`);
}
{
    const { data, error } = await supabase.from('payments').select('subscription_plan_slug').not('subscription_plan_slug', 'is', null);
    if (error) console.log(`   payments: ERR ${error.message}`);
    else {
        const tally = {};
        for (const r of data) tally[r.subscription_plan_slug] = (tally[r.subscription_plan_slug] || 0) + 1;
        console.log(`   payments.subscription_plan_slug: ${JSON.stringify(tally)}`);
    }
}

// Pending payments referencing legacy slugs (these MUST be migrated or activation breaks).
{
    const { data, error } = await supabase
        .from('payments')
        .select('id, subscription_plan_slug, status')
        .in('subscription_plan_slug', ['Starter', 'professional'])
        .eq('status', 'pending');
    console.log(`\nPENDING payments on legacy slugs: ${error ? 'ERR ' + error.message : (data?.length ?? 0)}`);
    for (const r of data || []) console.log(`   payment ${r.id}  slug='${r.subscription_plan_slug}'`);
}

// ── 3. Probe exec_sql availability ──
{
    const { error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    console.log(`\nexec_sql RPC available? ${error ? 'NO (' + error.message + ')' : 'YES'}`);
}

console.log('\n✓ Inspection complete (read-only, no writes performed)');
