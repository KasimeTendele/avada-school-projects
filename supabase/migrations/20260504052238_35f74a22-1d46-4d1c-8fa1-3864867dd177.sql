-- Re-attach handle_new_user trigger so a profile + role + prefs are created on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles for existing auth users
INSERT INTO public.profiles (id, full_name, email, phone)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
       u.email,
       u.raw_user_meta_data->>'phone'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO public.notification_preferences (user_id)
SELECT u.id FROM auth.users u
LEFT JOIN public.notification_preferences np ON np.user_id = u.id
WHERE np.user_id IS NULL;

-- Backfill cashier school for the recently created cashier (any cashier without primary_school_id
-- whose creator-admin has exactly one school)
UPDATE public.profiles p
SET primary_school_id = (
  SELECT school_id FROM public.admin_schools
  WHERE user_id = 'ed85356d-7364-4752-b44e-3ef516567b00' LIMIT 1
)
WHERE p.id IN (SELECT user_id FROM public.user_roles WHERE role = 'cashier')
  AND p.primary_school_id IS NULL;