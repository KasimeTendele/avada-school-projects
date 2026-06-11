
-- ============================================================
-- 1) Storage object policies: tighten student/staff/school/app-downloads
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "public read student-photos" ON storage.objects;
DROP POLICY IF EXISTS "public read staff-photos" ON storage.objects;
DROP POLICY IF EXISTS "public read school-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read app-downloads" ON storage.objects;
DROP POLICY IF EXISTS "auth write student-photos" ON storage.objects;
DROP POLICY IF EXISTS "auth update student-photos" ON storage.objects;
DROP POLICY IF EXISTS "auth delete student-photos" ON storage.objects;
DROP POLICY IF EXISTS "auth write staff-photos" ON storage.objects;
DROP POLICY IF EXISTS "auth update staff-photos" ON storage.objects;
DROP POLICY IF EXISTS "auth delete staff-photos" ON storage.objects;
DROP POLICY IF EXISTS "auth write school-assets" ON storage.objects;
DROP POLICY IF EXISTS "auth update school-assets" ON storage.objects;
DROP POLICY IF EXISTS "auth delete school-assets" ON storage.objects;

-- student-photos: private. Read = super_admin OR admin/cashier of any school OR parent linked to a student whose photo_url contains this object name.
CREATE POLICY "student-photos read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cashier'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.parent_students ps ON ps.student_id = s.id
      WHERE ps.parent_user_id = auth.uid()
        AND s.photo_url LIKE '%' || storage.objects.name
    )
  )
);

CREATE POLICY "student-photos write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cashier'::public.app_role)
  )
);

CREATE POLICY "student-photos update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (
    public.is_super_admin(auth.uid())
    OR (auth.uid())::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "student-photos delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (
    public.is_super_admin(auth.uid())
    OR (auth.uid())::text = (storage.foldername(name))[1]
  )
);

-- staff-photos: private. Read = super_admin / any admin / cashier (staff directory is internal).
CREATE POLICY "staff-photos read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'staff-photos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cashier'::public.app_role)
  )
);

CREATE POLICY "staff-photos write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'staff-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'cashier'::public.app_role)
  )
);

CREATE POLICY "staff-photos update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'staff-photos'
  AND (
    public.is_super_admin(auth.uid())
    OR (auth.uid())::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "staff-photos delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'staff-photos'
  AND (
    public.is_super_admin(auth.uid())
    OR (auth.uid())::text = (storage.foldername(name))[1]
  )
);

-- school-assets stays a public bucket so getPublicUrl keeps serving logos,
-- but we remove the broad SELECT-to-public policy that allowed listing/enumeration.
-- Public URL endpoint does not consult RLS, so logos still load.
-- Writes scoped to uploader uid.
CREATE POLICY "school-assets write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'school-assets'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "school-assets update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'school-assets'
  AND (
    public.is_super_admin(auth.uid())
    OR (auth.uid())::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "school-assets delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'school-assets'
  AND (
    public.is_super_admin(auth.uid())
    OR (auth.uid())::text = (storage.foldername(name))[1]
  )
);

-- app-downloads: private bucket, authenticated read only.
CREATE POLICY "app-downloads read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'app-downloads');

-- ============================================================
-- 2) SECURITY DEFINER functions: revoke broad EXECUTE
-- ============================================================

REVOKE ALL ON FUNCTION public.link_self_to_student(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_self_to_student(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.find_student_by_matricule(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_student_by_matricule(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.dispatch_fee_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_fee_reminders() TO service_role;

REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_has_school(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_has_school(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_parent_of_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_parent_of_student(uuid, uuid) TO authenticated, service_role;

-- ============================================================
-- 3) Realtime: enforce topic-level RLS on realtime.messages
-- ============================================================

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated may receive own-topic messages" ON realtime.messages;
CREATE POLICY "Authenticated may receive own-topic messages"
ON realtime.messages FOR SELECT TO authenticated
USING (
  (realtime.topic() = 'user:' || auth.uid()::text)
  OR (realtime.topic() LIKE 'public:%')
);

DROP POLICY IF EXISTS "Authenticated may publish to own topic" ON realtime.messages;
CREATE POLICY "Authenticated may publish to own topic"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (realtime.topic() = 'user:' || auth.uid()::text);
