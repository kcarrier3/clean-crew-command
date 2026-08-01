ALTER TABLE public.paid_holidays RENAME COLUMN paid_only_if_scheduled TO paid_only_if_weekday;
ALTER TABLE public.paid_holidays ALTER COLUMN paid_only_if_weekday SET DEFAULT true;
UPDATE public.paid_holidays SET paid_only_if_weekday = true;