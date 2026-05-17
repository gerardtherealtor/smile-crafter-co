-- Track which (job, week) groupings have been invoiced
CREATE TABLE public.job_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  invoiced_at timestamptz NOT NULL DEFAULT now(),
  invoiced_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, week_start)
);

ALTER TABLE public.job_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage job invoices"
  ON public.job_invoices
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_job_invoices_updated_at
  BEFORE UPDATE ON public.job_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_job_invoices_week ON public.job_invoices(week_start);
CREATE INDEX idx_job_invoices_job ON public.job_invoices(job_id);