CREATE TABLE public.roster (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  linked_profile_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage roster"
ON public.roster
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins view roster"
ON public.roster
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER set_roster_updated_at
BEFORE UPDATE ON public.roster
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.roster (full_name) VALUES
  ('Balthrop, Robert'),
  ('Clayton, Ian'),
  ('Cook, Cody'),
  ('Dow, Gerard'),
  ('Hinderberger, Mark'),
  ('House, Jesse'),
  ('Hughes, John'),
  ('Kisac, Jae'),
  ('Knight, Christopher'),
  ('Lee, John'),
  ('Mathews, Lucas'),
  ('Nicholson, Mackenzie'),
  ('Noe, Jerry (Dwayne)'),
  ('Noe, Jessica'),
  ('Weaver, Tristin'),
  ('Wehring, Jimmy');