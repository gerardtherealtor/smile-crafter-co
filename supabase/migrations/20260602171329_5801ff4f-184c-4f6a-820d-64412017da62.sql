ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS work_category text,
  ADD COLUMN IF NOT EXISTS work_category_other text,
  ADD COLUMN IF NOT EXISTS work_quantity numeric;