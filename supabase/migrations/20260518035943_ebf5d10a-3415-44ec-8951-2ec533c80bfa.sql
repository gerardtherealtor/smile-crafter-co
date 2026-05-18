ALTER TABLE public.job_invoices
  ADD COLUMN IF NOT EXISTS csv_exported_at timestamptz,
  ADD COLUMN IF NOT EXISTS csv_export_count integer NOT NULL DEFAULT 0;

-- Treat existing archived rows as already-exported once, so the safeguard
-- triggers if an admin restores them and tries to bill again.
UPDATE public.job_invoices
SET csv_export_count = 1,
    csv_exported_at = COALESCE(csv_exported_at, invoiced_at)
WHERE status = 'archived' AND csv_export_count = 0;