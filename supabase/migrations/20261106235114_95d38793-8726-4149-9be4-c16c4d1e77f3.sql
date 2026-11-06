CREATE OR REPLACE FUNCTION public.training_manager_options() RETURNS TABLE(id uuid,first_name text,last_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT p.id,p.first_name,p.last_name FROM public.profiles p WHERE (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin')) AND p.active AND (public.has_role(p.id,'manager') OR public.has_role(p.id,'admin')) ORDER BY p.last_name,p.id $$;
REVOKE ALL ON FUNCTION public.training_manager_options() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.training_manager_options() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.set_training_schedule_id() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.schedule_id=gen_random_uuid(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.set_training_schedule_id() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_training_schedule_id() TO service_role;
CREATE TRIGGER assign_training_schedule_id BEFORE INSERT ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION public.set_training_schedule_id();
CREATE OR REPLACE FUNCTION public.guard_training_shift() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF pg_trigger_depth()=1 THEN
  IF TG_OP='INSERT' THEN
   IF NEW.training_session_id IS NOT NULL THEN RAISE EXCEPTION 'Create training shifts through Training Planner'; END IF;
  ELSIF TG_OP='DELETE' THEN
   IF OLD.training_session_id IS NOT NULL THEN RAISE EXCEPTION 'Remove this shift in Training Planner'; END IF;
  ELSIF OLD.training_session_id IS NOT NULL OR NEW.training_session_id IS NOT NULL THEN RAISE EXCEPTION 'Edit this shift in Training Planner';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER guard_training_shift ON public.employee_schedules;
CREATE TRIGGER guard_training_shift BEFORE INSERT OR UPDATE OR DELETE ON public.employee_schedules FOR EACH ROW EXECUTE FUNCTION public.guard_training_shift();