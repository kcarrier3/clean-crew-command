-- Create roles table for custom role definitions
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_system_role boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create role_permissions junction table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission app_permission NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission)
);

-- Create user_custom_roles table to assign custom roles to users
CREATE TABLE public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles table
CREATE POLICY "Everyone can view roles"
  ON public.roles FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for role_permissions table
CREATE POLICY "Everyone can view role permissions"
  ON public.role_permissions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for user_custom_roles table
CREATE POLICY "Users can view their own custom roles"
  ON public.user_custom_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user custom roles"
  ON public.user_custom_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage user custom roles"
  ON public.user_custom_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to get all permissions for a user (including from custom roles)
CREATE OR REPLACE FUNCTION public.get_user_all_permissions(_user_id uuid)
RETURNS TABLE(permission app_permission)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Get direct user permissions
  SELECT up.permission
  FROM public.user_permissions up
  WHERE up.user_id = _user_id
  
  UNION
  
  -- Get permissions from custom roles
  SELECT rp.permission
  FROM public.user_custom_roles ucr
  JOIN public.role_permissions rp ON rp.role_id = ucr.role_id
  WHERE ucr.user_id = _user_id;
$$;

-- Update has_permission function to check both direct permissions and role permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission app_permission)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.get_user_all_permissions(_user_id)
    WHERE permission = _permission
  )
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();