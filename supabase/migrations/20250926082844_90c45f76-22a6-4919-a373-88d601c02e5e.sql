-- Add attendance tracking preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN attendance_tracking_type text DEFAULT 'attendance_only' CHECK (attendance_tracking_type IN ('attendance_only', 'attendance_and_punctuality'));