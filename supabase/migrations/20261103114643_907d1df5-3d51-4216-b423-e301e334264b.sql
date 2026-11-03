-- Table-level REVOKE also cleared the per-column grants; re-grant every column
-- except the money columns, which stay hidden from the API.
DO $$
DECLARE _cols text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO _cols
  FROM pg_attribute
  WHERE attrelid = 'public.job_sites'::regclass AND attnum > 0 AND NOT attisdropped
    AND attname NOT IN ('contract_amount');
  EXECUTE format('GRANT SELECT (%s), INSERT (%s), UPDATE (%s) ON TABLE public.job_sites TO authenticated', _cols, _cols, _cols);

  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO _cols
  FROM pg_attribute
  WHERE attrelid = 'public.project_phases'::regclass AND attnum > 0 AND NOT attisdropped
    AND attname NOT IN ('billing_amount', 'billing_percent');
  EXECUTE format('GRANT SELECT (%s), INSERT (%s), UPDATE (%s) ON TABLE public.project_phases TO authenticated', _cols, _cols, _cols);
END $$;