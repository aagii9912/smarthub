/**
 * Regression test: Instagram OAuth callback (Settings flow)
 *
 * Specifically guards against bug B1, where the Settings-flow update payload
 * included a column `instagram_account_id` that does not exist in the schema.
 * Postgres rejects the entire update with "column does not exist", and the
 * user sees `?ig_error=db_save_failed`.
 *
 * The test does not exercise the real Graph API; it focuses on what gets
 * written to the `shops` table.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const CALLBACK_FILE = path.resolve(
    process.cwd(),
    'src/app/api/auth/instagram/callback/route.ts'
);

const MIGRATION_FILE = path.resolve(
    process.cwd(),
    'supabase/migrations/20260127100000_add_instagram_integration.sql'
);

describe('Instagram OAuth callback — Settings flow payload (B1 regression)', () => {
    it('does not write the bogus instagram_account_id column', () => {
        const source = fs.readFileSync(CALLBACK_FILE, 'utf-8');
        // Allow incidental references in comments (we explain the bug there),
        // but the property assignment must not appear.
        const propertyMatch = source.match(/instagram_account_id\s*:/);
        expect(propertyMatch).toBeNull();
    });

    it('writes only the columns that actually exist in the migration', () => {
        const migration = fs.readFileSync(MIGRATION_FILE, 'utf-8');
        const declaredColumns = ['instagram_business_account_id', 'instagram_access_token', 'instagram_username'];

        for (const col of declaredColumns) {
            expect(migration).toContain(col);
        }

        // The migration MUST NOT mention the bogus column.
        expect(migration).not.toContain('instagram_account_id');
    });
});
