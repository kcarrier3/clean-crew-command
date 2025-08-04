-- Add job_title column to employees table to distinguish worker types
ALTER TABLE public.employees 
ADD COLUMN job_title TEXT;

-- Update existing employees with default job titles (you can modify these later)
UPDATE public.employees 
SET job_title = 'Janitorial Staff' 
WHERE job_title IS NULL;

-- Add a constraint to ensure job_title is not null for new records
ALTER TABLE public.employees 
ALTER COLUMN job_title SET NOT NULL;

-- Create index for better performance when filtering by job title
CREATE INDEX idx_employees_job_title ON public.employees(job_title);