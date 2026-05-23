ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS notes_en text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS name_en text;