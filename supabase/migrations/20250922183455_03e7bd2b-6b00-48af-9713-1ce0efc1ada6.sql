-- Query to see current users and their roles
-- First, let's check what users exist
SELECT 
  u.email,
  p.first_name,
  p.last_name,
  ur.role,
  up.permission
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id  
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.user_permissions up ON u.id = up.user_id
ORDER BY u.created_at DESC;