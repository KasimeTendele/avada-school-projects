-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'cashier', 'parent');
CREATE TYPE public.school_status AS ENUM ('active', 'suspended', 'pending');
CREATE TYPE public.user_status AS ENUM ('active', 'suspended', 'pending');
CREATE TYPE public.fee_scope AS ENUM ('STUDENT', 'CLASS', 'SCHOOL');
CREATE TYPE public.payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE public.payment_method AS ENUM ('CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD');
CREATE TYPE public.notification_type AS ENUM ('PAYMENT', 'REMINDER', 'EVENT', 'SYSTEM');

-- ===== TIMESTAMP TRIGGER =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  primary_school_id UUID,
  status public.user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== USER ROLES =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

-- ===== SCHOOLS =====
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  address TEXT,
  approval_number TEXT,
  promoter_name TEXT,
  promoter_phone TEXT,
  status public.school_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== ADMIN <-> SCHOOLS =====
CREATE TABLE public.admin_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id)
);
ALTER TABLE public.admin_schools ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.admin_has_school(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_schools WHERE user_id = _user_id AND school_id = _school_id);
$$;

-- ===== CLASSES =====
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT,
  academic_year TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_classes_school ON public.classes(school_id);
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== STUDENTS =====
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  matricule TEXT,
  birth_date DATE,
  gender TEXT,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_students_school ON public.students(school_id);
CREATE INDEX idx_students_class ON public.students(class_id);
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== PARENT <-> STUDENTS =====
CREATE TABLE public.parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, student_id)
);
ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_parent_students_parent ON public.parent_students(parent_user_id);
CREATE INDEX idx_parent_students_student ON public.parent_students(student_id);

CREATE OR REPLACE FUNCTION public.is_parent_of_student(_user_id UUID, _student_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.parent_students WHERE parent_user_id = _user_id AND student_id = _student_id);
$$;

-- ===== FEES =====
CREATE TABLE public.fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  scope public.fee_scope NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'CDF',
  due_date DATE,
  academic_year TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fees_school ON public.fees(school_id);
CREATE INDEX idx_fees_student ON public.fees(student_id);
CREATE INDEX idx_fees_class ON public.fees(class_id);
CREATE TRIGGER trg_fees_updated BEFORE UPDATE ON public.fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== PAYMENTS =====
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id UUID NOT NULL REFERENCES public.fees(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'CDF',
  method public.payment_method NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'PENDING',
  reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_payments_school ON public.payments(school_id);
CREATE INDEX idx_payments_student ON public.payments(student_id);
CREATE INDEX idx_payments_fee ON public.payments(fee_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== RECEIPTS =====
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  pdf_url TEXT,
  receipt_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- ===== NOTIFICATIONS =====
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL DEFAULT 'SYSTEM',
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);

-- ===== NOTIFICATION PREFERENCES =====
CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payments BOOLEAN NOT NULL DEFAULT true,
  reminders BOOLEAN NOT NULL DEFAULT true,
  events BOOLEAN NOT NULL DEFAULT true,
  system BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_notif_prefs_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== PUSH TOKENS =====
CREATE TABLE public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_push_tokens_updated BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== AUTO-CREATE PROFILE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  );
  -- default role = parent (can be elevated by admin later)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'parent'))
  ON CONFLICT DO NOTHING;
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================================================
-- RLS POLICIES
-- ===========================================================================

-- profiles
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "super admin manages profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- user_roles
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- schools
CREATE POLICY "super admin reads all schools" ON public.schools FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = schools.id)
    OR EXISTS (SELECT 1 FROM public.parent_students ps JOIN public.students s ON s.id = ps.student_id WHERE ps.parent_user_id = auth.uid() AND s.school_id = schools.id)
  );
CREATE POLICY "super admin manages schools" ON public.schools FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- admin_schools
CREATE POLICY "user reads own admin links" ON public.admin_schools FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin manages admin links" ON public.admin_schools FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- classes
CREATE POLICY "scoped read classes" ON public.classes FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = classes.school_id AND public.has_role(auth.uid(), 'cashier'))
    OR EXISTS (SELECT 1 FROM public.parent_students ps JOIN public.students s ON s.id = ps.student_id WHERE ps.parent_user_id = auth.uid() AND s.class_id = classes.id)
  );
CREATE POLICY "admin/cashier manage classes" ON public.classes FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = classes.school_id))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = classes.school_id))
  );

-- students
CREATE POLICY "scoped read students" ON public.students FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = students.school_id))
    OR public.is_parent_of_student(auth.uid(), id)
  );
CREATE POLICY "admin/cashier manage students" ON public.students FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = students.school_id))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = students.school_id))
  );

-- parent_students
CREATE POLICY "parent reads own links" ON public.parent_students FOR SELECT TO authenticated
  USING (
    parent_user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = parent_students.student_id AND (
      public.admin_has_school(auth.uid(), s.school_id)
      OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = s.school_id))
    ))
  );
CREATE POLICY "admin/cashier manage parent links" ON public.parent_students FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = parent_students.student_id AND (
      public.admin_has_school(auth.uid(), s.school_id)
      OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = s.school_id))
    ))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = parent_students.student_id AND (
      public.admin_has_school(auth.uid(), s.school_id)
      OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = s.school_id))
    ))
  );

-- fees
CREATE POLICY "scoped read fees" ON public.fees FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = fees.school_id))
    OR (
      public.has_role(auth.uid(), 'parent') AND (
        (scope = 'STUDENT' AND public.is_parent_of_student(auth.uid(), student_id))
        OR (scope = 'CLASS' AND EXISTS (SELECT 1 FROM public.parent_students ps JOIN public.students s ON s.id = ps.student_id WHERE ps.parent_user_id = auth.uid() AND s.class_id = fees.class_id))
        OR (scope = 'SCHOOL' AND EXISTS (SELECT 1 FROM public.parent_students ps JOIN public.students s ON s.id = ps.student_id WHERE ps.parent_user_id = auth.uid() AND s.school_id = fees.school_id))
      )
    )
  );
CREATE POLICY "admin/cashier manage fees" ON public.fees FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = fees.school_id))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = fees.school_id))
  );

-- payments
CREATE POLICY "scoped read payments" ON public.payments FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = payments.school_id))
    OR public.is_parent_of_student(auth.uid(), student_id)
  );
CREATE POLICY "scoped insert payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = payments.school_id))
    OR public.is_parent_of_student(auth.uid(), student_id)
  );
CREATE POLICY "admin/cashier update payments" ON public.payments FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.admin_has_school(auth.uid(), school_id)
    OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_school_id = payments.school_id))
  );

-- receipts
CREATE POLICY "scoped read receipts" ON public.receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = receipts.payment_id
        AND (
          public.is_super_admin(auth.uid())
          OR public.admin_has_school(auth.uid(), p.school_id)
          OR (public.has_role(auth.uid(), 'cashier') AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.primary_school_id = p.school_id))
          OR public.is_parent_of_student(auth.uid(), p.student_id)
        )
    )
  );
CREATE POLICY "system insert receipts" ON public.receipts FOR INSERT TO authenticated
  WITH CHECK (true);

-- notifications (own only)
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "super admin manages notifications" ON public.notifications FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- notification_preferences (own only)
CREATE POLICY "own prefs all" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- push_tokens (own only)
CREATE POLICY "own push tokens all" ON public.push_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());