-- Add new columns to job_sites table for budgeting and recurring features
ALTER TABLE public.job_sites 
ADD COLUMN is_recurring_monthly boolean DEFAULT false,
ADD COLUMN budgeted_hours numeric(10,2) DEFAULT NULL,
ADD COLUMN used_hours numeric(10,2) DEFAULT 0,
ADD COLUMN remaining_hours numeric(10,2) GENERATED ALWAYS AS (
  CASE 
    WHEN budgeted_hours IS NOT NULL THEN budgeted_hours - COALESCE(used_hours, 0)
    ELSE NULL
  END
) STORED;