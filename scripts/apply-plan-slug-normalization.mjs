/**
 * Normalize plan slug casing/naming on the LIVE database.
 *
 * Mirrors supabase/migrations/20260620140000_normalize_plan_slugs.sql but applied
 * via the service-role REST client (no direct DB connection / supabase CLI
 * available locally — same constraint as apply-payment-integration-fix.mjs).
 *
 *   'Starter'      -> 'starter'   (casing drift)
 *   'professional' -> 'pro'       (naming drift; canonical PlanType slug)
 *
 * Surfaces rewritten: plans.slug, user_profiles.subscription_plan,
 * shops.subscription_plan, payments.subscription_plan_slug.
 * (subscriptions reference the plan by plan_id UUID — untouched.)
 *
 * Idempotent and collision-guarded. Prints BEFORE/AFTER and aborts if a
 * canonical slug already collides with a legacy row in `plans`.
 *
 * Run:  node --env-file=.env.local scripts/apply-plan-slug-normalization.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const RENAMES = [['Starter', 'starter'], ['professional', 'pro']];
const LEGACY = RENAMES.map(([from]) => from);

console.log(`▶ Target Supabase project: ${new URL(url).host}\n`);

const die = (msg, err) => { console.error(`\n✗ ${msg}${err ? ': ' + err.message : ''}`); process.exit(1); };

async function countLegacy(table, col) {
    const out = {};
    for (const legacy of LEGACY) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(col, legacy);
        if (error) return die(`count ${table}.${col}`, error);
        out[legacy] = count;
    }
    return out;
}

async function snapshot(label) {
    const { data: plans, error } = await supabase.from('plans').select('slug, name, is_active').order('sort_order');
    if (error) return die('read plans', error);
    console.log(`${label} plans.slug: ${plans.map((p) => p.slug).join(', ')}`);
    for (const [table, col] of [['user_profiles', 'subscription_plan'], ['shops', 'subscription_plan'], ['payments', 'subscription_plan_slug']]) {
        console.log(`${label} ${table}.${col} legacy: ${JSON.stringify(await countLegacy(table, col))}`);
    }
    return plans;
}

// ── BEFORE ──
console.log('── BEFORE ──');
const before = await snapshot(' ');

// ── Collision guard on plans.slug (UNIQUE) ──
const slugSet = new Set(before.map((p) => p.slug));
for (const [from, to] of RENAMES) {
    if (slugSet.has(from) && slugSet.has(to)) {
        die(`collision: both '${from}' and '${to}' exist in plans — refusing to rename (would violate the UNIQUE slug constraint / split the plan). Resolve manually.`);
    }
}

// ── APPLY: denormalized snapshots first, authoritative plans.slug last ──
console.log('\n── APPLYING ──');
async function rewrite(table, col, setUpdatedAt) {
    for (const [from, to] of RENAMES) {
        const patch = setUpdatedAt ? { [col]: to, updated_at: new Date().toISOString() } : { [col]: to };
        const { data, error } = await supabase.from(table).update(patch).eq(col, from).select('id');
        if (error) return die(`update ${table}.${col} ${from}->${to}`, error);
        if (data.length) console.log(`   ${table}.${col}: ${from} -> ${to}  (${data.length} row[s])`);
    }
}

await rewrite('user_profiles', 'subscription_plan', true);   // has updated_at
await rewrite('shops', 'subscription_plan', false);          // NO updated_at column
await rewrite('payments', 'subscription_plan_slug', false);  // avoid assuming updated_at

// plans.slug last — flip the source of truth only after every snapshot is canonical
for (const [from, to] of RENAMES) {
    const { data, error } = await supabase.from('plans').update({ slug: to, updated_at: new Date().toISOString() }).eq('slug', from).select('id, slug');
    if (error) die(`rename plans ${from}->${to}`, error);
    if (data.length) console.log(`   plans.slug: ${from} -> ${to}  (${data.length} row[s])`);
}

// ── AFTER + assertion ──
console.log('\n── AFTER ──');
await snapshot(' ');

let leftover = 0;
for (const [table, col] of [['plans', 'slug'], ['user_profiles', 'subscription_plan'], ['shops', 'subscription_plan'], ['payments', 'subscription_plan_slug']]) {
    const c = await countLegacy(table, col);
    leftover += Object.values(c).reduce((a, b) => a + b, 0);
}
if (leftover !== 0) die(`${leftover} legacy slug reference(s) still present after apply`);

console.log('\n✓ Done — no legacy slug references remain');
