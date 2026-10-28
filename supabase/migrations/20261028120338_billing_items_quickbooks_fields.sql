ALTER TABLE public.billing_items
  ADD COLUMN IF NOT EXISTS qb_item_id text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS taxable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS qb_item_type text,
  ADD COLUMN IF NOT EXISTS qb_income_account text,
  ADD COLUMN IF NOT EXISTS purchase_cost numeric,
  ADD COLUMN IF NOT EXISTS item_kind text NOT NULL DEFAULT 'service';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='billing_items_qb_item_id_key') THEN
    ALTER TABLE public.billing_items ADD CONSTRAINT billing_items_qb_item_id_key UNIQUE (qb_item_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='billing_items_item_kind_check') THEN
    ALTER TABLE public.billing_items ADD CONSTRAINT billing_items_item_kind_check CHECK (item_kind IN ('service','product','credit','adjustment'));
  END IF;
END $$;
COMMENT ON COLUMN public.billing_items.item_kind IS 'service | product | credit (customer credits: referral/dissatisfaction/credit memo) | adjustment (accounting items, not billable work)';
COMMENT ON COLUMN public.billing_items.qb_item_id IS 'QuickBooks Online Item.Id this catalog item was imported from';
