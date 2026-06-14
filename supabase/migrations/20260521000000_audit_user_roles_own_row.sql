-- Ensure audit users can always read their own user_roles row (role bootstrap).
DROP POLICY IF EXISTS "Officers select own row" ON public.user_roles;
CREATE POLICY "Officers select own row" ON public.user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.current_user_role() IN ('head', 'management', 'admin', 'audit')
  );
