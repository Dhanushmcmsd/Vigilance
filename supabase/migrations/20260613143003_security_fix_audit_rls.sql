-- SECURITY: Fix audit RLS policies to use current_user_role() instead of JWT claims.

DROP POLICY IF EXISTS "audit_read_notifications" ON public.notifications;
DROP POLICY IF EXISTS "audit_read_escalation_tickets" ON public.escalation_tickets;
DROP POLICY IF EXISTS "audit_read_notification_log" ON public.notification_log;
DROP POLICY IF EXISTS "audit_read_checklist_templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "audit_read_branches" ON public.branches;
DROP POLICY IF EXISTS "audit_read_stores" ON public.stores;

CREATE POLICY "audit_read_notifications" ON public.notifications
  FOR SELECT USING (public.current_user_role() = 'audit');

CREATE POLICY "audit_read_escalation_tickets" ON public.escalation_tickets
  FOR SELECT USING (public.current_user_role() = 'audit');

CREATE POLICY "audit_read_notification_log" ON public.notification_log
  FOR SELECT USING (public.current_user_role() = 'audit');

CREATE POLICY "audit_read_checklist_templates" ON public.checklist_templates
  FOR SELECT USING (public.current_user_role() = 'audit');

CREATE POLICY "audit_read_branches" ON public.branches
  FOR SELECT USING (public.current_user_role() = 'audit');

CREATE POLICY "audit_read_stores" ON public.stores
  FOR SELECT USING (public.current_user_role() = 'audit');
