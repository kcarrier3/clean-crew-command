CREATE TABLE IF NOT EXISTS public.user_tour_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tour_progress TO authenticated;
GRANT ALL ON public.user_tour_progress TO service_role;
ALTER TABLE public.user_tour_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own tour progress" ON public.user_tour_progress;
CREATE POLICY "Users manage their own tour progress" ON public.user_tour_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);