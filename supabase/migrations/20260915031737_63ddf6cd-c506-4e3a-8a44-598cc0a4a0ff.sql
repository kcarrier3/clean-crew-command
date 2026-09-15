ALTER TABLE public.billing_email_messages
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz;

CREATE INDEX IF NOT EXISTS billing_email_messages_provider_message_id_idx
  ON public.billing_email_messages (provider_message_id);