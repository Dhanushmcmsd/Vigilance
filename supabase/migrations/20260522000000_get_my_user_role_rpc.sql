-- Bootstrap helper: returns the signed-in user's active role without RLS chicken-and-egg.
CREATE OR REPLACE FUNCTION public.get_my_user_role()
RETURNS TABLE (id uuid, role text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.id, ur.role, ur.name
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.is_active = true
    AND ur.deleted_at IS NULL
  ORDER BY ur.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_user_role() TO authenticated;

COMMENT ON FUNCTION public.get_my_user_role IS
  'Returns the current auth user active user_roles row. Used by mobile login to resolve officer/audit/etc.';
