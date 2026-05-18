
CREATE TABLE public.invoice_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  invoice_id uuid,
  job_id uuid,
  week_start date,
  week_end date,
  actor_id uuid,
  actor_email text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_audit_log_created_at ON public.invoice_audit_log (created_at DESC);
CREATE INDEX idx_invoice_audit_log_job_id ON public.invoice_audit_log (job_id);

ALTER TABLE public.invoice_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view invoice audit log"
ON public.invoice_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert invoice audit log"
ON public.invoice_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND actor_id = auth.uid()
);
