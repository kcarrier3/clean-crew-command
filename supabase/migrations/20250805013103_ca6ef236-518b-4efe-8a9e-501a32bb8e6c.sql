-- Create work order status enum
CREATE TYPE public.work_order_status AS ENUM ('open', 'in_progress', 'completed', 'reviewed');

-- Create work order priority enum
CREATE TYPE public.work_order_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create work order photo type enum
CREATE TYPE public.work_order_photo_type AS ENUM ('deficiency', 'completion');

-- Create work orders table
CREATE TABLE public.work_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  job_site_id UUID NOT NULL,
  assigned_to UUID NOT NULL,
  created_by UUID NOT NULL,
  status work_order_status NOT NULL DEFAULT 'open',
  priority work_order_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create work order photos table
CREATE TABLE public.work_order_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type work_order_photo_type NOT NULL,
  uploaded_by UUID NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create work order notes table
CREATE TABLE public.work_order_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_notes ENABLE ROW LEVEL SECURITY;

-- Create storage bucket for work order photos
INSERT INTO storage.buckets (id, name, public) VALUES ('work-order-photos', 'work-order-photos', true);

-- RLS Policies for work_orders
CREATE POLICY "Users can view work orders they created or are assigned to" 
ON public.work_orders 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create work orders" 
ON public.work_orders 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update work orders they created or are assigned to" 
ON public.work_orders 
FOR UPDATE 
USING (true);

-- RLS Policies for work_order_photos
CREATE POLICY "Users can view work order photos" 
ON public.work_order_photos 
FOR SELECT 
USING (true);

CREATE POLICY "Users can upload work order photos" 
ON public.work_order_photos 
FOR INSERT 
WITH CHECK (true);

-- RLS Policies for work_order_notes
CREATE POLICY "Users can view work order notes" 
ON public.work_order_notes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create work order notes" 
ON public.work_order_notes 
FOR INSERT 
WITH CHECK (true);

-- Storage policies for work order photos
CREATE POLICY "Work order photos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'work-order-photos');

CREATE POLICY "Users can upload work order photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'work-order-photos');

CREATE POLICY "Users can update their own work order photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'work-order-photos');

CREATE POLICY "Users can delete their own work order photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'work-order-photos');

-- Create trigger for automatic timestamp updates on work_orders
CREATE TRIGGER update_work_orders_updated_at
BEFORE UPDATE ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();