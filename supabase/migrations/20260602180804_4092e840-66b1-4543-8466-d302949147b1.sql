ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET is_test = true
WHERE id IN (
  'c53249c1-f35d-478c-b95c-721535f4aa1c', -- GREGORY CROUSE
  '724d7bb6-3e29-43e2-a9f3-c536ea2b3d55', -- Demo Admin
  '17ac567e-1509-419f-8aa5-4ea021bcbb88'  -- Jose Sanchez
);