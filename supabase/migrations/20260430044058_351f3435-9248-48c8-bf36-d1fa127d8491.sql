-- 1) Attacher le trigger handle_new_user à auth.users (si manquant)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Backfill du compte admin école KASIME déjà créé
DO $$
DECLARE
  v_user uuid := '902a2aa2-3935-4cfb-b35d-1c9fe4a9838d';
  v_school uuid;
BEGIN
  -- Profil
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (v_user, 'KASIME TENDELE Mohamed', 'avadaschoo@itproserco.com', '0812796642')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, phone = EXCLUDED.phone;

  -- Préférences notifications
  INSERT INTO public.notification_preferences (user_id) VALUES (v_user)
  ON CONFLICT DO NOTHING;

  -- Rôle admin
  DELETE FROM public.user_roles WHERE user_id = v_user;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'admin');

  -- Affecter à la première école disponible (l'utilisateur pourra changer ensuite)
  SELECT id INTO v_school FROM public.schools ORDER BY created_at ASC LIMIT 1;
  IF v_school IS NOT NULL THEN
    UPDATE public.profiles SET primary_school_id = v_school WHERE id = v_user;
    INSERT INTO public.admin_schools (user_id, school_id)
    VALUES (v_user, v_school)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;