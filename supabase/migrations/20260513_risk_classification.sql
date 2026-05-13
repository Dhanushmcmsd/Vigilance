-- ============================================================
-- VIGILANCE MANAGEMENT SYSTEM — RISK CLASSIFICATION MIGRATION
-- Date: 2026-05-13
-- Adds:
--   * risk_classifications          (per checklist-item risk rules)
--   * escalation_tickets            (RED escalations + SLA tracking)
--   * supervisor_acknowledgements   (OTP-based RED acknowledgements)
--   * notification_log              (push/sms/email audit trail)
-- Extends:
--   * checklist_templates           (+ risk_level, statutory_act, trigger_on_no)
--   * user_roles                    (+ fcm_token)
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- EXTENSIONS (pgcrypto already enabled in base schema)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1) EXTEND EXISTING TABLES
-- ============================================================

-- checklist_templates: classification metadata
ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS risk_level    text,
  ADD COLUMN IF NOT EXISTS statutory_act text,
  ADD COLUMN IF NOT EXISTS trigger_on_no boolean DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'checklist_templates_risk_level_check'
      AND conrelid = 'public.checklist_templates'::regclass
  ) THEN
    ALTER TABLE public.checklist_templates
      ADD CONSTRAINT checklist_templates_risk_level_check
      CHECK (risk_level IS NULL OR risk_level IN ('RED','YELLOW','GREEN'));
  END IF;
END
$$;

COMMENT ON COLUMN public.checklist_templates.risk_level IS
  'Severity tier for this checklist item: RED (statutory/critical), YELLOW (operational), GREEN (informational).';
COMMENT ON COLUMN public.checklist_templates.statutory_act IS
  'Optional statutory act / regulation tied to this item (e.g. "Legal Metrology Act, 2009").';
COMMENT ON COLUMN public.checklist_templates.trigger_on_no IS
  'When true, a "No" response on this item triggers an escalation ticket.';

-- user_roles: device push token
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS fcm_token text;

COMMENT ON COLUMN public.user_roles.fcm_token IS
  'Firebase Cloud Messaging device token used to deliver push notifications to this user.';

