-- Migration: Fix admins table for Clerk IDs
-- Purpose: Change admin.user_id from UUID to TEXT to support Clerk IDs

DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 1. DROP POLICIES ON ADMINS
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'admins') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON admins';
    END LOOP;

    -- 2. DROP FOREIGN KEY CONSTRAINT
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admins') THEN
        ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_user_id_fkey;
        ALTER TABLE admins ALTER COLUMN user_id TYPE text;
    END IF;

    -- 3. RE-CREATE POLICIES (Optional - only if you want RLS for admins table)
    -- For now, we skip RLS since we use supabaseAdmin() which bypasses RLS anyway
    
    RAISE NOTICE 'Successfully migrated admins.user_id to TEXT';
END $$;

SELECT 'Admins table fixed for Clerk IDs' as result;
