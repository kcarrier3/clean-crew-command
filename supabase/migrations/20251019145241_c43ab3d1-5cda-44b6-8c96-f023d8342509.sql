-- Create table to store device tokens for push notifications
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL, -- 'ios' or 'android'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own device tokens
CREATE POLICY "Users can manage their own device tokens"
ON public.device_tokens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_device_tokens_user_id ON public.device_tokens(user_id);

-- Create function to clean up old tokens
CREATE OR REPLACE FUNCTION public.cleanup_old_device_tokens()
RETURNS trigger AS $$
BEGIN
  -- Delete tokens older than 90 days for the same user
  DELETE FROM public.device_tokens
  WHERE user_id = NEW.user_id
  AND created_at < NOW() - INTERVAL '90 days';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-cleanup old tokens
CREATE TRIGGER cleanup_old_tokens_trigger
AFTER INSERT ON public.device_tokens
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_old_device_tokens();