
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Recreate the super admin auth user if missing
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'avadaschool@itproserco.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated', 'authenticated',
      'avadaschool@itproserco.com',
      crypt('Avadaschool2026@', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Super Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'avadaschool@itproserco.com', 'email_verified', true),
      'email', v_user_id::text, now(), now(), now());
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('Avadaschool2026@', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Ensure profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (v_user_id, 'Super Admin', 'avadaschool@itproserco.com')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Ensure super_admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin'::public.app_role)
  ON CONFLICT DO NOTHING;

  -- Ensure notification preferences
  INSERT INTO public.notification_preferences (user_id)
  VALUES (v_user_id)
  ON CONFLICT DO NOTHING;
END $$;
