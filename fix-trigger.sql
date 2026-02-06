-- Fix for the handle_new_user trigger
-- This ensures the trigger function properly bypasses RLS and handles errors

-- First, let's grant the necessary permissions to the postgres role
-- (This might already be done, but ensuring it's set)

-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop and recreate the function with better error handling
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  -- Create a new tenant
  INSERT INTO public.tenants (name)
  VALUES ('Account ' || NEW.id::text)
  RETURNING id INTO new_tenant_id;
  
  -- Link user to tenant as owner
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (new_tenant_id, NEW.id, 'owner');
  
  -- Create default settings row
  INSERT INTO public.settings (tenant_id)
  VALUES (new_tenant_id);
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error details
    RAISE WARNING 'Error in handle_new_user trigger for user %: %', NEW.id, SQLERRM;
    -- Still return NEW to allow user creation even if tenant setup fails
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions (in case RLS is still blocking)
-- Note: SECURITY DEFINER should bypass RLS, but this ensures permissions exist
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated;
GRANT ALL ON public.tenants TO postgres;
GRANT ALL ON public.tenant_users TO postgres;
GRANT ALL ON public.settings TO postgres;
