-- 1. Fonction sécurisée : recherche d'un élève par matricule (accessible aux parents)
CREATE OR REPLACE FUNCTION public.find_student_by_matricule(
  _school_id uuid,
  _matricule text
)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  matricule text,
  class_name text,
  class_level text,
  academic_year text,
  school_name text,
  already_linked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tout utilisateur authentifié peut chercher (résultat limité à un élève précis par matricule)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.first_name,
    s.last_name,
    s.matricule,
    c.name AS class_name,
    c.level AS class_level,
    c.academic_year,
    sch.name AS school_name,
    EXISTS (
      SELECT 1 FROM public.parent_students ps
      WHERE ps.student_id = s.id AND ps.parent_user_id = auth.uid()
    ) AS already_linked
  FROM public.students s
  JOIN public.schools sch ON sch.id = s.school_id
  LEFT JOIN public.classes c ON c.id = s.class_id
  WHERE s.school_id = _school_id
    AND lower(trim(s.matricule)) = lower(trim(_matricule))
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.find_student_by_matricule(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_student_by_matricule(uuid, text) TO authenticated;

-- 2. Fonction sécurisée : lier le parent connecté à un élève trouvé
CREATE OR REPLACE FUNCTION public.link_self_to_student(
  _student_id uuid,
  _relationship text DEFAULT 'parent'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link_id uuid;
  _exists boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.has_role(auth.uid(), 'parent'::app_role) THEN
    RAISE EXCEPTION 'Only parents can link to students';
  END IF;

  -- Vérifier que l'élève existe
  SELECT EXISTS (SELECT 1 FROM public.students WHERE id = _student_id) INTO _exists;
  IF NOT _exists THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  -- Insérer ou récupérer le lien existant
  INSERT INTO public.parent_students (parent_user_id, student_id, relationship)
  VALUES (auth.uid(), _student_id, COALESCE(NULLIF(trim(_relationship), ''), 'parent'))
  ON CONFLICT DO NOTHING
  RETURNING id INTO _link_id;

  IF _link_id IS NULL THEN
    SELECT id INTO _link_id
    FROM public.parent_students
    WHERE parent_user_id = auth.uid() AND student_id = _student_id
    LIMIT 1;
  END IF;

  RETURN _link_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_self_to_student(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_self_to_student(uuid, text) TO authenticated;

-- 3. Contrainte d'unicité pour parent_students (pour le ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parent_students_unique_link'
  ) THEN
    ALTER TABLE public.parent_students
    ADD CONSTRAINT parent_students_unique_link UNIQUE (parent_user_id, student_id);
  END IF;
END $$;

-- 4. Index pour accélérer la recherche par matricule
CREATE INDEX IF NOT EXISTS idx_students_school_matricule
  ON public.students (school_id, lower(trim(matricule)));

-- 5. Policy : admin école / cashier peut INSÉRER un profil pour un nouveau compte créé pour son école
-- (le profil est normalement créé par le trigger handle_new_user, mais on autorise aussi l'admin
-- école à corriger primary_school_id pour les parents/caissiers de son école)
DROP POLICY IF EXISTS "school admin updates scoped profiles" ON public.profiles;
CREATE POLICY "school admin updates scoped profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    primary_school_id IS NOT NULL
    AND admin_has_school(auth.uid(), primary_school_id)
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    primary_school_id IS NOT NULL
    AND admin_has_school(auth.uid(), primary_school_id)
  )
);

-- 6. Policy : admin école peut LIRE les profils des utilisateurs de son école
DROP POLICY IF EXISTS "school admin reads scoped profiles" ON public.profiles;
CREATE POLICY "school admin reads scoped profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  primary_school_id IS NOT NULL
  AND admin_has_school(auth.uid(), primary_school_id)
);

-- 7. Policy : admin école peut attribuer rôles 'parent' et 'cashier' (pas admin/super_admin)
DROP POLICY IF EXISTS "school admin assigns scoped roles" ON public.user_roles;
CREATE POLICY "school admin assigns scoped roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    role IN ('parent'::app_role, 'cashier'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.primary_school_id IS NOT NULL
        AND admin_has_school(auth.uid(), p.primary_school_id)
    )
  )
);

-- 8. Policy : admin école peut lire les rôles des utilisateurs de son école
DROP POLICY IF EXISTS "school admin reads scoped roles" ON public.user_roles;
CREATE POLICY "school admin reads scoped roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.primary_school_id IS NOT NULL
      AND admin_has_school(auth.uid(), p.primary_school_id)
  )
);