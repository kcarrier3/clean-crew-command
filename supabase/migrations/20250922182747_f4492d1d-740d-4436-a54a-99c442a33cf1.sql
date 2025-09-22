-- Create manager reports table for end of day logs
CREATE TABLE public.manager_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID NOT NULL,
  report_date DATE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create manager report photos table
CREATE TABLE public.manager_report_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.manager_reports(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create storage bucket for manager report photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('manager-report-photos', 'manager-report-photos', true);

-- Enable RLS on both tables
ALTER TABLE public.manager_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_report_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for manager_reports
CREATE POLICY "Managers can create their own reports"
ON public.manager_reports
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view all reports"
ON public.manager_reports
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can update their own reports"
ON public.manager_reports
FOR UPDATE
USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND manager_id = auth.uid());

-- RLS policies for manager_report_photos
CREATE POLICY "Managers can upload photos to reports"
ON public.manager_report_photos
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view all report photos"
ON public.manager_report_photos
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for manager report photos
CREATE POLICY "Managers can view report photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'manager-report-photos' AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Managers can upload report photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'manager-report-photos' AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

-- Add trigger for updated_at
CREATE TRIGGER update_manager_reports_updated_at
BEFORE UPDATE ON public.manager_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();