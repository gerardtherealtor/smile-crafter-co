
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any prior schedule if it exists
do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'dnc-weekly-report';
  if jid is not null then perform cron.unschedule(jid); end if;
end $$;

select cron.schedule(
  'dnc-weekly-report',
  '0 18 * * 5',  -- Friday 6:00 PM
  $$
  select net.http_post(
    url := 'https://quimvlbetsgwkjtkdcyi.supabase.co/functions/v1/send-weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1aW12bGJldHNnd2tqdGtkY3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODU2MjIsImV4cCI6MjA5MzA2MTYyMn0.nVEJcMOB4zE_OE9_mmzif4XwEuhX4CPY0MIyTv-tYhU'
    ),
    body := jsonb_build_object('source', 'cron')
  );
  $$
);
