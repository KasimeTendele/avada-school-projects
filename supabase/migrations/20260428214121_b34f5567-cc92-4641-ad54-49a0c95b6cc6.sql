-- 1) Add columns to schools
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS sigle text,
  ADD COLUMN IF NOT EXISTS epst_number text,
  ADD COLUMN IF NOT EXISTS regime text,
  ADD COLUMN IF NOT EXISTS levels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sections text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vacation text;

-- 2) user_activity table for last_login tracking
CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id uuid PRIMARY KEY,
  last_login_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user reads own activity" ON public.user_activity;
CREATE POLICY "user reads own activity"
ON public.user_activity FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "user upserts own activity" ON public.user_activity;
CREATE POLICY "user upserts own activity"
ON public.user_activity FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user updates own activity" ON public.user_activity;
CREATE POLICY "user updates own activity"
ON public.user_activity FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "super admin manages activity" ON public.user_activity;
CREATE POLICY "super admin manages activity"
ON public.user_activity FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));