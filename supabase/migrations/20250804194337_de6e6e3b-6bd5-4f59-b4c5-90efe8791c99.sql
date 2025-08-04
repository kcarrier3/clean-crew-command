-- Create projects table for job costing
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('project', 'janitorial_account')),
  total_hours_allocated DECIMAL(10,2), -- For projects
  monthly_hours_allocated DECIMAL(10,2), -- For janitorial accounts
  hours_used DECIMAL(10,2) NOT NULL DEFAULT 0,
  hourly_rate DECIMAL(10,2), -- Optional for time & material work
  low_hours_warning_threshold DECIMAL(10,2), -- Alert when hours remaining < this
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project schedules table
CREATE TABLE public.project_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_start_time TIME NOT NULL,
  scheduled_end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, scheduled_date, scheduled_start_time, scheduled_end_time)
);

-- Create project hour history for tracking monthly resets and adjustments
CREATE TABLE public.project_hour_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  hours_allocated DECIMAL(10,2) NOT NULL,
  hours_used DECIMAL(10,2) NOT NULL DEFAULT 0,
  adjustment_amount DECIMAL(10,2) DEFAULT 0,
  adjustment_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add project_id to time_entries table
ALTER TABLE public.time_entries 
ADD COLUMN project_id UUID REFERENCES public.projects(id);

-- Enable RLS on new tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_hour_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for projects
CREATE POLICY "Anyone can view projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Anyone can insert projects" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update projects" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete projects" ON public.projects FOR DELETE USING (true);

-- Create RLS policies for project_schedules
CREATE POLICY "Anyone can view project schedules" ON public.project_schedules FOR SELECT USING (true);
CREATE POLICY "Anyone can insert project schedules" ON public.project_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update project schedules" ON public.project_schedules FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete project schedules" ON public.project_schedules FOR DELETE USING (true);

-- Create RLS policies for project_hour_history
CREATE POLICY "Anyone can view project hour history" ON public.project_hour_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert project hour history" ON public.project_hour_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update project hour history" ON public.project_hour_history FOR UPDATE USING (true);

-- Create trigger for updating project updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically deduct hours from projects when time entries are created
CREATE OR REPLACE FUNCTION public.update_project_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if project_id is set
  IF NEW.project_id IS NOT NULL THEN
    -- Calculate hours worked
    DECLARE
      hours_worked DECIMAL(10,2);
    BEGIN
      hours_worked := EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600.0;
      
      -- Update project hours used
      UPDATE public.projects 
      SET hours_used = hours_used + hours_worked,
          updated_at = now()
      WHERE id = NEW.project_id;
      
      -- For janitorial accounts, also update monthly history
      IF (SELECT type FROM public.projects WHERE id = NEW.project_id) = 'janitorial_account' THEN
        INSERT INTO public.project_hour_history (project_id, month_year, hours_allocated, hours_used)
        VALUES (NEW.project_id, to_char(NEW.clock_in, 'YYYY-MM'), 
                (SELECT monthly_hours_allocated FROM public.projects WHERE id = NEW.project_id), 
                hours_worked)
        ON CONFLICT (project_id, month_year) 
        DO UPDATE SET hours_used = project_hour_history.hours_used + hours_worked;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update project hours when time entries are inserted
CREATE TRIGGER update_project_hours_trigger
  AFTER INSERT ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_hours();

-- Function to reset janitorial account hours monthly
CREATE OR REPLACE FUNCTION public.reset_janitorial_hours()
RETURNS void AS $$
BEGIN
  -- Reset hours_used for janitorial accounts at the start of each month
  UPDATE public.projects 
  SET hours_used = 0,
      updated_at = now()
  WHERE type = 'janitorial_account'
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Insert sample projects
INSERT INTO public.projects (name, description, type, total_hours_allocated, hourly_rate) VALUES
('Office Building Renovation', 'Complete renovation of 5-story office building', 'project', 2000.00, 45.00),
('Warehouse Construction', 'New warehouse facility construction', 'project', 1500.00, 50.00);

INSERT INTO public.projects (name, description, type, monthly_hours_allocated, hourly_rate) VALUES
('Downtown Office Cleaning', 'Monthly janitorial services for downtown office complex', 'janitorial_account', 160.00, 25.00),
('Retail Store Maintenance', 'Ongoing maintenance for retail chain', 'janitorial_account', 120.00, 30.00);

-- Create unique constraint for project_hour_history
ALTER TABLE public.project_hour_history 
ADD CONSTRAINT unique_project_month UNIQUE (project_id, month_year);