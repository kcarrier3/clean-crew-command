-- Add access_instructions field for sensitive information like alarm codes
ALTER TABLE public.job_sites 
ADD COLUMN access_instructions text;

-- Create a security definer function to check if a user can access sensitive job site info
CREATE OR REPLACE FUNCTION public.can_access_job_site_sensitive_info(_user_id uuid, _job_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Managers and admins can always access
  SELECT CASE
    WHEN has_role(_user_id, 'manager'::app_role) OR has_role(_user_id, 'admin'::app_role) THEN true
    -- Floaters can access all job sites
    WHEN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id AND job_title = 'Floaters'
    ) THEN true
    -- Employees with active schedules at this job site can access
    WHEN EXISTS (
      SELECT 1 FROM public.employee_schedules
      WHERE employee_id = _user_id 
        AND job_site_id = _job_site_id
        AND active = true
        AND (
          -- Check if current date falls within schedule
          start_date <= CURRENT_DATE 
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        )
    ) THEN true
    ELSE false
  END
$$;

-- Update RLS policies for job_sites to restrict access to sensitive information
DROP POLICY IF EXISTS "Allow all access to job_sites" ON public.job_sites;

-- Basic read access for all authenticated users (without sensitive fields)
CREATE POLICY "Users can view basic job site info"
ON public.job_sites
FOR SELECT
TO authenticated
USING (true);

-- Managers and admins have full control
CREATE POLICY "Managers can manage all job sites"
ON public.job_sites
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Note: The access_instructions field will need to be handled with 
-- application-level filtering since Postgres RLS can't selectively hide columns.
-- The function can_access_job_site_sensitive_info can be used in the application layer.