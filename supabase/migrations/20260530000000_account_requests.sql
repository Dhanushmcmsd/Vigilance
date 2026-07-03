-- Account access requests (submitted from sign-in page; reviewed in Admin panel).
-- No email is sent — admins create users manually after approval.

CREATE TABLE IF NOT EXISTS public.account_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  designation text,
  branch_hint text,
  note text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.account_requests IS
  'Self-service access requests from the login page. Admins approve by creating a user in the Admin panel.';

CREATE INDEX IF NOT EXISTS idx_account_requests_status
  ON public.account_requests (status);

CREATE INDEX IF NOT EXISTS idx_account_requests_submitted_at
  ON public.account_requests (submitted_at DESC);

-- One pending request per email at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_requests_pending_email
  ON public.account_requests (lower(email))
  WHERE status = 'pending';

ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

-- Sign-in form: unauthenticated visitors may submit a pending request only.
CREATE POLICY account_requests_insert_public
  ON public.account_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

-- Staff review queue (admin + management).
CREATE POLICY account_requests_select_staff
  ON public.account_requests
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'management'));

CREATE POLICY account_requests_update_staff
  ON public.account_requests
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'management'))
  WITH CHECK (public.current_user_role() IN ('admin', 'management'));

-- No DELETE policy: history retained; admins may reject instead.

GRANT INSERT ON public.account_requests TO anon;
GRANT INSERT ON public.account_requests TO authenticated;
GRANT SELECT, UPDATE ON public.account_requests TO authenticated;
