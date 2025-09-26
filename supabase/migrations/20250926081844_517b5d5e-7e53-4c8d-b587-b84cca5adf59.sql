-- Add salary and pay type fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS salary_amount numeric,
ADD COLUMN IF NOT EXISTS pay_type text DEFAULT 'hourly' CHECK (pay_type IN ('hourly', 'salary'));

-- Update the handle_new_user function to handle the new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  -- Insert profile with metadata from signup
  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name, 
    email,
    employee_id,
    phone,
    hourly_rate,
    salary_amount,
    pay_type
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
    COALESCE(NEW.raw_user_meta_data ->> 'pay_type', 'hourly')
  );
  
  -- Assign default employee role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  -- Grant default employee permissions
  PERFORM public.grant_default_employee_permissions(NEW.id);
  
  RETURN NEW;
END;
$$;