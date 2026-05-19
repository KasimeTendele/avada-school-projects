CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'parent'))
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$
DECLARE
  target_user_id uuid;
  target_school_id uuid;
BEGIN
  SELECT id, primary_school_id
  INTO target_user_id, target_school_id
  FROM public.profiles
  WHERE lower(email) = lower('avadaschoo@itproserco.com')
  LIMIT 1;

  IF target_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = target_user_id
      AND role <> 'admin'::public.app_role;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;

    IF target_school_id IS NULL THEN
      SELECT school_id INTO target_school_id
      FROM public.admin_schools
      WHERE user_id = target_user_id
      LIMIT 1;
    END IF;

    IF target_school_id IS NULL THEN
      SELECT id INTO target_school_id
      FROM public.schools
      ORDER BY created_at ASC NULLS LAST
      LIMIT 1;

      UPDATE public.profiles
      SET primary_school_id = target_school_id
      WHERE id = target_user_id;
    END IF;

    IF target_school_id IS NOT NULL THEN
      INSERT INTO public.admin_schools (user_id, school_id)
      VALUES (target_user_id, target_school_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;