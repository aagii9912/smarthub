-- Mega Fix: Repair Schema Drift & RLS
-- 1. Create user_profiles if missing (from 002)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Backfill user_profiles from auth.users
INSERT INTO user_profiles (id, email, full_name, created_at, updated_at)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', email), 
    created_at, 
    updated_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 3. Add missing columns to shops (from 002)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS facebook_page_name TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS facebook_page_access_token TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT false;

-- 4. EMERGENCY FIX: Link 'Demo Shop' to the specific user if exists, or first admin user
-- Attempt to find user by email or pick first user
DO $$
DECLARE
    v_user_id UUID;
    v_shop_id UUID;
BEGIN
    -- Try to find target user
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'aagii9912@gmail.com' LIMIT 1;
    
    -- If not found, pick FIRST user (fallback)
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;

    -- Update shops that have NULL user_id
    IF v_user_id IS NOT NULL THEN
        UPDATE shops SET user_id = v_user_id WHERE user_id IS NULL;
    END IF;
END $$;


-- 5. Fix the function to use 'shops' table instead of 'users'
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS UUID AS $$
BEGIN
    -- Return shop_id for authenticated user directly from shops table
    RETURN (
        SELECT id 
        FROM shops 
        WHERE user_id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update shops policies
DROP POLICY IF EXISTS "shops_select_own" ON shops;
DROP POLICY IF EXISTS "shops_update_own" ON shops;
DROP POLICY IF EXISTS "Users can view own shops" ON shops;
DROP POLICY IF EXISTS "Users can update own shops" ON shops;
DROP POLICY IF EXISTS "Users can create shops" ON shops;

CREATE POLICY "shops_select_own" ON shops
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "shops_update_own" ON shops
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "shops_insert_own" ON shops
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

