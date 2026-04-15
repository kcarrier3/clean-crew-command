
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
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  PERFORM public.grant_default_employee_permissions(NEW.id);
  
  RETURN NEW;
END;
$function$;
