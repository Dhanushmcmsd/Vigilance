-- Per-item evidence, inverse-question scoring (trigger_on_no), optional remarks
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE).

-- ── Helper: compliant answer depends on question polarity ─────────────────
CREATE OR REPLACE FUNCTION public.is_response_compliant(
  p_response text,
  p_trigger_on_no boolean
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_response IS NULL OR p_response = 'N/A' THEN NULL
    WHEN p_response = 'Bad' THEN FALSE
    WHEN p_response IN ('Good', 'Moderate') THEN TRUE
    WHEN p_trigger_on_no THEN p_response = 'Yes'
    ELSE p_response = 'No'
  END;
$$;

COMMENT ON FUNCTION public.is_response_compliant IS
  'Returns true when the Yes/No answer is the compliant outcome. trigger_on_no=true means No is a violation; false means Yes is a violation.';

-- ── inspection_files: link evidence to a checklist item ───────────────────
ALTER TABLE public.inspection_files
  ADD COLUMN IF NOT EXISTS checklist_item_id uuid
  REFERENCES public.checklist_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.inspection_files.checklist_item_id IS
  'When set, this file is evidence for a specific checklist question (shown inline in audit reports).';

CREATE INDEX IF NOT EXISTS idx_inspection_files_checklist_item_id
  ON public.inspection_files(checklist_item_id)
  WHERE checklist_item_id IS NOT NULL;

-- ── Question polarity by item_order (matches schema.sql seed, orders 1–31) ─
-- YES = violation (problem observed): trigger_on_no = false
UPDATE public.checklist_templates
SET trigger_on_no = false
WHERE item_order IN (1, 4, 5, 9, 12, 13, 14, 15, 18, 20, 21, 23, 26, 27, 28, 29, 31);

-- NO = violation (requirement not met): trigger_on_no = true
UPDATE public.checklist_templates
SET trigger_on_no = true
WHERE item_order IN (2, 3, 6, 7, 8, 10, 11, 16, 17, 19, 22, 24, 25, 30);

UPDATE public.risk_classifications rc
SET trigger_on_no = ct.trigger_on_no
FROM public.checklist_templates ct
WHERE rc.checklist_item_id = ct.id
  AND rc.trigger_on_no IS DISTINCT FROM ct.trigger_on_no;

-- Remarks are optional; photos carry evidence instead of long text gates
UPDATE public.risk_classifications
SET min_remark_chars = 0
WHERE min_remark_chars > 0;

-- ── Compliance score respects trigger_on_no per item ──────────────────────
CREATE OR REPLACE FUNCTION public.calculate_compliance_score()
RETURNS TRIGGER AS $$
DECLARE
  v_compliant_count int;
  v_total_count     int;
  v_score           numeric(5,2);
  v_risk            text;
BEGIN
  SELECT
    COUNT(*) FILTER (
      WHERE public.is_response_compliant(
        ir.response,
        COALESCE(rc.trigger_on_no, ct.trigger_on_no, true)
      ) IS TRUE
    ),
    COUNT(*) FILTER (WHERE ir.response IN ('Yes', 'No', 'Good', 'Moderate', 'Bad'))
  INTO v_compliant_count, v_total_count
  FROM public.inspection_responses ir
  JOIN public.checklist_templates ct ON ct.id = ir.checklist_item_id
  LEFT JOIN public.risk_classifications rc ON rc.checklist_item_id = ct.id
  WHERE ir.inspection_id = COALESCE(NEW.inspection_id, OLD.inspection_id);

  IF v_total_count > 0 THEN
    v_score := (v_compliant_count::numeric / v_total_count::numeric) * 100;
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
      risk_level       = v_risk
  WHERE id = COALESCE(NEW.inspection_id, OLD.inspection_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
