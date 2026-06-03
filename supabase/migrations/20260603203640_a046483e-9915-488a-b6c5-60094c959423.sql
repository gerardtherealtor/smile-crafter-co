CREATE TABLE public.app_release_config (
  id uuid primary key default gen_random_uuid(),
  latest_version text not null,
  ios_update_url text not null,
  android_update_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT ON public.app_release_config TO anon, authenticated;
GRANT ALL ON public.app_release_config TO service_role;

ALTER TABLE public.app_release_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app release config"
  ON public.app_release_config
  FOR SELECT
  USING (true);

CREATE TRIGGER set_app_release_config_updated_at
  BEFORE UPDATE ON public.app_release_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_release_config (latest_version, ios_update_url, android_update_url)
VALUES (
  '1.0.2',
  'https://apps.apple.com/us/app/dwayne-noe-construction/id6766007870',
  'https://play.google.com/apps/internaltest/4701731122120433400'
);