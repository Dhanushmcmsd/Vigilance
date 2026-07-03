CREATE TABLE IF NOT EXISTS public.officer_leave_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  officer_id uuid REFERENCES auth.users(id),
  officer_name text,
  leave_date date NOT NULL,
  leave_type text DEFAULT 'absent',
  marked_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.officer_leave_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full access officer_leave_log" ON public.officer_leave_log
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "management read officer_leave_log" ON public.officer_leave_log
  FOR SELECT USING (public.current_user_role() IN ('management', 'admin'));
