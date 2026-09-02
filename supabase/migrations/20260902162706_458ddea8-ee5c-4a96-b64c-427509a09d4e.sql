ALTER TABLE public.calendar_drafts ADD COLUMN IF NOT EXISTS series_id uuid;
CREATE INDEX IF NOT EXISTS calendar_drafts_series_id_idx ON public.calendar_drafts (series_id);