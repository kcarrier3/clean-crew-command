CREATE OR REPLACE FUNCTION public.is_punched_in_at(_user_id uuid, _job_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.time_entries te
    WHERE te.employee_id = _user_id
      AND te.job_site_id = _job_site_id
      AND te.clock_out IS NULL
  )
$$;

CREATE TABLE public.radio_transmissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_site_id uuid NOT NULL REFERENCES public.job_sites(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_path text NOT NULL,
  duration_seconds numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_radio_transmissions_site_time ON public.radio_transmissions (job_site_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.radio_transmissions TO authenticated;
GRANT ALL ON public.radio_transmissions TO service_role;

ALTER TABLE public.radio_transmissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Punched-in crew and managers can listen"
ON public.radio_transmissions FOR SELECT TO authenticated
USING (
  public.is_punched_in_at(auth.uid(), job_site_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Punched-in crew can transmit"
ON public.radio_transmissions FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.is_punched_in_at(auth.uid(), job_site_id)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Senders and admins can delete transmissions"
ON public.radio_transmissions FOR DELETE TO authenticated
USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.radio_transmissions;

CREATE POLICY "Crew can upload radio clips"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'radio'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (
    public.is_punched_in_at(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Crew can read radio clips for their site"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'radio'
  AND (
    public.is_punched_in_at(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);