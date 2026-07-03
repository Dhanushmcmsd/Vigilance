-- Add predefined option lists for checklist items (dropdown / radio choices).
-- Officers select from these instead of free-text Yes/No when options are set.

ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS options text[] DEFAULT NULL;

COMMENT ON COLUMN public.checklist_templates.options IS
  'Predefined answer choices for this item. When non-empty, officers must pick one of these values.';

-- Allow custom option values in inspection answers (not limited to Yes/No/N/A/Good/Moderate/Bad).
ALTER TABLE public.inspection_responses
  DROP CONSTRAINT IF EXISTS inspection_responses_response_check;

ALTER TABLE public.inspection_responses
  ADD CONSTRAINT inspection_responses_response_check
  CHECK (response IS NOT NULL AND char_length(trim(response)) > 0);
