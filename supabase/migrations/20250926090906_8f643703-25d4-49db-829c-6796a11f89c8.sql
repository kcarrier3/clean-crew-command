-- Create monthly budget history table
CREATE TABLE IF NOT EXISTS public.monthly_budget_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_site_id UUID NOT NULL,
  month_year TEXT NOT NULL,
  budgeted_hours NUMERIC NOT NULL,
  used_hours NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_site_id, month_year)
);

-- Enable RLS
ALTER TABLE public.monthly_budget_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all access to monthly_budget_history" 
ON public.monthly_budget_history 
FOR ALL 
USING (true);