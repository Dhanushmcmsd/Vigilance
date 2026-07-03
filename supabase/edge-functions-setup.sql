-- ═══════════════════════════════════════════════════════════════
-- DATABASE WEBHOOK for on-inspection-submit Edge Function
-- ═══════════════════════════════════════════════════════════════
-- Run in Supabase SQL Editor after deploying the edge function.
-- Replace YOUR_PROJECT_REF with your actual Supabase project ref.

-- Step 1: Enable the pg_net extension (needed for webhooks via SQL)
-- This is usually already enabled in Supabase.
-- create extension if not exists pg_net;

-- Step 2: Create the webhook trigger function
create or replace function notify_on_inspection_submit()
returns trigger language plpgsql as $$
begin
  if (NEW.status = 'submitted' and (OLD is null or OLD.status != 'submitted')) then
    perform net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/on-inspection-submit',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  end if;
  return NEW;
end;
$$;

-- Step 3: Attach trigger to inspections table
drop trigger if exists on_inspection_submit_trigger on inspections;
create trigger on_inspection_submit_trigger
after insert or update on inspections
for each row execute function notify_on_inspection_submit();


-- ═══════════════════════════════════════════════════════════════
-- pg_cron setup for weekly-report (every Monday 8AM IST = 2:30 UTC)
-- ═══════════════════════════════════════════════════════════════
-- Step 1: Enable pg_cron extension (do this in Supabase dashboard:
-- Database > Extensions > pg_cron)

-- Step 2: Schedule the weekly report
select cron.schedule(
  'weekly-vigilance-report',
  '30 2 * * 1',  -- every Monday at 02:30 UTC = 08:00 IST
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To view scheduled jobs:
-- select * from cron.job;

-- To unschedule:
-- select cron.unschedule('weekly-vigilance-report');
