-- Create enum for specific permissions
CREATE TYPE public.app_permission AS ENUM (
  'view_schedules',
  'edit_schedules', 
  'view_time_tracking',
  'edit_time_tracking',
  'view_work_orders',
  'create_work_orders',
  'edit_work_orders',
  'view_quality_control',
  'edit_quality_control',
  'view_worker_status',
  'manage_employees',
  'view_notifications',
  'admin_settings'
);

-- Create permissions table to define available permissions
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name app_permission NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user permissions table for granular access control
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission app_permission NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Insert default permissions
INSERT INTO public.permissions (name, display_name, description, category) VALUES
('view_schedules', 'View Schedules', 'Can view schedules and shifts', 'Scheduling'),
('edit_schedules', 'Edit Schedules', 'Can create and modify schedules', 'Scheduling'),
('view_time_tracking', 'View Time Tracking', 'Can view time clock and entries', 'Time Management'),
('edit_time_tracking', 'Edit Time Tracking', 'Can clock in/out and edit time entries', 'Time Management'),
('view_work_orders', 'View Work Orders', 'Can view work orders', 'Work Orders'),
('create_work_orders', 'Create Work Orders', 'Can create new work orders', 'Work Orders'),
('edit_work_orders', 'Edit Work Orders', 'Can modify existing work orders', 'Work Orders'),
('view_quality_control', 'View Quality Control', 'Can access quality control features', 'Quality'),
('edit_quality_control', 'Edit Quality Control', 'Can modify quality control items', 'Quality'),
('view_worker_status', 'View Worker Status', 'Can see worker status dashboard', 'Management'),
('manage_employees', 'Manage Employees', 'Can manage employee accounts and permissions', 'Management'),
('view_notifications', 'View Notifications', 'Can see notifications', 'General'),
('admin_settings', 'Admin Settings', 'Full administrative access', 'Administration');

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission app_permission)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
  )
$$;

-- Create function to grant default permissions to employees
CREATE OR REPLACE FUNCTION public.grant_default_employee_permissions(_user_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
  INSERT INTO public.user_permissions (user_id, permission) VALUES
  (_user_id, 'view_schedules'),
  (_user_id, 'view_time_tracking'),
  (_user_id, 'edit_time_tracking'),
  (_user_id, 'view_work_orders'),
  (_user_id, 'view_notifications')
  ON CONFLICT (user_id, permission) DO NOTHING;
$$;

-- Create function to grant default permissions to managers
CREATE OR REPLACE FUNCTION public.grant_default_manager_permissions(_user_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
  INSERT INTO public.user_permissions (user_id, permission) VALUES
  (_user_id, 'view_schedules'),
  (_user_id, 'edit_schedules'),
  (_user_id, 'view_time_tracking'),
  (_user_id, 'edit_time_tracking'),
  (_user_id, 'view_work_orders'),
  (_user_id, 'create_work_orders'),
  (_user_id, 'edit_work_orders'),
  (_user_id, 'view_quality_control'),
  (_user_id, 'edit_quality_control'),
  (_user_id, 'view_worker_status'),
  (_user_id, 'manage_employees'),
  (_user_id, 'view_notifications')
  ON CONFLICT (user_id, permission) DO NOTHING;
$$;

-- Update the handle_new_user function to grant default permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert profile with metadata from signup
  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name, 
    email,
    employee_id
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'employee_id'
  );
  
  -- Assign default employee role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  -- Grant default employee permissions
  PERFORM public.grant_default_employee_permissions(NEW.id);
  
  RETURN NEW;
END;
$$;

-- RLS Policies for permissions table
CREATE POLICY "Everyone can view permissions"
  ON public.permissions
  FOR SELECT
  USING (true);

-- RLS Policies for user_permissions table
CREATE POLICY "Users can view their own permissions"
  ON public.user_permissions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user permissions"
  ON public.user_permissions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_employees'));

CREATE POLICY "Admins can manage user permissions"
  ON public.user_permissions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_employees'));

-- Create indexes for performance
CREATE INDEX idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission ON public.user_permissions(permission);