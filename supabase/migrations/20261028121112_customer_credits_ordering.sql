ALTER TABLE public.customer_credits ALTER COLUMN issued_at SET DEFAULT clock_timestamp();
ALTER TABLE public.customer_credit_applications ALTER COLUMN applied_at SET DEFAULT clock_timestamp();
