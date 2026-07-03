-- Store-to-officer assignment columns and audit log

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS assigned_officer_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_officer_name text;

CREATE TABLE IF NOT EXISTS public.store_officer_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid REFERENCES public.branches(id),
  from_officer_id uuid REFERENCES auth.users(id),
  to_officer_id uuid REFERENCES auth.users(id),
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  notes text
);

ALTER TABLE public.store_officer_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin can manage assignments" ON public.store_officer_assignments
  FOR ALL USING (public.current_user_role() IN ('admin'));

CREATE POLICY "officers can view own assignments" ON public.store_officer_assignments
  FOR SELECT USING (to_officer_id = auth.uid() OR from_officer_id = auth.uid());
