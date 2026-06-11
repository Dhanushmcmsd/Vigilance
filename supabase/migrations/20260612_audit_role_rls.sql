-- Additional read-only policies for audit role (SELECT only).

CREATE POLICY "audit_read_notifications" ON public.notifications
  FOR SELECT USING (auth.jwt() ->> 'role' = 'audit');

CREATE POLICY "audit_read_escalation_tickets" ON public.escalation_tickets
  FOR SELECT USING (auth.jwt() ->> 'role' = 'audit');

CREATE POLICY "audit_read_notification_log" ON public.notification_log
  FOR SELECT USING (auth.jwt() ->> 'role' = 'audit');

CREATE POLICY "audit_read_checklist_templates" ON public.checklist_templates
  FOR SELECT USING (auth.jwt() ->> 'role' = 'audit');

CREATE POLICY "audit_read_branches" ON public.branches
  FOR SELECT USING (auth.jwt() ->> 'role' = 'audit');

CREATE POLICY "audit_read_stores" ON public.stores
  FOR SELECT USING (auth.jwt() ->> 'role' = 'audit');
