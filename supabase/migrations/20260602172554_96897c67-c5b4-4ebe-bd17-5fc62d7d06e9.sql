CREATE TABLE public.work_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_categories TO authenticated;
GRANT ALL ON public.work_categories TO service_role;

ALTER TABLE public.work_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view categories"
  ON public.work_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage categories"
  ON public.work_categories FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER work_categories_updated_at
  BEFORE UPDATE ON public.work_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.work_categories (name, sort_order) VALUES
  ('Scrape lot', 10),
  ('Cut out for house foundation', 20),
  ('Scrape footers', 30),
  ('Back fill foundation', 40),
  ('Dig and install positive and foundation drains', 50),
  ('Dig water', 60),
  ('Dig sewer', 70),
  ('Dig electrical', 80),
  ('Backfill utilities', 90),
  ('Cutout the concrete', 100),
  ('Load and haul off spoils', 110),
  ('Haul infill dirt', 120),
  ('Rough grade yard', 130),
  ('Haul topsoil', 140),
  ('Final grade', 150),
  ('Install culverts and driveway', 160),
  ('Install sleeves in driveway and sidewalk', 170),
  ('Deliver rock for foundation', 180),
  ('Deliver rock for driveway', 190),
  ('Deliver rock for utilities', 200),
  ('Hammer rock', 210),
  ('3/4 Gravel', 220),
  ('Crush and Run', 230),
  ('Compactible Fill', 240),
  ('Rip Rap Gravel', 250);