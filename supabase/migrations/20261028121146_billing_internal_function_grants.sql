REVOKE EXECUTE ON FUNCTION public.recalc_invoice_totals(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.billing_resolve_tax(uuid, uuid, date) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_default_item_id(text) FROM authenticated;
