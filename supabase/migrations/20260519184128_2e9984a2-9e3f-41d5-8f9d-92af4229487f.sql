CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.dispatch_fee_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  WITH paid AS (
    SELECT fee_id, COALESCE(SUM(amount), 0) AS paid_total
    FROM public.payments
    WHERE status = 'COMPLETED'
    GROUP BY fee_id
  ),
  fee_remaining AS (
    SELECT f.id AS fee_id, f.label, f.amount, f.currency, f.scope,
           f.student_id, f.class_id, f.school_id,
           (f.amount - COALESCE(p.paid_total, 0)) AS remaining
    FROM public.fees f
    LEFT JOIN paid p ON p.fee_id = f.id
    WHERE (f.amount - COALESCE(p.paid_total, 0)) > 0
  ),
  fee_students AS (
    SELECT fr.fee_id, fr.label, fr.amount, fr.currency, fr.remaining, s.id AS student_id,
           (s.first_name || ' ' || s.last_name) AS student_name
    FROM fee_remaining fr
    JOIN public.students s
      ON (fr.scope = 'STUDENT' AND s.id = fr.student_id)
      OR (fr.scope = 'CLASS'   AND s.class_id = fr.class_id)
      OR (fr.scope = 'SCHOOL'  AND s.school_id = fr.school_id)
  ),
  targets AS (
    SELECT DISTINCT fs.fee_id, fs.student_id, fs.student_name, fs.label,
           fs.amount, fs.currency, fs.remaining, ps.parent_user_id
    FROM fee_students fs
    JOIN public.parent_students ps ON ps.student_id = fs.student_id
    JOIN public.notification_preferences np ON np.user_id = ps.parent_user_id
    WHERE np.reminders = true
  )
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT t.parent_user_id, 'FEE'::notification_type,
         'Rappel : ' || t.label,
         'Solde restant : ' || t.remaining || ' ' || t.currency || ' pour ' || t.student_name || '.',
         jsonb_build_object(
           'feeId', t.fee_id,
           'studentId', t.student_id,
           'studentName', t.student_name,
           'amount', t.remaining,
           'currency', t.currency,
           'label', t.label,
           'reminder', true
         )
  FROM targets t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = t.parent_user_id
      AND n.type = 'FEE'
      AND (n.data->>'feeId') = t.fee_id::text
      AND (n.data->>'studentId') = t.student_id::text
      AND (n.data->>'reminder') = 'true'
      AND n.created_at::date = CURRENT_DATE
  );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch_fee_reminders_daily') THEN
    PERFORM cron.unschedule('dispatch_fee_reminders_daily');
  END IF;
END $$;

SELECT cron.schedule(
  'dispatch_fee_reminders_daily',
  '0 7 * * *',
  $$ SELECT public.dispatch_fee_reminders(); $$
);