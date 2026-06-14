-- Policy acknowledgement columns for Supra Pacific / VMS internal legal rollout.
-- Safe, additive migration.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_privacy_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_policy_version text;

COMMENT ON COLUMN public.user_roles.accepted_terms_at IS
  'Timestamp when the user last accepted the published Terms of Use version.';
COMMENT ON COLUMN public.user_roles.accepted_privacy_at IS
  'Timestamp when the user last accepted the published Privacy Policy version.';
COMMENT ON COLUMN public.user_roles.accepted_policy_version IS
  'Semantic version string of policies accepted (e.g. 2026-05-29.1). Bump app constant to re-prompt.';

-- Extend bootstrap RPC to return policy version for PolicyGate.
DROP FUNCTION IF EXISTS public.get_my_user_role();

CREATE OR REPLACE FUNCTION public.get_my_user_role()
RETURNS TABLE (
  id uuid,
  role text,
  name text,
  accepted_policy_version text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.id, ur.role, ur.name, ur.accepted_policy_version
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.is_active = true
    AND ur.deleted_at IS NULL
  ORDER BY ur.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_user_role() TO authenticated;

-- Allow users to record acceptance on their own active row only.
CREATE OR REPLACE FUNCTION public.record_my_policy_acceptance(p_version text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_version IS NULL OR length(trim(p_version)) = 0 THEN
    RAISE EXCEPTION 'policy version required';
  END IF;

  UPDATE public.user_roles
  SET
    accepted_terms_at = now(),
    accepted_privacy_at = now(),
    accepted_policy_version = trim(p_version)
  WHERE user_id = auth.uid()
    AND is_active = true
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active user_roles row for current user';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_my_policy_acceptance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_my_policy_acceptance(text) TO authenticated;

COMMENT ON FUNCTION public.record_my_policy_acceptance IS
  'Records Terms/Privacy acknowledgement for the signed-in user. Called from web PolicyGate.';
