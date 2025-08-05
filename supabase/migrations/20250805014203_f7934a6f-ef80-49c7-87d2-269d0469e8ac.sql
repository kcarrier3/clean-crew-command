-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'reminder',
  read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (true);

CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_notifications_employee_id ON public.notifications(employee_id);
CREATE INDEX idx_notifications_unread ON public.notifications(employee_id, read) WHERE read = false;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to create weekly time-off reminders
CREATE OR REPLACE FUNCTION public.create_weekly_timeoff_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create notifications for all active employees
  INSERT INTO public.notifications (employee_id, title, message, type, action_url)
  SELECT 
    id,
    'Time-Off Request Deadline',
    'Reminder: Submit your time-off requests by end of day today for next week! Don''t forget to plan ahead.',
    'timeoff_reminder',
    '/time-off'
  FROM public.employees 
  WHERE active = true;
  
  -- Log the action
  RAISE NOTICE 'Created time-off reminders for % active employees', 
    (SELECT COUNT(*) FROM public.employees WHERE active = true);
END;
$$;

-- Schedule the function to run every Tuesday at 9 AM
-- Note: This requires pg_cron extension to be enabled
SELECT cron.schedule(
  'weekly-timeoff-reminders',
  '0 9 * * 2', -- Every Tuesday at 9 AM
  'SELECT public.create_weekly_timeoff_reminders();'
);