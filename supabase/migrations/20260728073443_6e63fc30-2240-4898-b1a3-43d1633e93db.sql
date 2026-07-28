
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'idle',
  current_menu TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_sessions_phone_idx ON public.whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS whatsapp_sessions_last_activity_idx ON public.whatsapp_sessions(last_activity);

GRANT ALL ON public.whatsapp_sessions TO service_role;

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: only service_role (used by edge functions) can access.

CREATE TRIGGER update_whatsapp_sessions_updated_at
  BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