-- ============================================================
-- 2) risk_classifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.risk_classifications (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id  uuid         NOT NULL UNIQUE
                                  REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  risk_level         text         NOT NULL CHECK (risk_level IN ('RED','YELLOW','GREEN')),
  trigger_on_no      boolean      NOT NULL DEFAULT false,
  statutory_act      text,
  legal_notes        text,
  requires_photo     boolean      NOT NULL DEFAULT false,
  min_remark_chars   int          NOT NULL DEFAULT 0,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.risk_classifications IS
  'Per-checklist-item risk rules driving UI prompts, photo/remark requirements and escalation triggers.';
COMMENT ON COLUMN public.risk_classifications.trigger_on_no IS
  'If true, a "No" response on this item creates an escalation_tickets row automatically.';
COMMENT ON COLUMN public.risk_classifications.requires_photo IS
  'If true, officer must attach at least one photo when responding "No".';
COMMENT ON COLUMN public.risk_classifications.min_remark_chars IS
  'Minimum length of remark text required when responding "No". 0 = no minimum.';

CREATE INDEX IF NOT EXISTS idx_risk_classifications_item_id
  ON public.risk_classifications(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_risk_classifications_level
  ON public.risk_classifications(risk_level);

DROP TRIGGER IF EXISTS trg_risk_classifications_updated_at ON public.risk_classifications;
CREATE TRIGGER trg_risk_classifications_updated_at
  BEFORE UPDATE ON public.risk_classifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.risk_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All auth users select risk_classifications" ON public.risk_classifications;
CREATE POLICY "All auth users select risk_classifications"
  ON public.risk_classifications
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin manage risk_classifications" ON public.risk_classifications;
CREATE POLICY "Admin manage risk_classifications"
  ON public.risk_classifications
  FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ============================================================
-- 3) escalation_tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.escalation_tickets (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id          uuid         NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  checklist_item_id      uuid         NOT NULL REFERENCES public.checklist_templates(id),
  risk_level             text         NOT NULL DEFAULT 'RED'
                                      CHECK (risk_level IN ('RED','YELLOW','GREEN')),
  status                 text         NOT NULL DEFAULT 'open'
                                      CHECK (status IN ('open','in_progress','closed')),
  assigned_to            uuid         REFERENCES public.user_roles(id),
  sla_deadline           timestamptz,
  reinspection_deadline  timestamptz,
  resolved_at            timestamptz,
  resolution_notes       text,
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.escalation_tickets IS
  'Tickets opened when a RED-flagged checklist item is violated. SLA is submitted_at + 24h; reinspection is submitted_at + 48h.';
COMMENT ON COLUMN public.escalation_tickets.sla_deadline IS
  'Deadline by which the assigned head/admin must respond. Auto-set from inspection.submitted_at + 24 hours.';
COMMENT ON COLUMN public.escalation_tickets.reinspection_deadline IS
  'Deadline by which a re-inspection must occur. Auto-set from inspection.submitted_at + 48 hours.';

CREATE INDEX IF NOT EXISTS idx_escalation_tickets_inspection_id
  ON public.escalation_tickets(inspection_id);
CREATE INDEX IF NOT EXISTS idx_escalation_tickets_status
  ON public.escalation_tickets(status);
CREATE INDEX IF NOT EXISTS idx_escalation_tickets_assigned_to
  ON public.escalation_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_escalation_tickets_sla_deadline
  ON public.escalation_tickets(sla_deadline);

-- Auto-compute SLA + reinspection deadlines from the parent inspection's submitted_at.
CREATE OR REPLACE FUNCTION public.set_escalation_deadlines()
RETURNS TRIGGER AS $$
DECLARE
  v_submitted_at timestamptz;
  v_base         timestamptz;
BEGIN
  SELECT submitted_at INTO v_submitted_at
  FROM public.inspections
  WHERE id = NEW.inspection_id;

  v_base := COALESCE(v_submitted_at, NEW.created_at, now());

  IF NEW.sla_deadline IS NULL THEN
    NEW.sla_deadline := v_base + interval '24 hours';
  END IF;

  IF NEW.reinspection_deadline IS NULL THEN
    NEW.reinspection_deadline := v_base + interval '48 hours';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_escalation_tickets_set_deadlines ON public.escalation_tickets;
CREATE TRIGGER trg_escalation_tickets_set_deadlines
  BEFORE INSERT ON public.escalation_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_escalation_deadlines();

DROP TRIGGER IF EXISTS trg_escalation_tickets_updated_at ON public.escalation_tickets;
CREATE TRIGGER trg_escalation_tickets_updated_at
  BEFORE UPDATE ON public.escalation_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.escalation_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Officers select own escalation_tickets" ON public.escalation_tickets;
CREATE POLICY "Officers select own escalation_tickets"
  ON public.escalation_tickets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND i.officer_id = public.current_user_roles_id()
    )
    OR public.current_user_role() IN ('head','management','admin')
  );

DROP POLICY IF EXISTS "Head manage escalation_tickets" ON public.escalation_tickets;
CREATE POLICY "Head manage escalation_tickets"
  ON public.escalation_tickets
  FOR ALL
  USING (public.current_user_role() IN ('head','admin'))
  WITH CHECK (public.current_user_role() IN ('head','admin'));

