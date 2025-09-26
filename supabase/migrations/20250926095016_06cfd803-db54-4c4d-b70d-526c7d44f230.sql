-- Update work order creation policy to only allow managers and admins
DROP POLICY IF EXISTS "Users can create work orders" ON public.work_orders;

CREATE POLICY "Only managers can create work orders" 
ON public.work_orders 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);