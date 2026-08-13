
ALTER TABLE public.billing_account_preferences
  ADD COLUMN IF NOT EXISTS billing_contact_name text,
  ADD COLUMN IF NOT EXISTS billing_phone text,
  ADD COLUMN IF NOT EXISTS default_po_number text,
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS reply_to_email text,
  ADD COLUMN IF NOT EXISTS special_instructions text;

ALTER TABLE public.billing_email_messages
  ADD COLUMN IF NOT EXISTS crm_company_id uuid,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS message_kind text NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS billing_email_messages_idempotency_key_uidx
  ON public.billing_email_messages (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS billing_email_messages_provider_msg_idx
  ON public.billing_email_messages (provider_message_id);
CREATE INDEX IF NOT EXISTS billing_email_messages_invoice_idx
  ON public.billing_email_messages (invoice_id);

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS last_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_status text;

CREATE OR REPLACE FUNCTION public.billing_invoice_email_rollup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.billing_invoices i
     SET email_status = NEW.status,
         email_count = (
           SELECT count(*) FROM public.billing_email_messages m
            WHERE m.invoice_id = NEW.invoice_id AND m.sent_at IS NOT NULL
         ),
         last_emailed_at = (
           SELECT max(m.sent_at) FROM public.billing_email_messages m
            WHERE m.invoice_id = NEW.invoice_id
         )
   WHERE i.id = NEW.invoice_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_email_messages_rollup ON public.billing_email_messages;
CREATE TRIGGER billing_email_messages_rollup
AFTER INSERT OR UPDATE ON public.billing_email_messages
FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_email_rollup();

INSERT INTO public.billing_email_templates (key, name, subject, body)
SELECT 'invoice_default',
       'Invoice email',
       'Invoice {{invoice_number}} from Summit Facilities Group',
       'Hello {{billing_contact_first_name}},

Please find attached invoice {{invoice_number}} from Summit Facilities Group for {{customer_name}}.

Invoice number: {{invoice_number}}
Invoice date: {{invoice_date}}
Amount due: {{invoice_total}}
Due date: {{due_date}}
PO number: {{po_number}}

If you have any questions about this invoice, just reply to this email and our billing team will be glad to help.

Thank you for your business,
Summit Facilities Group — Billing'
WHERE NOT EXISTS (SELECT 1 FROM public.billing_email_templates WHERE key = 'invoice_default');
