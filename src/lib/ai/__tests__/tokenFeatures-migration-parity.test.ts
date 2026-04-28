/**
 * Migration parity check.
 *
 * If a developer adds a new TokenFeature in src/lib/ai/tokenFeatures.ts
 * but forgets to add it to the SQL seed in
 * supabase/migrations/20260428_token_feature_breakdown.sql, the FK in
 * shop_token_usage_daily.feature → token_feature_categories.key will
 * blow up at runtime when the AI call site is invoked. This test reads
 * both files and asserts every TS constant has a matching INSERT row.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { TOKEN_FEATURES } from '@/lib/ai/tokenFeatures';

const MIGRATION_PATH = resolve(
    __dirname,
    '../../../../supabase/migrations/20260428_token_feature_breakdown.sql'
);

describe('migration parity — tokenFeatures.ts ↔ 20260428_token_feature_breakdown.sql', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');

    it('migration file is non-empty and contains the seed INSERT', () => {
        expect(sql.length).toBeGreaterThan(0);
        expect(sql).toContain('INSERT INTO token_feature_categories');
    });

    it.each(Object.entries(TOKEN_FEATURES))(
        'TOKEN_FEATURES.%s has a matching SQL seed row with mn label "%s"',
        (key, def) => {
            // Find a single-quoted occurrence of the key followed by the mn label.
            // Tolerates whitespace/newlines between values.
            const escapedMn = def.mn.replace(/'/g, "''");
            const pattern = new RegExp(
                `'${key}'\\s*,\\s*'${escapedMn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`
            );
            expect(sql).toMatch(pattern);
        }
    );

    it.each(Object.entries(TOKEN_FEATURES))(
        'TOKEN_FEATURES.%s sort order is present in the seed row',
        (key, def) => {
            // Find the seed line for this key, then assert the sort number
            // appears at the end (after the labels). Tolerates whitespace
            // alignment in the SQL.
            const keyLineMatch = sql.match(new RegExp(`'${key}'[^\\n]*`, 'g'));
            expect(keyLineMatch).not.toBeNull();
            const sortPattern = new RegExp(`,\\s*${def.sort}\\s*\\)`);
            const hasSort = (keyLineMatch ?? []).some((line) => sortPattern.test(line));
            expect(hasSort).toBe(true);
        }
    );

    it('migration installs the FK from shop_token_usage_daily.feature → token_feature_categories(key)', () => {
        expect(sql).toMatch(/REFERENCES\s+token_feature_categories\s*\(\s*key\s*\)/i);
    });

    it('migration creates the (shop_id, usage_date, feature) unique constraint', () => {
        expect(sql).toMatch(/UNIQUE\s*\(\s*shop_id\s*,\s*usage_date\s*,\s*feature\s*\)/i);
    });

    it('migration redefines increment_shop_token_usage with 3 args (UUID, BIGINT, TEXT)', () => {
        // Very loose pattern — just guard against accidental signature drift
        expect(sql).toMatch(/increment_shop_token_usage[^)]*p_shop_id\s+UUID/);
        expect(sql).toMatch(/p_tokens\s+BIGINT/);
        expect(sql).toMatch(/p_feature\s+TEXT/);
    });

    it('migration adds shops.token_report_email_enabled BOOLEAN DEFAULT TRUE', () => {
        expect(sql).toMatch(/token_report_email_enabled\s+BOOLEAN/i);
        expect(sql).toMatch(/DEFAULT\s+TRUE/i);
    });

    it('backfill statement uses unknown_legacy (not chat_reply) — honest historical data', () => {
        expect(sql).toMatch(/feature\s*=\s*'unknown_legacy'/);
        // Pin: must NOT lie about historical data by tagging as chat_reply
        expect(sql).not.toMatch(/UPDATE\s+shop_token_usage_daily.*feature\s*=\s*'chat_reply'/i);
    });
});
