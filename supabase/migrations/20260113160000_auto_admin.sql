-- Trigger to automatically make specific email a super admin
CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'admin@smarthub.mn' THEN
    INSERT INTO public.admins (user_id, email, role, is_active)
    VALUES (NEW.id, NEW.email, 'super_admin', true)
    ON CONFLICT (email) DO UPDATE
    SET role = 'super_admin', is_active = true, user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin();

-- If the user already exists, upgrade them now
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@smarthub.mn' LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.admins (user_id, email, role, is_active)
        VALUES (v_user_id, 'admin@smarthub.mn', 'super_admin', true)
        ON CONFLICT (email) DO UPDATE
        SET role = 'super_admin', is_active = true, user_id = v_user_id;
    END IF;
END $$;
