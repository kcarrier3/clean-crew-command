
REVOKE EXECUTE ON FUNCTION public.can_manage_billing(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recalc_invoice_balance(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_manage_billing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_invoice_balance(uuid) TO authenticated;
