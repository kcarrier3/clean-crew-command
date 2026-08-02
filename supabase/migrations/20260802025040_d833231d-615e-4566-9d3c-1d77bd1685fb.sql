CREATE OR REPLACE FUNCTION public.compute_inspection_score(p_inspection_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total INTEGER;
  v_green INTEGER;
  v_yellow INTEGER;
  v_score NUMERIC;
  v_rating TEXT;
  v_allowed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM inspections i
    WHERE i.id = p_inspection_id
      AND (
        i.inspector_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.job_title = ANY (ARRAY['Owner','General Manager','Operations Manager','Area Manager','District Manager','Regional Manager'])
        )
      )
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to update this inspection';
  END IF;

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
    v_score := ROUND(((v_green * 100.0) + (v_yellow * 50.0)) / v_total, 2);
    v_rating := CASE
      WHEN v_score >= 80 THEN 'green'
      WHEN v_score >= 50 THEN 'yellow'
      ELSE 'red'
    END;
  END IF;

  UPDATE inspections
  SET overall_score = v_score,
      overall_rating = v_rating,
      updated_at = now()
  WHERE id = p_inspection_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.compute_inspection_score(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_inspection_score(uuid) TO authenticated, service_role;