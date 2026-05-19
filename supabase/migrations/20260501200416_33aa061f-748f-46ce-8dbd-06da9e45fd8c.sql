DO $$
DECLARE
  _user_id uuid;
  _existing_id uuid;
BEGIN
  -- Vérifier si l'utilisateur existe déjà
  SELECT id INTO _existing_id FROM auth.users WHERE email = 'avadaschool@itproserco.com' LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    _user_id := _existing_id;
    -- Mettre à jour le mot de passe et confirmer l'email
    UPDATE auth.users
    SET encrypted_password = crypt('Avadaschool2026@', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = _user_id;
  ELSE
    _user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      _user_id,
      'authenticated',
      'authenticated',
      'avadaschool@itproserco.com',
      crypt('Avadaschool2026@', gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', 'Avada School Admin', 'role', 'super_admin'),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Créer l'identité email associée
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      _user_id,
      _user_id::text,
      jsonb_build_object('sub', _user_id::text, 'email', 'avadaschool@itproserco.com', 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  -- Profil
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (_user_id, 'Avada School Admin', 'avadaschool@itproserco.com')
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
        email = EXCLUDED.email;

  -- Rôle super_admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Préférences de notifications
  INSERT INTO public.notification_preferences (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END $$;