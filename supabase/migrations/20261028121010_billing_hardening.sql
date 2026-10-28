-- Only draft invoices can be hard-deleted; everything else must be voided
CREATE OR REPLACE FUNCTION public.billing_invoice_block_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Invoice % is %, so it cannot be deleted. Void it instead (set status = ''void'').', coalesce(OLD.invoice_number, OLD.id::text), OLD.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.billing_invoice_block_delete() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_billing_invoice_block_delete ON public.billing_invoices;
CREATE TRIGGER trg_billing_invoice_block_delete BEFORE DELETE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_block_delete();

-- Stamp voided_at when an invoice is voided
CREATE OR REPLACE FUNCTION public.billing_invoice_stamp_void()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'void' AND OLD.status IS DISTINCT FROM 'void' AND NEW.voided_at IS NULL THEN NEW.voided_at := now(); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.billing_invoice_stamp_void() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_billing_invoice_stamp_void ON public.billing_invoices;
CREATE TRIGGER trg_billing_invoice_stamp_void BEFORE UPDATE OF status ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_stamp_void();

-- Daily: sent invoices past their due date become past_due (06:05 America/New_York ~ 10:05 UTC)
CREATE OR REPLACE FUNCTION public.billing_mark_past_due()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE billing_invoices SET status = 'past_due'
   WHERE status = 'sent' AND due_date IS NOT NULL
     AND due_date < (now() AT TIME ZONE 'America/New_York')::date
     AND coalesce(balance_due, 0) > 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.billing_mark_past_due() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'billing-mark-past-due';
SELECT cron.schedule('billing-mark-past-due', '5 10 * * *', 'SELECT public.billing_mark_past_due();');
