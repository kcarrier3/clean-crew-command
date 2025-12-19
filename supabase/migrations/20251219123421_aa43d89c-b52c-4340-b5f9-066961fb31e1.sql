-- Make work-order-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'work-order-photos';

-- Drop the public SELECT policy
DROP POLICY IF EXISTS "Work order photos are publicly accessible" ON storage.objects;

-- Create authenticated-only storage policies
CREATE POLICY "Authenticated users can view work order photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'work-order-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can upload work order photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'work-order-photos' 
  AND auth.role() = 'authenticated'
);

-- Drop overly permissive RLS policies on work_order_photos table
DROP POLICY IF EXISTS "Users can view work order photos" ON public.work_order_photos;
DROP POLICY IF EXISTS "Users can upload work order photos" ON public.work_order_photos;

-- Create restrictive policies that check work order access
CREATE POLICY "Users can view work order photos they can access"
ON public.work_order_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_photos.work_order_id
    AND (
      auth.uid() = wo.created_by OR 
      auth.uid() = wo.assigned_to OR 
      has_role(auth.uid(), 'manager'::app_role) OR 
      has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

CREATE POLICY "Users can upload work order photos they can access"
ON public.work_order_photos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_photos.work_order_id
    AND (
      auth.uid() = wo.created_by OR 
      auth.uid() = wo.assigned_to OR 
      has_role(auth.uid(), 'manager'::app_role) OR 
      has_role(auth.uid(), 'admin'::app_role)
    )
  )
  AND auth.uid() = uploaded_by
);