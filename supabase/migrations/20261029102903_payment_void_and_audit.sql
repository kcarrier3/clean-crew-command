-- Void and unapply leave an audit row. Invoice balances still recalc from
-- the allocation trigger. Bookkeeping stays in QuickBooks; this is the export source.

ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_reason text;

CREATE TABLE IF NOT EXISTS public.billing_payment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.billing_payments(id) ON DELETE SET NULL,
  invoice_id uuid,
  action text NOT NULL,
  amount numeric,
  detail text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.billing_payment_audit TO authenticated;
GRANT ALL ON public.billing_payment_audit TO service_role;
ALTER TABLE public.billing_payment_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing staff read payment audit" ON public.billing_payment_audit;
CREATE POLICY "billing staff read payment audit"
  ON public.billing_payment_audit FOR SELECT TO authenticated
  USING (public.can_manage_billing(auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.billing_payment_audit FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.void_customer_payment(_payment_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pay public.billing_payments; v_alloc record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_billing(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to manage billing' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_pay FROM public.billing_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_pay.voided_at IS NOT NULL THEN RETURN; END IF;

  FOR v_alloc IN SELECT * FROM public.billing_payment_allocations WHERE payment_id = v_pay.id LOOP
    INSERT INTO public.billing_payment_audit (payment_id, invoice_id, action, amount, detail, actor_id)
    VALUES (v_pay.id, v_alloc.invoice_id, 'void', v_alloc.amount, _reason, auth.uid());
    DELETE FROM public.billing_payment_allocations WHERE id = v_alloc.id;
  END LOOP;

  UPDATE public.billing_payments
     SET voided_at = now(), voided_by = auth.uid(), void_reason = _reason
   WHERE id = v_pay.id;

  INSERT INTO public.billing_payment_audit (payment_id, action, amount, detail, actor_id)
  VALUES (v_pay.id, 'void_payment', v_pay.amount, _reason, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.unapply_payment_allocation(_allocation_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_alloc public.billing_payment_allocations; v_void timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_billing(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to manage billing' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_alloc FROM public.billing_payment_allocations WHERE id = _allocation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Allocation not found'; END IF;
  SELECT voided_at INTO v_void FROM public.billing_payments WHERE id = v_alloc.payment_id;
  IF v_void IS NOT NULL THEN RAISE EXCEPTION 'Payment is already voided'; END IF;

  INSERT INTO public.billing_payment_audit (payment_id, invoice_id, action, amount, detail, actor_id)
  VALUES (v_alloc.payment_id, v_alloc.invoice_id, 'unapply', v_alloc.amount, _reason, auth.uid());
  DELETE FROM public.billing_payment_allocations WHERE id = v_alloc.id;
END $$;

REVOKE ALL ON FUNCTION public.void_customer_payment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unapply_payment_allocation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_customer_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unapply_payment_allocation(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_voided_payment_allocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_void timestamptz;
BEGIN
  SELECT voided_at INTO v_void FROM public.billing_payments WHERE id = NEW.payment_id;
  IF v_void IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot apply a voided payment' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reject_voided_payment_allocation ON public.billing_payment_allocations;
CREATE TRIGGER trg_reject_voided_payment_allocation
  BEFORE INSERT OR UPDATE ON public.billing_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.reject_voided_payment_allocation();
