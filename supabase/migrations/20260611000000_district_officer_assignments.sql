-- District officer assignment system
CREATE TABLE IF NOT EXISTS public.district_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district            text NOT NULL,
  officer_id          uuid REFERENCES public.user_roles(id) ON DELETE SET NULL,
  is_primary          boolean NOT NULL DEFAULT true,
  is_on_leave         boolean NOT NULL DEFAULT false,
  assigned_at         timestamptz DEFAULT now(),
  assigned_by         uuid REFERENCES auth.users(id),
  notes               text,
  UNIQUE (district, officer_id)
);

ALTER TABLE public.district_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON public.district_assignments
  FOR ALL TO authenticated
  USING  ( (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin' )
  WITH CHECK ( (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin' );

CREATE POLICY "officer_read_own" ON public.district_assignments
  FOR SELECT TO authenticated
  USING ( officer_id = (SELECT id FROM public.user_roles WHERE user_id = auth.uid()) );

CREATE TABLE IF NOT EXISTS public.district_assignment_audit (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district            text NOT NULL,
  previous_officer_id uuid REFERENCES public.user_roles(id) ON DELETE SET NULL,
  new_officer_id      uuid REFERENCES public.user_roles(id) ON DELETE SET NULL,
  changed_by          uuid REFERENCES auth.users(id),
  changed_at          timestamptz DEFAULT now(),
  notes               text
);

ALTER TABLE public.district_assignment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_all" ON public.district_assignment_audit
  FOR ALL TO authenticated
  USING  ( (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin' )
  WITH CHECK ( (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin' );
