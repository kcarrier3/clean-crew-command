-- Create employee schedules table
CREATE TABLE public.employee_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  job_site_id UUID NOT NULL REFERENCES public.job_sites(id),
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  days_of_week INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 1=Monday, 7=Sunday
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_schedules ENABLE ROW LEVEL SECURITY;

-- Temporary policy to allow all access
CREATE POLICY "Allow all access to employee_schedules" ON public.employee_schedules FOR ALL USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_employee_schedules_updated_at
  BEFORE UPDATE ON public.employee_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample schedules
INSERT INTO public.employee_schedules (employee_id, job_site_id, start_date, start_time, end_time, days_of_week) 
SELECT 
  e.id,
  j.id,
  CURRENT_DATE,
  '08:00:00',
  '17:00:00',
  '{1,2,3,4,5}'
FROM public.employees e, public.job_sites j 
WHERE e.employee_id = 'EMP001' AND j.name = 'Downtown Office Building'

UNION ALL

SELECT 
  e.id,
  j.id,
  CURRENT_DATE,
  '09:00:00',
  '18:00:00',
  '{1,2,3,4,5}'
FROM public.employees e, public.job_sites j 
WHERE e.employee_id = 'EMP002' AND j.name = 'Retail Plaza'

UNION ALL

SELECT 
  e.id,
  j.id,
  CURRENT_DATE,
  '07:00:00',
  '15:00:00',
  '{1,2,3,4,5}'
FROM public.employees e, public.job_sites j 
WHERE e.employee_id = 'EMP003' AND j.name = 'Medical Center';