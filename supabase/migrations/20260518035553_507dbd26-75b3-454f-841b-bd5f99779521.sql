ALTER TABLE public.job_invoices
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';

-- Backfill: any pre-existing rows were "marked invoiced" in the old UI, so treat as archived.
UPDATE public.job_invoices SET status = 'archived' WHERE status = 'ready';

-- Change the default for new rows going forward.
ALTER TABLE public.job_invoices ALTER COLUMN status SET DEFAULT 'ready';

ALTER TABLE public.job_invoices
DROP CONSTRAINT IF EXISTS job_invoices_status_check;

ALTER TABLE public.job_invoices
ADD CONSTRAINT job_invoices_status_check CHECK (status IN ('ready','archived'));

CREATE INDEX IF NOT EXISTS idx_job_invoices_status ON public.job_invoices(status);