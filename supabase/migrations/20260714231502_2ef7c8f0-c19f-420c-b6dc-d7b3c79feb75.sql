
-- Notes table
CREATE TABLE public.crm_lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_notes TO authenticated;
GRANT ALL ON public.crm_lead_notes TO service_role;
ALTER TABLE public.crm_lead_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users manage lead notes" ON public.crm_lead_notes
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));
CREATE TRIGGER update_crm_lead_notes_updated_at BEFORE UPDATE ON public.crm_lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Files table
CREATE TABLE public.crm_lead_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  content_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_files TO authenticated;
GRANT ALL ON public.crm_lead_files TO service_role;
ALTER TABLE public.crm_lead_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users manage lead files" ON public.crm_lead_files
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

-- Storage policies for crm-files bucket
CREATE POLICY "CRM users read crm-files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'crm-files' AND public.is_crm_user(auth.uid()));
CREATE POLICY "CRM users insert crm-files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-files' AND public.is_crm_user(auth.uid()));
CREATE POLICY "CRM users update crm-files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'crm-files' AND public.is_crm_user(auth.uid()));
CREATE POLICY "CRM users delete crm-files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'crm-files' AND public.is_crm_user(auth.uid()));
