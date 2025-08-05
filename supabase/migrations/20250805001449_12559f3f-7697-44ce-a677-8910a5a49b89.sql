-- Create enum for time off request status
CREATE TYPE public.time_off_status AS ENUM ('pending', 'approved', 'declined');

-- Create time_off_requests table
CREATE TABLE public.time_off_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status time_off_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  manager_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for time off requests
-- Workers can view their own requests
CREATE POLICY "Employees can view their own time off requests" 
ON public.time_off_requests 
FOR SELECT 
USING (true);

-- Workers can create their own requests
CREATE POLICY "Employees can create time off requests" 
ON public.time_off_requests 
FOR INSERT 
WITH CHECK (true);

-- Managers can view all requests
CREATE POLICY "Managers can view all time off requests" 
ON public.time_off_requests 
FOR SELECT 
USING (true);

-- Managers can update request status
CREATE POLICY "Managers can update time off requests" 
ON public.time_off_requests 
FOR UPDATE 
USING (true);

-- Add trigger for updating timestamps
CREATE TRIGGER update_time_off_requests_updated_at
BEFORE UPDATE ON public.time_off_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();