-- Migrate legacy "Common" checklist items (branch_type_id IS NULL) to Store scope.
-- Admin UI no longer supports a separate Common checklist; all items belong to Store.

UPDATE checklist_templates
SET branch_type_id = (
  SELECT id FROM branch_types WHERE type_name = 'Store' LIMIT 1
)
WHERE branch_type_id IS NULL
  AND deleted_at IS NULL;
