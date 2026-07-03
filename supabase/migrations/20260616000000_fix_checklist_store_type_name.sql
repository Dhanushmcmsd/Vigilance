-- Fix checklist scope migration to use the actual production branch type name.
-- branch_types uses "Ideal Store", not "Store".

UPDATE checklist_templates
SET branch_type_id = (
  SELECT id FROM branch_types WHERE type_name = 'Ideal Store' LIMIT 1
)
WHERE branch_type_id IS NULL
  AND deleted_at IS NULL;
