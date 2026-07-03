ALTER TABLE public.inspection_responses
  ADD COLUMN IF NOT EXISTS was_previously_at_risk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_this_inspection boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.calculate_compliance_score()
RETURNS TRIGGER AS $$
DECLARE
  v_weighted_compliant numeric;
  v_total_count     int;
  v_score           numeric(5,2);
  v_risk            text;
BEGIN
  SELECT
    COALESCE(SUM(
      CASE
        WHEN public.is_response_compliant(
          ir.response,
          COALESCE(rc.trigger_on_no, ct.trigger_on_no, true)
        ) IS TRUE THEN
          CASE
            WHEN ir.was_previously_at_risk AND ir.resolved_this_inspection THEN 1.1
            ELSE 1.0
          END
        ELSE 0
      END
    ), 0),
    COUNT(*) FILTER (WHERE ir.response IN ('Yes', 'No'))
  INTO v_weighted_compliant, v_total_count
  FROM public.inspection_responses ir
  JOIN public.checklist_templates ct ON ct.id = ir.checklist_item_id
  LEFT JOIN public.risk_classifications rc ON rc.checklist_item_id = ct.id
  WHERE ir.inspection_id = COALESCE(NEW.inspection_id, OLD.inspection_id);

  IF v_total_count > 0 THEN
    v_score := LEAST(100, (v_weighted_compliant / v_total_count::numeric) * 100);
  ELSE
    v_score := NULL;
  END IF;

  IF v_score IS NULL THEN
    v_risk := NULL;
  ELSIF v_score >= 80 THEN
    v_risk := 'low';
  ELSIF v_score >= 60 THEN
    v_risk := 'medium';
  ELSIF v_score >= 40 THEN
    v_risk := 'high';
  ELSE
    v_risk := 'critical';
  END IF;

  UPDATE public.inspections
  SET compliance_score = v_score,
      risk_level = v_risk
  WHERE id = COALESCE(NEW.inspection_id, OLD.inspection_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
