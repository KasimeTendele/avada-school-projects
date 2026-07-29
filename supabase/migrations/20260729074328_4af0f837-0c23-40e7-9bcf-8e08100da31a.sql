CREATE TABLE public.whatsapp_users (
  phone_number TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  first_connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_whatsapp_users_user_id ON public.whatsapp_users(user_id);
GRANT ALL ON public.whatsapp_users TO service_role;
ALTER TABLE public.whatsapp_users ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_whatsapp_users_updated_at
  BEFORE UPDATE ON public.whatsapp_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();