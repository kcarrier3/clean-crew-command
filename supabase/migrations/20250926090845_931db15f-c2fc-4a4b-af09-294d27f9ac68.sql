-- Add monthly budget tracking columns to job_sites
ALTER TABLE public.job_sites 
ADD COLUMN IF NOT EXISTS current_month_year TEXT,
ADD COLUMN IF NOT EXISTS current_month_used_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reset_date DATE;