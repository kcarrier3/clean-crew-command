CREATE POLICY "Uploaders and managers can delete work order photos"
ON public.work_order_photos
FOR DELETE
TO authenticated
USING (
  auth.uid() = uploaded_by
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);
GRANT DELETE ON public.work_order_photos TO authenticated;