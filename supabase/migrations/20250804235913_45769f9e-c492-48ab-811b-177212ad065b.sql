-- Add notes column to employee_schedules table for shift-specific instructions
ALTER TABLE public.employee_schedules 
ADD COLUMN notes TEXT;

-- Add index for better performance when searching notes
CREATE INDEX idx_employee_schedules_notes ON public.employee_schedules USING GIN(to_tsvector('english', notes)) WHERE notes IS NOT NULL;