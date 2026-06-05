-- ============================================================
-- Migration: QA Inspections Module
-- Creates: inspection_templates, inspection_template_items,
--          inspections, inspection_items, inspection_photos
-- ============================================================

-- -------------------------------------------------------
-- 1. Inspection Templates (reusable checklists per job site)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  job_site_id UUID REFERENCES job_sites(id) ON DELETE SET NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 2. Template Items (checklist items for a template)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES inspection_templates(id) ON DELETE CASCADE,
  category TEXT NOT NULL,          -- e.g. "Restrooms", "Common Areas"
  item_name TEXT NOT NULL,         -- e.g. "Toilets cleaned and sanitized"
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 3. Inspections (each completed inspection record)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id UUID NOT NULL REFERENCES job_sites(id) ON DELETE CASCADE,
  template_id UUID REFERENCES inspection_templates(id) ON DELETE SET NULL,
  inspector_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  overall_score NUMERIC(5,2),      -- percentage 0-100 computed from items
  overall_rating TEXT CHECK (overall_rating IN ('green', 'yellow', 'red')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 4. Inspection Items (scored checklist items per inspection)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES inspection_template_items(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  rating TEXT CHECK (rating IN ('green', 'yellow', 'red')),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 5. Inspection Photos (photos attached to an inspection)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  inspection_item_id UUID REFERENCES inspection_items(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  caption TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 6. RLS Policies
-- -------------------------------------------------------
ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;

-- Templates: authenticated users can read; managers/admins can write
CREATE POLICY "inspection_templates_read" ON inspection_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inspection_templates_write" ON inspection_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.job_title IN (
        'Owner','General Manager','Operations Manager','Area Manager',
        'District Manager','Regional Manager','Team Lead','Supervisor'
      )
    )
  );

-- Template items: same as templates
CREATE POLICY "inspection_template_items_read" ON inspection_template_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inspection_template_items_write" ON inspection_template_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.job_title IN (
        'Owner','General Manager','Operations Manager','Area Manager',
        'District Manager','Regional Manager','Team Lead','Supervisor'
      )
    )
  );

-- Inspections: managers/team leads can create; all authenticated can read
CREATE POLICY "inspections_read" ON inspections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inspections_write" ON inspections
  FOR ALL TO authenticated
  USING (
    inspector_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.job_title IN (
        'Owner','General Manager','Operations Manager','Area Manager',
        'District Manager','Regional Manager'
      )
    )
  );

-- Inspection items: same as inspections
CREATE POLICY "inspection_items_read" ON inspection_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inspection_items_write" ON inspection_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inspections i
      WHERE i.id = inspection_id
      AND (
        i.inspector_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.job_title IN (
            'Owner','General Manager','Operations Manager','Area Manager',
            'District Manager','Regional Manager'
          )
        )
      )
    )
  );

-- Inspection photos: same as inspection items
CREATE POLICY "inspection_photos_read" ON inspection_photos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inspection_photos_write" ON inspection_photos
  FOR ALL TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.job_title IN (
        'Owner','General Manager','Operations Manager','Area Manager',
        'District Manager','Regional Manager'
      )
    )
  );

-- -------------------------------------------------------
-- 7. Function: compute_inspection_score
--    Updates overall_score and overall_rating on an inspection
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_inspection_score(p_inspection_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_green INTEGER;
  v_yellow INTEGER;
  v_score NUMERIC;
  v_rating TEXT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE rating = 'green'),
    COUNT(*) FILTER (WHERE rating = 'yellow')
  INTO v_total, v_green, v_yellow
  FROM inspection_items
  WHERE inspection_id = p_inspection_id
    AND rating IS NOT NULL;

  IF v_total = 0 THEN
    v_score := NULL;
    v_rating := NULL;
  ELSE
    -- Score: green=100, yellow=50, red=0 per item
    v_score := ROUND(
      ((v_green * 100.0) + (v_yellow * 50.0)) / v_total,
      2
    );
    v_rating := CASE
      WHEN v_score >= 80 THEN 'green'
      WHEN v_score >= 50 THEN 'yellow'
      ELSE 'red'
    END;
  END IF;

  UPDATE inspections
  SET
    overall_score = v_score,
    overall_rating = v_rating,
    updated_at = now()
  WHERE id = p_inspection_id;
