-- Create Super Admin
-- Run this after a user has signed up with the admin email

-- First, ensure the admins table exists (should already exist from 009_add_subscription_system.sql)

-- Insert super admin (replace user_id with actual user ID after signup)
-- This is a template - you need to:
-- 1. Sign up with admin@smarthub.mn (or your preferred email)
-- 2. Get the user_id from auth.users
-- 3. Run this INSERT with that user_id

-- Example insert (uncomment and modify after getting user_id):
/*
INSERT INTO admins (user_id, email, role, is_active, created_at)
VALUES (
    'YOUR-USER-UUID-HERE',
    'admin@smarthub.mn',
    'super_admin',
    true,
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    role = 'super_admin',
    is_active = true;
*/

-- Alternative: Make an existing user a super admin by email
-- This will work if the user has already signed up
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Try to find user by email
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@smarthub.mn' LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        INSERT INTO admins (user_id, email, role, is_active, created_at)
        VALUES (v_user_id, 'admin@smarthub.mn', 'super_admin', true, NOW())
        ON CONFLICT (email) DO UPDATE SET
            role = 'super_admin',
            is_active = true,
            user_id = v_user_id;
        RAISE NOTICE 'Super admin created/updated for user %', v_user_id;
    ELSE
        RAISE NOTICE 'No user found with email admin@smarthub.mn. Please sign up first.';
    END IF;
END $$;
