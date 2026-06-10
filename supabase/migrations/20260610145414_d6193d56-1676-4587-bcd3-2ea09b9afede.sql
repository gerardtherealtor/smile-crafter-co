
-- 1) Fix mutable search_path on SECURITY DEFINER functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 2) Revoke EXECUTE from anon/authenticated/PUBLIC on internal queue functions.
--    Edge functions use the service role, which retains EXECUTE.
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- 3) Storage policies: weekly-reports — admins only for DELETE/UPDATE
CREATE POLICY "Admins delete report files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'weekly-reports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update report files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'weekly-reports' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'weekly-reports' AND public.has_role(auth.uid(), 'admin'));

-- 4) Storage policies: support-screenshots — owner (first folder segment = uid) or admin
CREATE POLICY "Users or admins delete own support screenshots"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'support-screenshots'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Users or admins update own support screenshots"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'support-screenshots'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (
  bucket_id = 'support-screenshots'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);
