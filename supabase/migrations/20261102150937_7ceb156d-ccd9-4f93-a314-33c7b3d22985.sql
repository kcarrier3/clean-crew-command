CREATE OR REPLACE FUNCTION public.require_account_on_invoice_and_drop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_TABLE_NAME = 'billing_invoices' THEN
    IF NEW.job_site_id IS NULL THEN
      RAISE EXCEPTION 'Choose an account before creating an invoice.';
    END IF;
  ELSIF TG_TABLE_NAME = 'supply_movements' THEN
    IF NEW.movement_type = 'sell' AND NEW.job_site_id IS NULL THEN
      RAISE EXCEPTION 'Choose an account for this supply drop-off.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.require_account_on_invoice_and_drop() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS billing_invoices_require_account ON public.billing_invoices;
CREATE TRIGGER billing_invoices_require_account
  BEFORE INSERT ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.require_account_on_invoice_and_drop();

DROP TRIGGER IF EXISTS supply_movements_require_account ON public.supply_movements;
CREATE TRIGGER supply_movements_require_account
  BEFORE INSERT OR UPDATE ON public.supply_movements
  FOR EACH ROW EXECUTE FUNCTION public.require_account_on_invoice_and_drop();