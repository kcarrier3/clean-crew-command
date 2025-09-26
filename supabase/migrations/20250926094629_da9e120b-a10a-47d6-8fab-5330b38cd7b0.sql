-- Fix work orders RLS policies to properly restrict access
DROP POLICY IF EXISTS "Users can view work orders they created or are assigned to" ON public.work_orders;
DROP POLICY IF EXISTS "Users can update work orders they created or are assigned to" ON public.work_orders;

-- Create proper restrictive policies for work orders
CREATE POLICY "Users can view work orders they created or are assigned to" 
ON public.work_orders 
FOR SELECT 
USING (
  auth.uid() = created_by OR 
  auth.uid() = assigned_to OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update work orders they created or are assigned to" 
ON public.work_orders 
FOR UPDATE 
USING (
  auth.uid() = created_by OR 
  auth.uid() = assigned_to OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);