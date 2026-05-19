-- Add missing trigger so new auth users get a profile + 'parent' role
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users that have no profile / no role
INSERT INTO public.profiles (id, full_name, email, phone)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
       u.email,
       u.raw_user_meta_data->>'phone'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, COALESCE((u.raw_user_meta_data->>'role')::public.app_role, 'parent')
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.notification_preferences (user_id)
SELECT u.id FROM auth.users u
LEFT JOIN public.notification_preferences np ON np.user_id = u.id
WHERE np.user_id IS NULL
ON CONFLICT DO NOTHING;