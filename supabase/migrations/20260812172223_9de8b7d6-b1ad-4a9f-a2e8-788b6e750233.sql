ALTER TABLE public.crm_pipeline_stages ADD COLUMN IF NOT EXISTS pipeline text NOT NULL DEFAULT 'project';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS pipeline text NOT NULL DEFAULT 'project';
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS pipeline text NOT NULL DEFAULT 'project';

UPDATE public.crm_pipeline_stages SET pipeline = 'project';

UPDATE public.crm_pipeline_stages SET sort_order = 20 WHERE name = 'Pre-Qualification';
UPDATE public.crm_pipeline_stages SET sort_order = 30 WHERE name = 'Analysis';
UPDATE public.crm_pipeline_stages SET sort_order = 40 WHERE name = 'Proposal';
UPDATE public.crm_pipeline_stages SET sort_order = 50 WHERE name = 'Award Status';
UPDATE public.crm_pipeline_stages SET sort_order = 70, is_won = true WHERE name = 'Scheduling';
UPDATE public.crm_pipeline_stages SET sort_order = 80, is_won = true WHERE name = 'Billing';
UPDATE public.crm_pipeline_stages SET sort_order = 90, is_won = true WHERE name = 'Paid';
UPDATE public.crm_pipeline_stages SET sort_order = 100, name = 'Closed Lost' WHERE is_lost = true;

INSERT INTO public.crm_pipeline_stages (name, sort_order, color, is_won, is_lost, active, pipeline)
SELECT 'Won', 60, '#22c55e', true, false, true, 'project'
WHERE NOT EXISTS (SELECT 1 FROM public.crm_pipeline_stages WHERE name = 'Won' AND pipeline = 'project');

INSERT INTO public.crm_pipeline_stages (name, sort_order, color, is_won, is_lost, active, pipeline) VALUES
  ('Lead', 10, '#94a3b8', false, false, true, 'janitorial'),
  ('Site Visit', 20, '#60a5fa', false, false, true, 'janitorial'),
  ('Proposal', 30, '#fbbf24', false, false, true, 'janitorial'),
  ('Negotiation', 40, '#fb923c', false, false, true, 'janitorial'),
  ('Won', 50, '#22c55e', true, false, true, 'janitorial'),
  ('Closed Lost', 60, '#ef4444', false, true, true, 'janitorial');