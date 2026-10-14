CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opt_in_at timestamptz;

CREATE TABLE public.employee_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  job_title text,
  invited_by uuid,
  kind text NOT NULL DEFAULT 'invite',
  status text NOT NULL DEFAULT 'pending',
  provider text,
  provider_message_id text,
  error_message text,
  link_expires_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  webhook_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.employee_invitations TO authenticated;
GRANT ALL ON public.employee_invitations TO service_role;
ALTER TABLE public.employee_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and staff managers can view invitations"
  ON public.employee_invitations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'manage_employees'::app_permission));
CREATE INDEX employee_invitations_user_idx ON public.employee_invitations(user_id, created_at DESC);
CREATE INDEX employee_invitations_provider_idx ON public.employee_invitations(provider_message_id);
CREATE TRIGGER employee_invitations_updated BEFORE UPDATE ON public.employee_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sms_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL DEFAULT 'missed_punch',
  schedule_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  shift_date date NOT NULL,
  scheduled_start timestamptz NOT NULL,
  to_phone text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  provider text,
  provider_message_id text,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_type, schedule_id, shift_date, manager_id)
);
GRANT SELECT ON public.sms_alert_log TO authenticated;
GRANT ALL ON public.sms_alert_log TO service_role;
ALTER TABLE public.sms_alert_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view SMS alerts"
  ON public.sms_alert_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER sms_alert_log_updated BEFORE UPDATE ON public.sms_alert_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value, description) VALUES
  ('sms_missed_punch_enabled', 'false', 'Send SMS to managers when a scheduled employee has not punched in'),
  ('missed_punch_grace_minutes', '10', 'Minutes after scheduled start before a missed punch-in alert'),
  ('company_timezone', 'America/New_York', 'Timezone used to interpret shift start times')
ON CONFLICT (key) DO NOTHING;