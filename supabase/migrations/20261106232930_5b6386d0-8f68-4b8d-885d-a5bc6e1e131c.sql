CREATE TABLE public.training_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), worker_id uuid NOT NULL REFERENCES public.profiles(id), manager_id uuid NOT NULL REFERENCES public.profiles(id), job_site_id uuid NOT NULL REFERENCES public.job_sites(id), session_date date NOT NULL, start_time time NOT NULL, end_time time NOT NULL, notes text, schedule_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), published_at timestamptz, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.training_sessions TO authenticated;
GRANT ALL ON public.training_sessions TO service_role;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY training_manager_read ON public.training_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY training_manager_write ON public.training_sessions FOR ALL TO authenticated USING ((public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin')) AND NOT public.is_project_crew_lead(auth.uid())) WITH CHECK ((public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin')) AND NOT public.is_project_crew_lead(auth.uid()));
CREATE TABLE public.new_account_calendar_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_site_id uuid NOT NULL REFERENCES public.job_sites(id), start_date date NOT NULL, manager_id uuid REFERENCES public.profiles(id), notes text, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.new_account_calendar_entries TO authenticated;
GRANT ALL ON public.new_account_calendar_entries TO service_role;
ALTER TABLE public.new_account_calendar_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_calendar_managers ON public.new_account_calendar_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin'));
ALTER TABLE public.employee_schedules ADD COLUMN training_session_id uuid UNIQUE REFERENCES public.training_sessions(id) ON DELETE CASCADE;
CREATE INDEX training_sessions_date_idx ON public.training_sessions(session_date);
CREATE INDEX training_sessions_manager_date_idx ON public.training_sessions(manager_id,session_date);
CREATE INDEX account_calendar_date_idx ON public.new_account_calendar_entries(start_date);
CREATE OR REPLACE FUNCTION public.validate_lookahead_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.manager_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=NEW.manager_id AND p.active AND (public.has_role(p.id,'manager') OR public.has_role(p.id,'admin'))) THEN RAISE EXCEPTION 'Choose an active manager'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.job_sites WHERE id=NEW.job_site_id AND active) THEN RAISE EXCEPTION 'Choose an existing active account'; END IF;
 IF TG_OP='UPDATE' THEN NEW.created_by=OLD.created_by; ELSE NEW.created_by=auth.uid(); END IF;
 NEW.updated_at=now();
 IF TG_TABLE_NAME='training_sessions' THEN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=NEW.worker_id AND active) THEN RAISE EXCEPTION 'Choose an active worker'; END IF;
  IF NEW.end_time<=NEW.start_time THEN RAISE EXCEPTION 'Training end time must be after start time'; END IF;
  IF TG_OP='INSERT' THEN NEW.published_at=NULL;
  ELSE
   NEW.schedule_id=OLD.schedule_id;
   IF (NEW.worker_id,NEW.manager_id,NEW.job_site_id,NEW.session_date,NEW.start_time,NEW.end_time,NEW.notes) IS DISTINCT FROM (OLD.worker_id,OLD.manager_id,OLD.job_site_id,OLD.session_date,OLD.start_time,OLD.end_time,OLD.notes) THEN
    IF EXISTS (SELECT 1 FROM public.time_entries WHERE schedule_id=OLD.schedule_id) THEN RAISE EXCEPTION 'Training with recorded attendance cannot be changed'; END IF;
    NEW.published_at=NULL;
   ELSIF pg_trigger_depth()=1 THEN NEW.published_at=OLD.published_at;
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_lookahead_entry() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_lookahead_entry() TO service_role;
CREATE TRIGGER validate_training_entry BEFORE INSERT OR UPDATE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_lookahead_entry();
CREATE TRIGGER validate_account_calendar_entry BEFORE INSERT OR UPDATE ON public.new_account_calendar_entries FOR EACH ROW EXECUTE FUNCTION public.validate_lookahead_entry();
CREATE OR REPLACE FUNCTION public.sync_training_shift() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS (SELECT 1 FROM public.time_entries WHERE schedule_id=OLD.schedule_id) THEN RAISE EXCEPTION 'Training with recorded attendance cannot be removed'; END IF;
  DELETE FROM public.employee_schedules WHERE id=OLD.schedule_id;
  RETURN OLD;
 END IF;
 INSERT INTO public.employee_schedules(id,employee_id,job_site_id,start_date,end_date,start_time,end_time,days_of_week,active,notes,training_session_id)
 VALUES(NEW.schedule_id,NEW.worker_id,NEW.job_site_id,NEW.session_date,NEW.session_date,NEW.start_time,NEW.end_time,ARRAY[extract(isodow FROM NEW.session_date)::int],NEW.published_at IS NOT NULL,'Training' || CASE WHEN coalesce(NEW.notes,'')='' THEN '' ELSE ': '||NEW.notes END,NEW.id)
 ON CONFLICT(id) DO UPDATE SET employee_id=EXCLUDED.employee_id,job_site_id=EXCLUDED.job_site_id,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,days_of_week=EXCLUDED.days_of_week,active=EXCLUDED.active,notes=EXCLUDED.notes,updated_at=now();
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_training_shift() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_training_shift() TO service_role;
CREATE TRIGGER sync_training_shift AFTER INSERT OR UPDATE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION public.sync_training_shift();
CREATE TRIGGER delete_training_shift BEFORE DELETE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION public.sync_training_shift();
CREATE OR REPLACE FUNCTION public.guard_training_shift() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF pg_trigger_depth()=1 AND (OLD.training_session_id IS NOT NULL OR (TG_OP='UPDATE' AND NEW.training_session_id IS NOT NULL)) THEN RAISE EXCEPTION 'Edit or remove this shift in Training Planner'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_training_shift() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_training_shift() TO service_role;
CREATE TRIGGER guard_training_shift BEFORE UPDATE OR DELETE ON public.employee_schedules FOR EACH ROW EXECUTE FUNCTION public.guard_training_shift();
CREATE POLICY hide_draft_training_shifts ON public.employee_schedules AS RESTRICTIVE FOR SELECT TO authenticated USING (training_session_id IS NULL OR active OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.publish_training_week() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.published THEN
  UPDATE public.training_sessions SET published_at=now() WHERE session_date>=NEW.week_start AND session_date<NEW.week_start+7 AND published_at IS NULL;
 ELSE
  UPDATE public.training_sessions SET published_at=NULL WHERE session_date>=NEW.week_start AND session_date<NEW.week_start+7 AND published_at IS NOT NULL;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.publish_training_week() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_training_week() TO service_role;
CREATE TRIGGER publish_training_week AFTER INSERT OR UPDATE OF published ON public.schedule_weeks FOR EACH ROW EXECUTE FUNCTION public.publish_training_week();