END;
$$;

-- -------------------------------------------------------
-- 8. Seed: Default inspection template
-- -------------------------------------------------------
DO $$
DECLARE
  v_template_id UUID;
BEGIN
  INSERT INTO inspection_templates (name, description, is_default)
  VALUES (
    'Standard Janitorial Inspection',
    'Default checklist for janitorial quality inspections',
    true
  )
  RETURNING id INTO v_template_id;

  -- Restrooms
  INSERT INTO inspection_template_items (template_id, category, item_name, sort_order) VALUES
    (v_template_id, 'Restrooms', 'Toilets cleaned and sanitized', 1),
    (v_template_id, 'Restrooms', 'Sinks and counters wiped down', 2),
    (v_template_id, 'Restrooms', 'Mirrors cleaned and streak-free', 3),
    (v_template_id, 'Restrooms', 'Floors mopped and dry', 4),
    (v_template_id, 'Restrooms', 'Trash emptied and liners replaced', 5),
    (v_template_id, 'Restrooms', 'Soap and paper products restocked', 6),
    (v_template_id, 'Restrooms', 'Odor-free and deodorized', 7);

  -- Common Areas
  INSERT INTO inspection_template_items (template_id, category, item_name, sort_order) VALUES
    (v_template_id, 'Common Areas', 'Floors vacuumed or swept', 10),
    (v_template_id, 'Common Areas', 'Hard floors mopped', 11),
    (v_template_id, 'Common Areas', 'Trash emptied and liners replaced', 12),
    (v_template_id, 'Common Areas', 'Surfaces dusted and wiped', 13),
    (v_template_id, 'Common Areas', 'Glass doors and windows cleaned', 14);

  -- Breakroom / Kitchen
  INSERT INTO inspection_template_items (template_id, category, item_name, sort_order) VALUES
    (v_template_id, 'Breakroom / Kitchen', 'Counters and tables wiped down', 20),
    (v_template_id, 'Breakroom / Kitchen', 'Sink cleaned and sanitized', 21),
    (v_template_id, 'Breakroom / Kitchen', 'Microwave interior cleaned', 22),
    (v_template_id, 'Breakroom / Kitchen', 'Trash emptied and liners replaced', 23),
    (v_template_id, 'Breakroom / Kitchen', 'Floor swept and mopped', 24);

  -- Offices
  INSERT INTO inspection_template_items (template_id, category, item_name, sort_order) VALUES
    (v_template_id, 'Offices', 'Desks and surfaces dusted', 30),
    (v_template_id, 'Offices', 'Floors vacuumed', 31),
    (v_template_id, 'Offices', 'Trash emptied', 32),
    (v_template_id, 'Offices', 'Fingerprints removed from glass/doors', 33);

  -- Entrance / Lobby
  INSERT INTO inspection_template_items (template_id, category, item_name, sort_order) VALUES
    (v_template_id, 'Entrance / Lobby', 'Entry mats clean and in place', 40),
    (v_template_id, 'Entrance / Lobby', 'Floors clean and presentable', 41),
    (v_template_id, 'Entrance / Lobby', 'Glass doors cleaned', 42),
    (v_template_id, 'Entrance / Lobby', 'Reception area tidy', 43);

  -- Overall / General
  INSERT INTO inspection_template_items (template_id, category, item_name, sort_order) VALUES
    (v_template_id, 'General', 'Supplies properly stored', 50),
    (v_template_id, 'General', 'Equipment clean and in good condition', 51),
    (v_template_id, 'General', 'No safety hazards observed', 52);
END;
$$;

-- -------------------------------------------------------
-- 9. Storage bucket for inspection photos (if not exists)
-- -------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload inspection photos
CREATE POLICY "inspection_photos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inspection-photos');

-- Allow authenticated users to read inspection photos
CREATE POLICY "inspection_photos_storage_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inspection-photos');

-- Allow users to delete their own inspection photos
CREATE POLICY "inspection_photos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'inspection-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
