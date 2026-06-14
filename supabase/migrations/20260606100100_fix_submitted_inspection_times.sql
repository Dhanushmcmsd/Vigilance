-- Ensure submitted inspections always retain usable time_in/time_out values.
-- This protects audit reports even if a client submits with a missing time field.

CREATE OR REPLACE FUNCTION public.ensure_inspection_times_on_submit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'submitted' THEN
    IF NEW.time_out IS NULL THEN
      NEW.time_out := COALESCE(
        (COALESCE(NEW.submitted_at, now()) AT TIME ZONE 'Asia/Kolkata')::time,
        (now() AT TIME ZONE 'Asia/Kolkata')::time
      );
    END IF;

    IF NEW.time_in IS NULL THEN
      NEW.time_in := COALESCE(
        (COALESCE(NEW.created_at, NEW.submitted_at, now()) AT TIME ZONE 'Asia/Kolkata')::time,
        NEW.time_out
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspections_ensure_times_on_submit ON public.inspections;
CREATE TRIGGER trg_inspections_ensure_times_on_submit
BEFORE INSERT OR UPDATE ON public.inspections
FOR EACH ROW
EXECUTE FUNCTION public.ensure_inspection_times_on_submit();

-- Backfill already-submitted records that missed one or both time fields.
UPDATE public.inspections
SET
  time_out = COALESCE(
    time_out,
    (COALESCE(submitted_at, created_at, now()) AT TIME ZONE 'Asia/Kolkata')::time
  ),
  time_in = COALESCE(
    time_in,
    (COALESCE(created_at, submitted_at, now()) AT TIME ZONE 'Asia/Kolkata')::time,
    time_out
  )
WHERE status = 'submitted'
  AND (time_in IS NULL OR time_out IS NULL);
