-- Multiple recurring schedules per job site, line items, consolidated invoices,
-- and the QuickBooks suggestion list. Nothing here activates a schedule.

ALTER TABLE public.recurring_billing_schedules
  DROP CONSTRAINT IF EXISTS recurring_billing_schedules_job_site_id_key;

ALTER TABLE public.recurring_billing_schedules
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Monthly service',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS cc_recipients text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reply_to_email text,
  ADD COLUMN IF NOT EXISTS memo text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS consolidated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qb_last_sent_on date,
  ADD COLUMN IF NOT EXISTS qb_last_email_status text;

UPDATE public.recurring_billing_schedules
   SET status = CASE WHEN active THEN 'active' ELSE 'inactive' END
 WHERE status IS NULL OR status NOT IN ('active', 'hold', 'inactive');

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_billing_schedules_status_check') THEN
    ALTER TABLE public.recurring_billing_schedules
      ADD CONSTRAINT recurring_billing_schedules_status_check
      CHECK (status IN ('active', 'hold', 'inactive'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_recurring_schedule_site_label
  ON public.recurring_billing_schedules (job_site_id, lower(label));

CREATE OR REPLACE FUNCTION public.recurring_schedule_sync_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.label IS NULL OR btrim(NEW.label) = '' THEN
    NEW.label := 'Monthly service';
  END IF;
  NEW.active := NEW.status = 'active';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recurring_schedule_sync_active ON public.recurring_billing_schedules;
CREATE TRIGGER trg_recurring_schedule_sync_active
  BEFORE INSERT OR UPDATE ON public.recurring_billing_schedules
  FOR EACH ROW EXECUTE FUNCTION public.recurring_schedule_sync_active();

CREATE TABLE IF NOT EXISTS public.recurring_billing_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.recurring_billing_schedules(id) ON DELETE CASCADE,
  billing_item_id uuid REFERENCES public.billing_items(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rate numeric NOT NULL DEFAULT 0,
  taxable boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_billing_lines TO authenticated;
GRANT ALL ON public.recurring_billing_lines TO service_role;
ALTER TABLE public.recurring_billing_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing staff manage recurring lines" ON public.recurring_billing_lines;
CREATE POLICY "billing staff manage recurring lines"
  ON public.recurring_billing_lines FOR ALL TO authenticated
  USING (public.can_manage_billing(auth.uid()))
  WITH CHECK (public.can_manage_billing(auth.uid()));

CREATE OR REPLACE FUNCTION public.refresh_recurring_schedule_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid := COALESCE(NEW.schedule_id, OLD.schedule_id);
BEGIN
  UPDATE public.recurring_billing_schedules s
     SET amount = COALESCE((
       SELECT ROUND(SUM(l.quantity * l.rate), 2)
       FROM public.recurring_billing_lines l
       WHERE l.schedule_id = v_id
     ), 0)
   WHERE s.id = v_id;
  RETURN COALESCE(NEW, OLD);
END $$;

REVOKE ALL ON FUNCTION public.refresh_recurring_schedule_amount() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_refresh_recurring_schedule_amount ON public.recurring_billing_lines;
CREATE TRIGGER trg_refresh_recurring_schedule_amount
  AFTER INSERT OR UPDATE OR DELETE ON public.recurring_billing_lines
  FOR EACH ROW EXECUTE FUNCTION public.refresh_recurring_schedule_amount();

-- One invoice per schedule per period, or one invoice per consolidation group per period.
-- The old unique (job_site, period) blocked a second schedule on the same site and a
-- shared invoice across sites.
DROP INDEX IF EXISTS public.uq_billing_invoice_recurring_period;

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS recurring_schedule_id uuid REFERENCES public.recurring_billing_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurring_group_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_recurring_schedule_period
  ON public.billing_invoices (recurring_schedule_id, recurring_period_start)
  WHERE recurring_schedule_id IS NOT NULL
    AND recurring_group_key IS NULL
    AND recurring_period_start IS NOT NULL
    AND status <> 'void';

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_recurring_group_period
  ON public.billing_invoices (recurring_group_key, recurring_period_start)
  WHERE recurring_group_key IS NOT NULL
    AND recurring_period_start IS NOT NULL
    AND status <> 'void';

ALTER TABLE public.billing_invoice_items
  ADD COLUMN IF NOT EXISTS job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_location text;

-- Suggested schedules from QuickBooks. Confirming a row creates an inactive schedule.
CREATE TABLE IF NOT EXISTS public.qb_recurring_prefill (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qb_customer_id text,
  qb_customer text NOT NULL,
  pattern text,
  qb_recurring_template_ids text,
  months_invoiced_last6 integer,
  invoices_last6 integer,
  recurring_invoices_last6 integer,
  latest_invoice text,
  latest_date date,
  latest_subtotal numeric,
  distinct_amounts_last6 text,
  usual_day_of_month integer,
  terms text,
  bill_email text,
  memo text,
  latest_tax numeric,
  latest_email_status text,
  lines text,
  job_site_id text,
  job_site_name text,
  job_site_match text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  confirmed_schedule_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qb_recurring_prefill TO authenticated;
GRANT ALL ON public.qb_recurring_prefill TO service_role;
ALTER TABLE public.qb_recurring_prefill ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing staff manage qb recurring prefill" ON public.qb_recurring_prefill;
CREATE POLICY "billing staff manage qb recurring prefill"
  ON public.qb_recurring_prefill FOR ALL TO authenticated
  USING (public.can_manage_billing(auth.uid()))
  WITH CHECK (public.can_manage_billing(auth.uid()));

-- Seed rows are appended below by the same migration.

INSERT INTO public.qb_recurring_prefill (
  qb_customer_id, qb_customer, pattern, qb_recurring_template_ids, months_invoiced_last6, invoices_last6, recurring_invoices_last6, latest_invoice, latest_date, latest_subtotal, distinct_amounts_last6, usual_day_of_month, terms, bill_email, memo, latest_tax, latest_email_status, lines, job_site_id, job_site_name, job_site_match
) VALUES
('541', '*Ethos CPA', 'qb_recurring_template', '56', 6, 6, 6, '3751', '2026-10-01', 325.0, '325.0', 1, 'Net 30', 'karen@ethosohio.com', 'Current Month Services', 26.0, 'EmailSent', 'Janitorial:Janitorial Services x1 @325', '35734e8f-8d50-4133-a596-2eab1086b80b', 'Ethos CPA', 'exact'),
('367', 'Alfa Romeo of Strongsville', 'qb_recurring_template', '45', 6, 17, 6, '3742', '2026-10-01', 2352.5, '2352.5', 1, 'Net 30', 'laurie@alfastrongsville.com', 'Current month services', 188.2, 'EmailSent', 'Janitorial:Janitorial Services x1 @2352.5', 'f72e2859-eb4e-4aad-83af-b4733cd4cd1c', 'Alfa Romeo Strongsville', 'fuzzy 0.95'),
('113', 'Amicon Construction Inc', 'qb_recurring_template', '67', 5, 6, 3, '3761', '2026-10-01', 400.0, '400.0', 1, 'Net 30', 'acctsrec@amiconconstruction.com', 'Monthly Service', 26.0, 'EmailSent', 'Janitorial:Janitorial Services x1 @400', NULL, NULL, 'none'),
('519', 'Avon Lake Regional Water', 'qb_recurring_template', '54', 6, 9, 6, '3750', '2026-10-01', 1490.0, '1420.0;1490.0', 1, 'Net 30', 'blogan@avonlakewater.org', 'Current Month Services', 0, 'EmailSent', 'Janitorial:Janitorial Services x1 @1420 | Janitorial:Janitorial Services x1 @70 (Engineering Office)', '7879707d-0b86-460b-b949-3b378eb4c032', 'Avon Lake Regional Water', 'exact'),
('27', 'Aztec Steel', 'qb_recurring_template', '14', 6, 6, 6, '3728', '2026-10-01', 475.0, '385.0;475.0', 1, 'Net 30', 'ap@aztecsteel.com', 'Current Month Services', 30.88, 'EmailSent', 'Janitorial:Janitorial Services x1 @475', 'fcac1154-1cb2-4242-9bb3-a064cf63f095', 'Aztec Steel', 'exact'),
('36', 'Beth Israel - The West Temple', 'qb_recurring_template', '18', 6, 8, 6, '3729', '2026-10-01', 650.0, '650.0', 1, 'Net 30', 'treasurer@thewesttemple.org', 'Monthly janitorial services', 0, 'EmailSent', 'Janitorial:Janitorial Services x1 @650', '248101a1-12a9-4e97-a664-c186b90c307d', 'Beth Israel- The West Temple', 'exact'),
('145', 'City Wide Facility Solutions', 'qb_recurring_template', '27', 6, 6, 6, '3735', '2026-10-01', 21994.0, '21994.0', 1, 'Net 30', 'rmcclain@gocitywide.com', 'Previous month services', 0, 'EmailSent', 'Janitorial:Janitorial Services x1 @17649 | Truck Expenses x1 @340 | Janitorial:Janitorial Services x1 @2630 (Palmer Holland) | Janitorial:Janitorial Services x1 @1375 (CPL)', NULL, NULL, 'none (subcontract; lines name Palmer Holland, CPL - no matching Crew Compass sites)'),
('86', 'City of Avon', 'qb_recurring_template', '21;53', 6, 41, 12, '3732', '2026-10-01', 5203.75, '1075.0;1595.0;5080.0;5203.75;7380.0;7503.75', 1, 'Net 30', 'financedept@cityofavon.com', 'REVISED 
Current Month Services', 0, 'EmailSent', 'Janitorial:Janitorial Services x1 @1355 (Avon City Hall (New Bldg)) | Janitorial:Janitorial Services x1 @500 (Avon Utilities Department) | Janitorial:Janitorial Services x1 @700 (Avon Senior Center) | Janitorial:Janitorial Services x1 @1800 (Avon Police Department) | Janitorial:Janitorial Services x1 @735 (Avon Street Department) | Janitorial:Janitorial Services x1 @113.75 (Avon City Hall (Old Bldg))', NULL, 'multiple Avon sites (see lines)', 'split by line: City Hall 1355+113.75, Utilities 500, Senior Center 700, Police 1800, Street 735'),
('116', 'Cleveland Construction', 'qb_recurring_template', '63', 6, 6, 5, '3757', '2026-10-01', 257.04, '257.04', 1, 'Net 30', 'monslow@clevelandconstruction.com', 'Monthly Services
Project Scarlett Temp Office Cleaning', 18.64, 'EmailSent', 'Janitorial:Janitorial Services x1 @257.04', 'cb945c1b-b1a5-44c6-857c-7a5103a46385', 'Cleveland Construction', 'exact'),
('606', 'Cuyahoga Fence', 'qb_recurring_template', '62', 6, 6, 6, '3756', '2026-10-01', 275.0, '275.0', 1, 'Net 30', 'debbie.w@cuyahogafence.com', 'Monthly Services', 17.88, 'EmailSent', 'Janitorial:Janitorial Services x1 @275', '8eceb8b3-4905-402b-a7c2-9e831a48ce99', 'Cuyahoga Fence', 'exact'),
('453', 'Express Seed', 'qb_recurring_template', '46', 6, 17, 6, '3743', '2026-10-01', 2875.0, '2875.0', 1, 'Net 30', 'jperegord@expressseed.com', 'Current Month Services', 186.88, 'EmailSent', 'Janitorial:Janitorial Services x1 @2875', '2f94822d-74de-4e6a-abb1-f0fd2319504b', 'Express Seed Company', 'suggested (name)'),
('664', 'Firelands Auto Group', 'qb_recurring_template', '65', 5, 6, 4, '3759', '2026-10-01', 8457.36, '8457.36', 1, 'Net 30', 'ap@feldmanauto.com', 'Monthly Services', 570.87, 'EmailSent', 'Janitorial:Janitorial Services x1 @8457.36', '56cad6b8-0d21-4b2b-8616-4399a33ad87a;9148cf3b-357f-47c5-847e-7f594eb89449;827e97ca-b4d4-4651-b6e1-218d8777eb6f', 'Firelands Chevrolet Vermilion;Firelands Chrysler Sandusky;Firelands Toyota Sandusky', 'suggested (name)'),
('478', 'Ganley Buick GMC-Strongsville', 'qb_recurring_template', '47', 6, 6, 6, '3744', '2026-10-01', 0.0, '0.0;3145.0', 1, 'Net 30', 'ckozlowski@ganleyauto.com', 'Current month services', 0, 'EmailSent', 'Janitorial:Janitorial Services x1 @3145 | Referral Credit:Referral Credit x1 @-3145', 'b7b10611-8dc0-43fa-8c76-bedd64886672', 'Ganley Buick Strongsville', 'fuzzy 0.94'),
('100000021', 'Guardian Alarm Of Cleveland', 'qb_recurring_template', '70', 2, 2, 1, '3764', '2026-10-01', 400.0, '400.0', 1, 'Net 30', 'accountspayable@guardianalarm.com', 'Monthly Services', 32.0, 'EmailSent', 'Janitorial:Janitorial Services x1 @400', '299f4da8-1bfe-442e-9c92-8e03cdc17dc3', 'Guardian Alarm', 'suggested (name)'),
('479', 'Halleen Kia - Sandusky', 'qb_recurring_template', '51', 6, 11, 6, '3747', '2026-10-01', 1599.0, '1599.0', 1, 'Net 30', 'phalleen@halleenkia.com', 'Current month services', 107.93, 'EmailSent', 'Janitorial:Janitorial Services x1 @1599', '366390e4-6c57-4886-b85d-4c5110619ade', 'Halleen Kia Sandusky', 'exact'),
('492', 'Horizon Science Academy', 'qb_recurring_template', '52', 4, 4, 3, '3748', '2026-10-01', 8570.0, '8570.0', 1, 'Net 30', 'ozturk@conceptschools.org', 'Current Month Services', 0, 'EmailSent', 'Janitorial:Janitorial Services x1 @8570', '6f626169-19ca-4999-9694-a891541c06b7', 'Horizon Science Academy', 'exact'),
('422', 'KTM North America, Inc', 'qb_recurring_template', '41', 6, 13, 6, '3740', '2026-10-01', 1322.99, '1322.99', 1, 'Net 30', 'ap-na@ktm.com', 'Monthly Service

PO #6200011860
Vendor #6009153', 85.99, 'EmailSent', 'Janitorial:Janitorial Services x1 @1322.99', '0860ddd7-c906-4302-a1ac-20c19a10fd9e', 'KTM', 'suggested (name)'),
('604', 'Kinetic Wealth Development', 'qb_recurring_template', '58', 6, 6, 6, '3752', '2026-10-01', 227.5, '227.5', 1, 'Net 30', 'Richard.packer@kinetic-wealth.com', 'Current Month Services', 18.2, 'EmailSent', 'Janitorial:Janitorial Services x1 @227.5', '78e2c079-a961-4aac-b3cb-0ad1ac6fab7f', 'Kinetic Wealth', 'suggested (name)'),
('616', 'Lake Erie Nature and Science Center', 'qb_recurring_template', '66', 6, 6, 4, '3760', '2026-10-01', 1250.0, '830.0;1094.0;1250.0', 1, 'Net 30', 'carolo@lensc.org', 'Monthly Services', 0, 'EmailSent', 'Janitorial:Janitorial Services x1 @1250 (3 days of service)', '28b4f2dc-e4bd-429a-a9a8-26b8f537a31b', 'Lake Erie Nature and Science Center', 'exact'),
('588', 'Leimkuehler Orthoic-Prosthetic Center Amherst', 'qb_recurring_template', '60', 6, 12, 6, '3754', '2026-10-01', 780.0, '780.0', 1, 'Net 30', 'AP@leimop.com', 'Monthly Services', 50.7, 'EmailSent', 'Janitorial:Janitorial Services x1 @780', '2dda202a-969e-4676-809c-a8de8a5a6736', 'Leimkuehler Orthotic-Prosthetic Amherst', 'fuzzy 0.91'),
('605', 'Leimkuehler Orthotic-Prosthetic Center, Inc -Sandusky', 'qb_recurring_template', '59', 6, 8, 6, '3753', '2026-10-01', 195.0, '195.0', 1, 'Net 30', 'AP@leimop.com', 'Current Month Services', 13.16, 'EmailSent', 'Janitorial:Janitorial Services x1 @195', '73502cf2-e701-4fea-887a-e8db4edbcea2', 'Leimkuehler Orthotic-Prosthetic Sandusky', 'fuzzy 0.89'),
('169', 'Lifecare Ambulance Service Inc', 'qb_recurring_template', '29', 6, 6, 6, '3737', '2026-10-01', 525.0, '525.0', 1, 'Net 30', 'accountspayable@lifecareambulance.com', 'Current month services', 34.13, 'EmailSent', 'Janitorial:Janitorial Services x1 @525', '008efb68-0ef9-480a-838f-edaa88b50342', 'Lifecare', 'suggested (name)'),
('21', 'Medmark Treatment Centers', 'qb_recurring_template', '8', 6, 6, 6, '3727', '2026-10-01', 510.0, '510.0', 1, 'Net 30', 'invoices@baymark.com', 'Current Month Services', 33.15, 'EmailSent', 'Janitorial:Janitorial Services x1 @510', '4565b929-ce51-4801-b4dc-af071b929903', 'MedMark Treatment Center', 'fuzzy 0.98'),
('20', 'Nelson Stud Welding - Liberty', 'qb_recurring_template', '20', 6, 6, 6, '3731', '2026-10-01', 3425.0, '3425.0', 1, 'Net 90', 's-eft-nelsonpayables@sbdinc.com', 'Cleaning Services 
PO #563190', 222.63, 'EmailSent', 'Janitorial:Janitorial Services x1 @1000 | Restroom Cleaning x8 @237.5 (4 Small RR 2/mo) | Project Work:Carpet Cleaning x1 @425 | Kitchen Cleaning x1 @100', 'fd17848e-fa51-4d9d-828a-0738d7d00c56', 'Stanley Nelson Liberty Court', 'suggested (name)'),
('19', 'Nelson Stud Welding - West Ridge', 'qb_recurring_template', '19', 6, 7, 6, '3730', '2026-10-01', 7175.0, '7175.0', 1, 'Net 90', 's-eft-nelsonpayables@sbdinc.com', 'Janitorial Services 
PO #563191', 466.38, 'EmailSent', 'Janitorial:Janitorial Services x1 @5600 | Project Work:Carpet Cleaning x1 @450 | Project work from janitorial sales:Deep Clean x3 @375', '0835cc8d-d4e2-4af9-952b-e0f142a0b75d', 'Stanley Nelson West Ridge', 'suggested (name)'),
('662', 'PT Link', 'qb_recurring_template', '68', 4, 4, 3, '3762', '2026-10-01', 315.0, '315.0', 1, 'Net 30', 'bgutzky@ptlinktherapy.com', 'Monthly Services', 20.48, 'EmailSent', 'Janitorial:Janitorial Services x1 @315', '5af5e265-1036-4b84-8fe6-91d130d4963d', 'PT Link', 'exact'),
('625', 'Platelet Disorder Support Assocation', 'qb_recurring_template', '61', 6, 6, 6, '3755', '2026-10-01', 285.0, '285.0', 1, 'Net 30', 'admin@pdsa.org', 'Current Month Services', 0, 'EmailSent', 'Janitorial:Janitorial Services x1 @285', '2bb4e203-cea3-4636-8285-fa0aeb4d0ba9', 'PDSA', 'suggested (name)'),
('489', 'Premier Toyota of Amherst', 'qb_recurring_template', '50', 6, 6, 6, '3746', '2026-10-01', 4500.0, '4429.68;4500.0', 1, 'Net 30', 'kmarx@premiertoyota.com', 'Current Month Services', 292.5, 'EmailSent', 'Janitorial:Janitorial Services x1 @4500', 'aa6c3679-49d3-4bf1-9f63-0f9cd923618d', 'Premier Toyota of Amherst', 'exact'),
('409', 'Ray''s Auto and Truck Service*', 'qb_recurring_template', '39', 6, 16, 6, '3739', '2026-10-01', 410.0, '410.0', 1, 'Net 30', 'cathyraysauto@gmail.com', 'Current month services', 26.65, 'EmailSent', 'Janitorial:Janitorial Services x1 @410', '1df19773-7cb9-437a-ab85-8775acd55b89', 'Ray''s Auto', 'suggested (name)'),
('483', 'Royce Security', 'qb_recurring_template', '49', 6, 8, 6, '3745', '2026-10-01', 530.0, '530.0', 1, 'Net 30', 'accounting@roycesecurity.com', 'Current Month Services', 42.4, 'EmailSent', 'Janitorial:Janitorial Services x1 @530', 'cb13da2f-09fd-4246-bef0-a83f72ad27c0', 'Royce Security', 'exact'),
('372', 'Stanley Assembly Technologies', 'qb_recurring_template', '35', 6, 17, 6, '3738', '2026-10-01', 4000.0, '4000.0', 1, 'Net 60', 'S-CRP-AssemblyAPInvoices@sbdinc.com', 'Monthly Services
PO ATPU-227227', 320.0, 'NotSet', 'Janitorial:Janitorial Services x1 @4000', 'ff9d4df9-ce90-436d-b3a6-c1a9a2fe441f', 'Stanley Highland Heights', 'suggested (name)'),
('154', 'Stelfast', 'qb_recurring_template', '28', 6, 16, 6, '3736', '2026-10-01', 1400.0, '1400.0', 1, 'Net 30', 'danam@stelfast.com', 'Current month services', 112.0, 'EmailSent', 'Janitorial:Janitorial Services x1 @1400', 'eb51714c-7bfe-42b3-a672-62a8f483c182', 'Stelfast', 'exact'),
('429', 'The Lawrence Community Management Group', 'qb_recurring_template', '44', 6, 6, 6, '3741', '2026-10-01', 90.0, '90.0', 1, 'Net 30', 'ap@lawrencemanagement.com', 'Current Month Services
Vermilion Shores', 5.85, 'EmailSent', 'Janitorial:Janitorial Services x1 @90 (Elevator Cleaning)', NULL, NULL, 'none'),
('115', 'Tuffman Equipment', 'qb_recurring_template', '26', 6, 9, 6, '3734', '2026-10-01', 245.0, '245.0', 1, 'Net 30', 'apinvoices@tuffmanequip.com', 'Current month services', 15.93, 'EmailSent', 'Janitorial:Janitorial Services x1 @245', '27cebdc9-8448-4bef-9610-d15388188da4', 'Tuffman equipment', 'exact'),
('626', 'Vermilion Police Department', 'qb_recurring_template', '69', 4, 5, 3, '3763', '2026-10-01', 430.0, '430.0', 1, 'Net 30', 'dcoffman@cityofvermilionohio.gov', 'Monthly Service', 0, 'EmailSent', 'Janitorial:Janitorial Services x1 @430', 'b1409ff3-515a-45e8-aa4b-092fd2b76d18', 'Vermilion Police Department', 'exact'),
('89', 'Vermilion Shores Condominiums', 'qb_recurring_template', '22', 6, 8, 6, '3733', '2026-10-01', 435.0, '435.0', 1, 'Net 30', 'invoices@continentalmgmt.com', 'Current Month Services', 28.28, 'EmailSent', 'Janitorial:Janitorial Services x1 @435', 'b5342255-4cbf-41d2-b473-82c52aaabe92', 'Vermilion Shores', 'suggested (name)'),
('649', 'Westline Lakewood', 'qb_recurring_template', '64', 6, 7, 5, '3758', '2026-10-01', 1430.0, '715.0;1430.0', 1, 'Net 30', 'carrie@yourcrossstreet.com', 'Monthly Services', 114.4, 'EmailSent', 'Janitorial:Janitorial Services x1 @715 (North Tower) | Janitorial:Janitorial Services x1 @715 (South Tower)', '536ebb2f-ba5c-4a2c-9709-2c0992fd1f07', 'Westline', 'suggested (name)'),
('651', 'Adena Corporation', 'irregular', NULL, 1, 1, 0, '3664', '2026-08-31', 1080.0, '1080.0', 31, 'Net 30', 'a.dentinger@adenacorporation.com', 'Ticket Work Bucyrus, OH | Avita Orthopedic Center', 78.3, 'EmailSent', 'Project Work:Touch Up Clean x1 @1080 (x-ray room, floors, various rooms (dust down))', NULL, NULL, 'none'),
('13', 'Avon Police Department', 'irregular', NULL, 5, 5, 0, '3780', '2026-10-21', 291.96, '290.14;291.96;338.12;350.68;453.62', 2, 'Net 30', 'cjohnson@avonpd.com', NULL, 0, 'NotSet', 'Consumable Products:T002 x8 @8.25 (Teddy Towels, H/H style paper towels, 150 sheets/roll, 6 rolls to a case) | Consumable Products:B002 x8 @8.25 (Amore bath tissue - 12 rolls/pack) | Consumable Products:j6100 x1 @34.43 (White multifold towels, 16x250, case of 4000) | Consumable Products:SVS-R4671 x1 @25.07 (1.5 mil eq low density can liner, 40x46) | Consumable Products:FGD-4300 x1 @62.25 (FoamFresh Luxury Foam Wash) | Consumable Products:FRSEA36KG x1 @38.21 (For large spaces that need a simple odor solution, try the passive Eco Air. Its a powerful freshening system that requires no batteries or fan s. 6 per box. Kiwi grapefruit scented.)', '67fad208-beb7-445d-97c5-5f33eaf258f3', 'Avon Police Department', 'exact'),
('622', 'Bloom General Contracting', 'irregular', NULL, 3, 3, 0, '3781', '2026-09-15', 1140.0, '1140.0;3120.0;10315.0', 27, 'Net 30', NULL, NULL, 76.95, 'NotSet', 'Project Work:Touch Up Clean x28.5 @40', NULL, NULL, 'none'),
('126', 'City Wide Facility Solutions - Westlake', 'irregular', NULL, 4, 5, 0, '3726', '2026-09-30', 1614.8, '710.0;730.0;1614.8;1861.5;2241.1', 29, 'Net 30', 'rmcclain@gocitywide.com', 'REVISED for wine festival hours
September Services', 0, 'EmailSent', 'Pressure Washing x2 @175 (K Garage) | Corridor Cleaning x1 @630 | Janitorial:Janitorial Services x1 @50 (Tropical Smoothie Cleaning RR) | Porter x1 @332.4 (Holiday Pay Labor Day) | Porter x1 @252.4 (Wine Festival)', NULL, NULL, 'none'),
('418', 'Firelands Chevy', 'irregular', NULL, 2, 2, 0, '3502', '2026-06-01', 1315.38, '1315.38;2850.0', 1, 'Net 30', 'Mwerner@firelandsautogroup.com', 'Monthly Services 
REVISED June 
Replaced invoice #3455', 85.5, 'NotSet', 'Janitorial:Janitorial Services x1 @1315.38 (REVISED)', NULL, NULL, 'none'),
('661', 'Firelands Regional Medical Center', 'irregular', NULL, 1, 1, 0, '3489', '2026-06-22', 3000.0, '3000.0', 22, 'Net 30', 'rakosks@firelands.com', '907 Tiffin St., Fremont, Ohio', 0, 'EmailSent', 'Biohazard Services:Gross filth decontamination x1 @3000 (Cleaning of interior of trailer; pricing includes trash removal from premises. Mattress to be cleaned or disposed of based on clean ability.)', NULL, NULL, 'none'),
('141', 'Harvey & Abens Law', 'irregular', NULL, 2, 4, 0, '3602', '2026-07-27', 250.0, '250.0', 8, 'Net 30', 'hrobbins@harvlaw.com, mbabens@harvlaw.com', 'REVISED', 20.0, 'EmailSent', 'Janitorial:Janitorial Services x1 @125 | Janitorial:Janitorial Services x1 @125', 'a1bdb3f1-952d-433b-854b-fd0a23c8ab9f', 'Harvey + Abens Law', 'exact'),
('405', 'Independence Construction', 'irregular', NULL, 4, 21, 0, '3782', '2026-10-27', 11300.0, '352.5;1000.0;1300.0;1440.0;1550.5;4040.0;5367.5;5875.0;6460.0;6697.5;9040.0;9320.0;10117.5;11020.0;11300.0;17625.0', 12, 'Net 30', NULL, 'Valor Acres 
Bldg F floors 3, 4', 0, 'NotSet', 'Project Work:Final clean x1 @5650 (Bldg F, floor 3) | Project Work:Final clean x1 @5650 (Bldg F, floor 4)', NULL, NULL, 'none'),
('493', 'JTL Construction', 'irregular', NULL, 1, 1, 0, '3566', '2026-07-13', 3500.0, '3500.0', 13, 'Net 30', 'e.cheek@builtbyjtl.com', 'Horizon Science Academy
PO #26034-007', 0, 'EmailSent', 'Project Work:Floor Scrubbing x1 @3500 (Dusting of common space horizontal surfaces within reach as discussed on site. Padded walls to be dusted as well as millwork, hand rails, and cob webs up to 8 feet. Floor scrubbing throughout and mopping of edges in common space, old gym, and new gym)', NULL, NULL, 'none'),
('174', 'John G Johnson', 'irregular', NULL, 4, 5, 0, '3771', '2026-10-12', 240.0, '240.0;671.66;1200.0;1500.0;8174.94', 22, 'Net 30', 'johnnyrudin@johngjohnson.com', 'Truth for Life Library Addition', 16.2, 'NotSet', 'Project Work:Final clean x1 @240', NULL, NULL, 'none'),
('627', 'Midwest Facilities and Construction', 'irregular', NULL, 1, 1, 0, '3606', '2026-07-27', 4200.0, '4200.0', 27, 'Net 30', 'jim@midwestfc.com', 'Cleveland, OH | Story Cannabis', 336.0, 'EmailSent', 'Project Work:Final clean x1 @1750 (Pricing includes 1 full final clean of interior build out of Story Cannabis. Pricing includes full clean out of interiors/exterior of all millwork, horizontal surfaces 8 ft and under dusted/damp wiped, walls and door spot cleaned as needed, floors fully swept/mopped, interior/exterior glass cleaned (scraped and scrubbed as needed), interiors of restrooms full cleaned including toilets, sinks, mirrors, stainless finishes, and floors.) | Pressure Washing x1 @1800 (Parking lot) | Pressure Washing x1 @650 (Drive thru)', NULL, NULL, 'none'),
('490', 'Parke Brothers Construction LLC', 'irregular', NULL, 1, 1, 0, '3565', '2026-07-13', 2250.0, '2250.0', 13, 'Net 30', 'estimating@parkebrothers.com', 'Rewind in Broadview Heights', 180.0, 'EmailSent', 'Project Work:Final clean x1 @2250 (Full interior final cleaning of Rewind space. Stainless in kitchen to receive wash/dry with a dish soap, no polish.)', NULL, NULL, 'none'),
('133', 'Polen Implement', 'irregular', NULL, 1, 1, 0, '3396', '2026-05-01', 1730.0, '1730.0', 1, 'Net 30', 'brookeh@polenimplement.com', 'Current month services', 112.45, 'EmailSent', 'Janitorial:Janitorial Services x1 @1730', NULL, NULL, 'none'),
('669', 'RFC Contracting', 'irregular', NULL, 1, 1, 0, '3661', '2026-08-28', 8750.0, '8750.0', 28, 'Net 30', 'rnaymik@rfccontracting.com', 'PO# RN-SROA-012
Peninsula, OH | Storage Rentals of America', 590.63, 'EmailSent', 'Project Work:Final clean x1 @8750', NULL, NULL, 'none'),
('166', 'Ross Builders', 'irregular', NULL, 2, 2, 0, '3564', '2026-07-13', 1200.0, '1200.0;1675.0', 22, 'Net 30', NULL, 'Wakeman, Ohio | Mercy Health', 87.0, 'NotSet', 'Project Work:Touch Up Clean x1 @1200', NULL, NULL, 'none'),
('100000041', 'Serpentini Chevy Strongsville', 'irregular', NULL, 1, 1, 0, '3770', '2026-10-12', 4200.0, '4200.0', 12, 'Net 30', NULL, 'October Services', 336.0, 'NotSet', 'Janitorial:Janitorial Services x1 @4200', '108a866c-7983-49d3-8bab-3409f0ec442e', 'Serpentini Chevrolet of Strongsville', 'fuzzy 0.87'),
('644', 'Star Builders', 'irregular', NULL, 2, 2, 0, '3662', '2026-08-28', 1500.0, '1500.0;3200.0', 29, 'Net 30', 'greg@starinc.cc', 'Broadview Heights, OH | EDC Electric', 120.0, 'EmailSent', 'Project Work:Final clean x1 @1500', NULL, NULL, 'none');
