-- Update can_message_user function to handle new manager roles
CREATE OR REPLACE FUNCTION public.can_message_user(_sender_id uuid, _recipient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    -- Owners, Administrators, Janitorial Managers, and Project Crew Leads can message anyone
    WHEN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = _sender_id 
      AND job_title IN ('Owner', 'Administrator', 'Janitorial Manager', 'Project Crew Lead')
    ) THEN true
    
    -- Floaters can message other Floaters or managers
    WHEN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = _sender_id AND job_title = 'Floaters'
    ) THEN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = _recipient_id 
      AND job_title IN ('Owner', 'Administrator', 'Janitorial Manager', 'Project Crew Lead', 'Floaters')
    )
    
    -- All other employees can only message managers
    ELSE EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = _recipient_id 
      AND job_title IN ('Owner', 'Administrator', 'Janitorial Manager', 'Project Crew Lead')
    )
  END
$$;

-- Create a table to track late notifications
CREATE TABLE IF NOT EXISTS public.late_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  time_entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  notified_at timestamp with time zone NOT NULL DEFAULT now(),
  minutes_late integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on late_notifications
ALTER TABLE public.late_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for late_notifications
CREATE POLICY "Managers can view late notifications"
  ON public.late_notifications FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "System can insert late notifications"
  ON public.late_notifications FOR INSERT
  WITH CHECK (true);

-- Create index for late notifications lookup
CREATE INDEX IF NOT EXISTS idx_late_notifications_employee_id ON public.late_notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_late_notifications_time_entry_id ON public.late_notifications(time_entry_id);

-- Function to get managers for an employee based on department
CREATE OR REPLACE FUNCTION public.get_employee_managers(_employee_id uuid)
RETURNS TABLE(manager_id uuid, manager_name text, manager_email text, manager_job_title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH employee_dept AS (
    SELECT 
      CASE 
        WHEN job_title = 'Janitorial Staff' THEN 'janitorial'
        WHEN job_title = 'Project Worker' THEN 'construction'
        ELSE 'other'
      END as department
    FROM public.profiles
    WHERE id = _employee_id
  )
  SELECT 
    p.id as manager_id,
    p.first_name || ' ' || p.last_name as manager_name,
    p.email as manager_email,
    p.job_title as manager_job_title
  FROM public.profiles p
  CROSS JOIN employee_dept ed
  WHERE 
    -- Always include Owner and Administrator
    p.job_title IN ('Owner', 'Administrator')
    -- Include department-specific managers
    OR (ed.department = 'janitorial' AND p.job_title = 'Janitorial Manager')
    OR (ed.department = 'construction' AND p.job_title = 'Project Crew Lead')
$$;