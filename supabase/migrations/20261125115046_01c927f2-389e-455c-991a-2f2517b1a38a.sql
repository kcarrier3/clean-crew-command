CREATE TABLE public.court_item_clears (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  note text,
  cleared_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);
GRANT SELECT, INSERT, DELETE ON public.court_item_clears TO authenticated;
GRANT ALL ON public.court_item_clears TO service_role;
ALTER TABLE public.court_item_clears ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own court clears" ON public.court_item_clears FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers read court settings" ON public.app_settings FOR SELECT TO authenticated
  USING (key = 'in_your_court' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY "Admins insert court settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key = 'in_your_court' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update court settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (key = 'in_your_court' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (key = 'in_your_court' AND public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings (key, value, description) VALUES ('in_your_court',
 '{"payroll":{"enabled":true,"titles":["Office Manager"],"week_start_day":0},"billing":{"enabled":true,"titles":["Office Manager"],"recurring_days":5,"project_days":15}}',
 'In your court dashboard rules') ON CONFLICT (key) DO NOTHING;