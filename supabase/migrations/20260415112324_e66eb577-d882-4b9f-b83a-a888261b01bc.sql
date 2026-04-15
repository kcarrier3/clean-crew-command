
ALTER TABLE public.profiles
ADD COLUMN attendance_bonus_amount numeric DEFAULT NULL,
ADD COLUMN time_bonus_amount numeric DEFAULT NULL;
