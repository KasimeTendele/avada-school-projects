DO $$
DECLARE
  v_caissier uuid := '1cf41332-1c6a-4295-b203-64fee74462a4';
  v_parent   uuid := 'f2400384-dc63-4806-92af-293fa63270b3';
  v_school   uuid;
  v_class    uuid;
  v_student1 uuid;
  v_student2 uuid;
BEGIN
  UPDATE auth.users SET email_confirmed_at = now() WHERE id IN (v_caissier, v_parent);

  INSERT INTO public.schools(name, city) VALUES ('École Démo AVADA', 'Kinshasa') RETURNING id INTO v_school;
  INSERT INTO public.classes(name, level, school_id, academic_year) VALUES ('6ème A','Primaire',v_school,'2025-2026') RETURNING id INTO v_class;

  DELETE FROM public.user_roles WHERE user_id = v_caissier;
  INSERT INTO public.user_roles(user_id, role) VALUES (v_caissier, 'cashier');
  UPDATE public.profiles SET primary_school_id = v_school WHERE id = v_caissier;

  INSERT INTO public.students(school_id, class_id, first_name, last_name, matricule)
    VALUES (v_school, v_class, 'Jean', 'Mbemba', 'MAT001') RETURNING id INTO v_student1;
  INSERT INTO public.students(school_id, class_id, first_name, last_name, matricule)
    VALUES (v_school, v_class, 'Marie', 'Kabasele', 'MAT002') RETURNING id INTO v_student2;

  INSERT INTO public.parent_students(parent_user_id, student_id, relationship)
    VALUES (v_parent, v_student1, 'pere'), (v_parent, v_student2, 'pere');

  INSERT INTO public.fees(school_id, scope, fee_type, label, amount, academic_year, class_id)
    VALUES (v_school, 'CLASS', 'minerval', 'Minerval 6ème A', 150000, '2025-2026', v_class);
  INSERT INTO public.fees(school_id, scope, fee_type, label, amount, academic_year, student_id)
    VALUES (v_school, 'STUDENT', 'transport', 'Transport Jean', 30000, '2025-2026', v_student1);
END $$;