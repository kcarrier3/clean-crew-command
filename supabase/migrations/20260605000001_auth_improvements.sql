-- Migration: Auth improvements
-- 1. Fix handle_new_user to persist job_title and attendance_tracking_type from invite metadata
-- 2. Add delete_own_account RPC for Apple App Store compliance

-- ============================================================
-- 1. Update handle_new_user trigger to include job_title
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name, 
    email,
    employee_id,
    phone,
    job_title,
    hourly_rate,
    salary_amount,
    pay_type,
    attendance_bonus_amount,
    time_bonus_amount
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'employee_id',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'job_title',
    CASE WHEN NEW.raw_user_meta_data ->> 'hourly_rate' IS NOT NULL 
         THEN (NEW.raw_user_meta_data ->> 'hourly_rate')::numeric 
         ELSE NULL END,
    CASE WHEN NEW.raw_user_meta_data ->> 'salary_amount' IS NOT NULL 
         THEN (NEW.raw_user_meta_data ->> 'salary_amount')::numeric 
         ELSE NULL END,
    COALESCE(NEW.raw_user_meta_data ->> 'pay_type', 'hourly'),
    CASE WHEN NEW.raw_user_meta_data ->> 'attendance_bonus_amount' IS NOT NULL 
         THEN (NEW.raw_user_meta_data ->> 'attendance_bonus_amount')::numeric 
         ELSE NULL END,
    CASE WHEN NEW.raw_user_meta_data ->> 'time_bonus_amount' IS NOT NULL 
         THEN (NEW.raw_user_meta_data ->> 'time_bonus_amount')::numeric 
         ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    job_title = COALESCE(EXCLUDED.job_title, public.profiles.job_title);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  PERFORM public.grant_default_employee_permissions(NEW.id);
  
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. Add delete_own_account RPC function
-- Allows authenticated users to delete their own account
-- (required by Apple App Store guidelines)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_own_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
BEGIN
  -- Get the calling user's ID
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Soft-delete: mark profile as inactive and clear PII
  UPDATE public.profiles
  SET 
    active = false,
    first_name = 'Deleted',
    last_name = 'User',
    phone = NULL,
    email = NULL
  WHERE id = _user_id;

  -- Remove permissions and roles
  DELETE FROM public.user_permissions WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.user_custom_roles WHERE user_id = _user_id;

  -- Delete the auth user (this cascades to the profile via FK if hard delete is needed)
  -- Using the service role via a security definer function is safe here
  DELETE FROM auth.users WHERE id = _user_id;
END;
$function$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- ============================================================
-- 3. Add attendance_tracking_type column to profiles if missing
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'attendance_tracking_type'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN attendance_tracking_type text DEFAULT 'attendance_only';
  END IF;
END $$;
