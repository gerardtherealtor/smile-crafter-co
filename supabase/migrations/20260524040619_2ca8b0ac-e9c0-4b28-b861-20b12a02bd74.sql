
-- Support tickets
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  user_name text,
  description text NOT NULL,
  function_area text,
  screenshot_path text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins manage tickets" ON public.support_tickets
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Private storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('support-screenshots', 'support-screenshots', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own support screenshots" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view own support screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'support-screenshots' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(),'admin'::app_role)));
