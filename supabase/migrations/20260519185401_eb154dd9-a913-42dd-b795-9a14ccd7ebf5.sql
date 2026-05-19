ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.fees REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;