-- ============================================================
-- 4) supervisor_acknowledgements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supervisor_acknowledgements (
  id                  uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id       uuid           NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  checklist_item_id   uuid           NOT NULL REFERENCES public.checklist_templates(id),
  supervisor_id       uuid           NOT NULL REFERENCES public.user_roles(id),
  otp_hash            text           NOT NULL,
  otp_expires_at      timestamptz    NOT NULL,
  acknowledged_at     timestamptz,
  supervisor_lat      numeric(10,7),
  supervisor_lng      numeric(10,7),
  created_at          timestamptz    NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.supervisor_acknowledgements IS
  'On-site supervisor acknowledgements of RED findings, gated by a hashed OTP and (optionally) GPS coordinates.';
COMMENT ON COLUMN public.supervisor_acknowledgements.otp_hash IS
  'SHA-256/bcrypt hash of the OTP shown to the supervisor. Plaintext is never stored.';

CREATE INDEX IF NOT EXISTS idx_supervisor_ack_inspection_id
  ON public.supervisor_acknowledgements(inspection_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_ack_supervisor_id
  ON public.supervisor_acknowledgements(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_ack_expires_at
  ON public.supervisor_acknowledgements(otp_expires_at);

ALTER TABLE public.supervisor_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Officers select related supervisor_ack" ON public.supervisor_acknowledgements;
CREATE POLICY "Officers select related supervisor_ack"
  ON public.supervisor_acknowledgements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND i.officer_id = public.current_user_roles_id()
    )
    OR public.current_user_role() IN ('head','management','admin')
  );

DROP POLICY IF EXISTS "Officers insert supervisor_ack for own inspection" ON public.supervisor_acknowledgements;
CREATE POLICY "Officers insert supervisor_ack for own inspection"
  ON public.supervisor_acknowledgements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_id
        AND i.officer_id = public.current_user_roles_id()
    )
  );

DROP POLICY IF EXISTS "Supervisor update own ack" ON public.supervisor_acknowledgements;
CREATE POLICY "Supervisor update own ack"
  ON public.supervisor_acknowledgements
  FOR UPDATE
  USING (
    supervisor_id = public.current_user_roles_id()
    OR public.current_user_role() IN ('head','admin')
  );

DROP POLICY IF EXISTS "Admin full access supervisor_ack" ON public.supervisor_acknowledgements;
CREATE POLICY "Admin full access supervisor_ack"
  ON public.supervisor_acknowledgements
  FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ============================================================
-- 5) notification_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_log (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id   uuid          REFERENCES public.inspections(id) ON DELETE SET NULL,
  escalation_id   uuid          REFERENCES public.escalation_tickets(id) ON DELETE SET NULL,
  recipient_id    uuid          NOT NULL REFERENCES public.user_roles(id),
  channel         text          NOT NULL CHECK (channel IN ('push','sms','email')),
  template        text,
  status          text          NOT NULL CHECK (status IN ('sent','failed','pending')),
  sent_at         timestamptz,
  error_message   text,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_log IS
  'Audit trail of every push/SMS/email dispatched by the system (escalations, weekly reports, etc.).';
COMMENT ON COLUMN public.notification_log.template IS
  'Identifier of the message template used (e.g. "escalation_red_v1", "weekly_digest").';
COMMENT ON COLUMN public.notification_log.error_message IS
  'Populated when status = ''failed''. Plain-text error string from the upstream provider.';

CREATE INDEX IF NOT EXISTS idx_notification_log_recipient_id
  ON public.notification_log(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_inspection_id
  ON public.notification_log(inspection_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_escalation_id
  ON public.notification_log(escalation_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status
  ON public.notification_log(status);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients select own notification_log" ON public.notification_log;
CREATE POLICY "Recipients select own notification_log"
  ON public.notification_log
  FOR SELECT
  USING (
    recipient_id = public.current_user_roles_id()
    OR public.current_user_role() IN ('head','management','admin')
  );

DROP POLICY IF EXISTS "Admin manage notification_log" ON public.notification_log;
CREATE POLICY "Admin manage notification_log"
  ON public.notification_log
  FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ============================================================
-- 6) BACKFILL — sync risk_level onto checklist_templates from
--    risk_classifications when both rows exist. This is a no-op
--    on a fresh database and only relevant after seed data lands.
-- ============================================================
UPDATE public.checklist_templates ct
SET
  risk_level    = rc.risk_level,
  statutory_act = COALESCE(ct.statutory_act, rc.statutory_act),
  trigger_on_no = rc.trigger_on_no
FROM public.risk_classifications rc
WHERE rc.checklist_item_id = ct.id
  AND (ct.risk_level IS DISTINCT FROM rc.risk_level
       OR ct.trigger_on_no IS DISTINCT FROM rc.trigger_on_no);

-- ============================================================
-- END OF MIGRATION
-- ============================================================
