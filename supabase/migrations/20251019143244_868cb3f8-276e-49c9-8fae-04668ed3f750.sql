-- Add foreign key constraint from late_notifications to profiles
ALTER TABLE public.late_notifications
ADD CONSTRAINT late_notifications_employee_id_fkey 
FOREIGN KEY (employee_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;