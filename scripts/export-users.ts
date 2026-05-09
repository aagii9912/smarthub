/**
 * One-off export script: dump all registered users' email + phone to a CSV.
 *
 * Phone resolution (in priority order):
 *   1. user_profiles.phone
 *   2. shops.phone (most-recent shop owned by the user)
 *
 * The CSV is written to the parent folder (outside the git repo) so PII never
 * lands inside the repository tree by accident.
 *
 * Run with:
 *   cd "/Users/aagii/untitled folder/Syncly"
 *   npx tsx scripts/export-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

// Load .env.local explicitly so SERVICE_ROLE_KEY is available
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    created_at: string;
}

interface ShopRow {
    user_id: string | null;
    phone: string | null;
    name: string | null;
    created_at: string;
}

function csvEscape(value: string | null | undefined): string {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

async function main() {
    console.log('Fetching user_profiles...');
    const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, phone, created_at')
        .order('created_at', { ascending: true })
        .returns<UserProfile[]>();

    if (profileError) {
        console.error('Failed to fetch user_profiles:', profileError.message);
        process.exit(1);
    }

    console.log(`  → ${profiles?.length ?? 0} profiles`);

    console.log('Fetching shops (for phone fallback)...');
    const { data: shops, error: shopsError } = await supabase
        .from('shops')
        .select('user_id, phone, name, created_at')
        .order('created_at', { ascending: false })
        .returns<ShopRow[]>();

    if (shopsError) {
        console.error('Failed to fetch shops:', shopsError.message);
        process.exit(1);
    }

    console.log(`  → ${shops?.length ?? 0} shops`);

    // Build a lookup: user_id → first non-null phone (most recent shop wins)
    const shopPhoneByUser = new Map<string, string>();
    const shopNameByUser = new Map<string, string>();
    for (const s of shops ?? []) {
        if (!s.user_id) continue;
        if (s.phone && !shopPhoneByUser.has(s.user_id)) {
            shopPhoneByUser.set(s.user_id, s.phone);
        }
        if (s.name && !shopNameByUser.has(s.user_id)) {
            shopNameByUser.set(s.user_id, s.name);
        }
    }

    // Write CSV to parent folder (outside the git repo)
    const outputPath = path.resolve(process.cwd(), '..', `users-export-${new Date().toISOString().slice(0, 10)}.csv`);
    const header = ['email', 'phone', 'full_name', 'shop_name', 'created_at'].join(',');

    const rows = (profiles ?? []).map((p) => {
        const phone = p.phone || shopPhoneByUser.get(p.id) || '';
        return [
            csvEscape(p.email),
            csvEscape(phone),
            csvEscape(p.full_name),
            csvEscape(shopNameByUser.get(p.id) ?? null),
            csvEscape(p.created_at),
        ].join(',');
    });

    const withPhone = rows.filter((_, i) => {
        const p = profiles![i];
        return Boolean(p.phone || shopPhoneByUser.get(p.id));
    }).length;

    fs.writeFileSync(outputPath, [header, ...rows].join('\n') + '\n', 'utf8');

    console.log('');
    console.log(`✓ Exported ${profiles?.length ?? 0} users → ${outputPath}`);
    console.log(`  • with phone: ${withPhone}`);
    console.log(`  • without phone: ${(profiles?.length ?? 0) - withPhone}`);
}

main().catch((err) => {
    console.error('Export failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
