-- Upgrade Kennedy to manager role and add manager permissions
-- First, add manager role to Kennedy
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'manager'::app_role
FROM auth.users u 
WHERE u.email = 'kennedy@gosummitvalley.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Grant manager permissions to Kennedy
DO $$
DECLARE
  user_uuid uuid;
BEGIN
  -- Get Kennedy's user ID
  SELECT u.id INTO user_uuid
  FROM auth.users u 
  WHERE u.email = 'kennedy@gosummitvalley.com';
  
  -- Grant default manager permissions
  PERFORM public.grant_default_manager_permissions(user_uuid);
END $$;