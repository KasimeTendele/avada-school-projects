DROP POLICY IF EXISTS "system insert receipts" ON public.receipts;

CREATE POLICY "scoped insert receipts" ON public.receipts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = receipts.payment_id
        AND (
          public.is_super_admin(auth.uid())
          OR public.admin_has_school(auth.uid(), p.school_id)
          OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (
            SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.primary_school_id = p.school_id
          ))
        )
    )
  );