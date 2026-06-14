-- risk_classifications, supervisor_acknowledgements, notification_log + 31-item seed
-- Idempotent; mirrors MCP apply_migration runs.

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

CREATE INDEX IF NOT EXISTS idx_risk_classifications_item_id ON public.risk_classifications(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_risk_classifications_level ON public.risk_classifications(risk_level);

DROP TRIGGER IF EXISTS trg_risk_classifications_updated_at ON public.risk_classifications;
CREATE TRIGGER trg_risk_classifications_updated_at
  BEFORE UPDATE ON public.risk_classifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.risk_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All auth users select risk_classifications" ON public.risk_classifications;
CREATE POLICY "All auth users select risk_classifications"
  ON public.risk_classifications FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin manage risk_classifications" ON public.risk_classifications;
CREATE POLICY "Admin manage risk_classifications"
  ON public.risk_classifications FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

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

CREATE INDEX IF NOT EXISTS idx_supervisor_ack_inspection_id ON public.supervisor_acknowledgements(inspection_id);

ALTER TABLE public.supervisor_acknowledgements ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_notification_log_recipient_id ON public.notification_log(recipient_id);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

INSERT INTO public.risk_classifications (checklist_item_id, risk_level, trigger_on_no, min_remark_chars)
SELECT ct.id,
  CASE ct.item_order
    WHEN 1 THEN 'RED' WHEN 4 THEN 'RED' WHEN 5 THEN 'RED' WHEN 8 THEN 'RED' WHEN 9 THEN 'RED'
    WHEN 13 THEN 'RED' WHEN 14 THEN 'RED' WHEN 15 THEN 'RED' WHEN 20 THEN 'RED' WHEN 22 THEN 'RED'
    WHEN 24 THEN 'RED' WHEN 25 THEN 'RED' WHEN 26 THEN 'RED' WHEN 27 THEN 'RED' WHEN 29 THEN 'RED'
    WHEN 30 THEN 'RED' WHEN 31 THEN 'RED'
    WHEN 11 THEN 'GREEN' WHEN 17 THEN 'GREEN'
    ELSE 'YELLOW'
  END,
  CASE WHEN ct.item_order IN (2,3,6,7,8,10,11,16,17,19,22,24,25,30) THEN true ELSE false END,
  0
FROM public.checklist_templates ct
WHERE ct.is_active = true
ON CONFLICT (checklist_item_id) DO UPDATE SET
  risk_level = EXCLUDED.risk_level,
  trigger_on_no = EXCLUDED.trigger_on_no,
  min_remark_chars = 0;
