
-- Add worker/employee the inspection is being conducted on
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_employee_id ON public.inspections(employee_id);

-- Update the inspection-photos storage policy so the subject worker can also view photos
DROP POLICY IF EXISTS "inspection_photos_storage_read" ON storage.objects;
CREATE POLICY "inspection_photos_storage_read" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'inspection-photos'
  AND (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.inspection_photos ip
      JOIN public.inspections i ON i.id = ip.inspection_id
      WHERE ip.storage_path = storage.objects.name
        AND (i.inspector_id = auth.uid() OR i.employee_id = auth.uid())
    )
  )
);
