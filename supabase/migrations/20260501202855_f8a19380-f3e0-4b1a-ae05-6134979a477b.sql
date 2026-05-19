
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS post_name text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS relationship text,
  ADD COLUMN IF NOT EXISTS physical_address text,
  ADD COLUMN IF NOT EXISTS professional_address text,
  ADD COLUMN IF NOT EXISTS employee_matricule text,
  ADD COLUMN IF NOT EXISTS function_title text,
  ADD COLUMN IF NOT EXISTS substitute jsonb;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS post_name text,
  ADD COLUMN IF NOT EXISTS birth_place text,
  ADD COLUMN IF NOT EXISTS physical_address text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS section_id uuid,
  ADD COLUMN IF NOT EXISTS option_id uuid;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS matricule text,
  ADD COLUMN IF NOT EXISTS management_type text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS director_first_name text,
  ADD COLUMN IF NOT EXISTS director_last_name text,
  ADD COLUMN IF NOT EXISTS director_post_name text,
  ADD COLUMN IF NOT EXISTS director_phone text,
  ADD COLUMN IF NOT EXISTS director_email text,
  ADD COLUMN IF NOT EXISTS director_photo_url text;

CREATE TABLE IF NOT EXISTS public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sections_school ON public.sections(school_id);
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scoped read sections" ON public.sections;
CREATE POLICY "scoped read sections" ON public.sections FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR admin_has_school(auth.uid(), school_id)
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = sections.school_id)
  OR EXISTS (
    SELECT 1 FROM public.parent_students ps
    JOIN public.students s ON s.id = ps.student_id
    WHERE ps.parent_user_id = auth.uid() AND s.school_id = sections.school_id
  )
);
DROP POLICY IF EXISTS "admin manage sections" ON public.sections;
CREATE POLICY "admin manage sections" ON public.sections FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR admin_has_school(auth.uid(), school_id))
WITH CHECK (is_super_admin(auth.uid()) OR admin_has_school(auth.uid(), school_id));

DROP TRIGGER IF EXISTS trg_sections_updated ON public.sections;
CREATE TRIGGER trg_sections_updated BEFORE UPDATE ON public.sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  school_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_options_section ON public.options(section_id);
CREATE INDEX IF NOT EXISTS idx_options_school ON public.options(school_id);
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scoped read options" ON public.options;
CREATE POLICY "scoped read options" ON public.options FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR admin_has_school(auth.uid(), school_id)
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = options.school_id)
  OR EXISTS (
    SELECT 1 FROM public.parent_students ps
    JOIN public.students s ON s.id = ps.student_id
    WHERE ps.parent_user_id = auth.uid() AND s.school_id = options.school_id
  )
);
DROP POLICY IF EXISTS "admin manage options" ON public.options;
CREATE POLICY "admin manage options" ON public.options FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR admin_has_school(auth.uid(), school_id))
WITH CHECK (is_super_admin(auth.uid()) OR admin_has_school(auth.uid(), school_id));

DROP TRIGGER IF EXISTS trg_options_updated ON public.options;
CREATE TRIGGER trg_options_updated BEFORE UPDATE ON public.options
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('school-assets', 'school-assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('staff-photos', 'staff-photos', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public read student-photos" ON storage.objects;
CREATE POLICY "public read student-photos" ON storage.objects FOR SELECT USING (bucket_id = 'student-photos');
DROP POLICY IF EXISTS "public read school-assets" ON storage.objects;
CREATE POLICY "public read school-assets" ON storage.objects FOR SELECT USING (bucket_id = 'school-assets');
DROP POLICY IF EXISTS "public read staff-photos" ON storage.objects;
CREATE POLICY "public read staff-photos" ON storage.objects FOR SELECT USING (bucket_id = 'staff-photos');

DROP POLICY IF EXISTS "auth write student-photos" ON storage.objects;
CREATE POLICY "auth write student-photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'student-photos' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'cashier'::app_role)));
DROP POLICY IF EXISTS "auth update student-photos" ON storage.objects;
CREATE POLICY "auth update student-photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'student-photos' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'cashier'::app_role)));
DROP POLICY IF EXISTS "auth delete student-photos" ON storage.objects;
CREATE POLICY "auth delete student-photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'student-photos' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)));

DROP POLICY IF EXISTS "auth write school-assets" ON storage.objects;
CREATE POLICY "auth write school-assets" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'school-assets' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)));
DROP POLICY IF EXISTS "auth update school-assets" ON storage.objects;
CREATE POLICY "auth update school-assets" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'school-assets' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)));
DROP POLICY IF EXISTS "auth delete school-assets" ON storage.objects;
CREATE POLICY "auth delete school-assets" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'school-assets' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)));

DROP POLICY IF EXISTS "auth write staff-photos" ON storage.objects;
CREATE POLICY "auth write staff-photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'staff-photos' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'cashier'::app_role)));
DROP POLICY IF EXISTS "auth update staff-photos" ON storage.objects;
CREATE POLICY "auth update staff-photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'staff-photos' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'cashier'::app_role)));
DROP POLICY IF EXISTS "auth delete staff-photos" ON storage.objects;
CREATE POLICY "auth delete staff-photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'staff-photos' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)));
