-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  hire_date DATE,
  hourly_rate DECIMAL(10,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create jobs/sites table
CREATE TABLE public.job_sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  client_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create time entries table
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  job_site_id UUID REFERENCES public.job_sites(id),
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out TIMESTAMP WITH TIME ZONE,
  break_minutes INTEGER DEFAULT 0,
  notes TEXT,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (for future authentication)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Temporary policies to allow all access (will be updated when auth is added)
CREATE POLICY "Allow all access to employees" ON public.employees FOR ALL USING (true);
CREATE POLICY "Allow all access to job_sites" ON public.job_sites FOR ALL USING (true);
CREATE POLICY "Allow all access to time_entries" ON public.time_entries FOR ALL USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_sites_updated_at
  BEFORE UPDATE ON public.job_sites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.employees (employee_id, first_name, last_name, email, hourly_rate) VALUES
  ('EMP001', 'John', 'Smith', 'john.smith@email.com', 18.50),
  ('EMP002', 'Maria', 'Garcia', 'maria.garcia@email.com', 17.00),
  ('EMP003', 'David', 'Johnson', 'david.johnson@email.com', 19.25);

INSERT INTO public.job_sites (name, address, client_name) VALUES
  ('Downtown Office Building', '123 Main St, Downtown', 'ABC Corporation'),
  ('Retail Plaza', '456 Shopping Blvd', 'Retail Plus LLC'),
  ('Medical Center', '789 Health Ave', 'City Medical Group');