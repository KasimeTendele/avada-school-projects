
-- Table principale des demandes de démo
CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL,
  school_type text NOT NULL,
  city text NOT NULL,
  student_count integer NOT NULL CHECK (student_count > 0),
  contact_name text NOT NULL,
  contact_role text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  problems jsonb NOT NULL DEFAULT '[]'::jsonb,
  other_problem text,
  has_existing_system boolean NOT NULL DEFAULT false,
  existing_system_name text,
  preferred_date date NOT NULL,
  preferred_time text NOT NULL,
  demo_mode text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.demo_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_requests TO authenticated;
GRANT ALL ON public.demo_requests TO service_role;

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Insertion publique (anonyme) autorisée pour soumettre le formulaire
CREATE POLICY "Anyone can submit a demo request"
ON public.demo_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Seuls les super_admin peuvent lire / mettre à jour
CREATE POLICY "Super admin reads demo requests"
ON public.demo_requests FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin updates demo requests"
ON public.demo_requests FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER demo_requests_updated_at
BEFORE UPDATE ON public.demo_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table de configuration publique (single row)
CREATE TABLE public.demo_request_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  page jsonb NOT NULL DEFAULT '{}'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  testimonials jsonb NOT NULL DEFAULT '[]'::jsonb,
  trusted_schools jsonb NOT NULL DEFAULT '[]'::jsonb,
  form_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.demo_request_config TO anon, authenticated;
GRANT ALL ON public.demo_request_config TO service_role;
GRANT UPDATE ON public.demo_request_config TO authenticated;

ALTER TABLE public.demo_request_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read demo config"
ON public.demo_request_config FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Super admin updates demo config"
ON public.demo_request_config FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER demo_request_config_updated_at
BEFORE UPDATE ON public.demo_request_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Valeurs par défaut
INSERT INTO public.demo_request_config (id, page, features, testimonials, trusted_schools, form_options)
VALUES (
  1,
  '{
    "badge": "Démonstration personnalisée",
    "title": "Découvrez AvadaSchool en action 👋",
    "subtitle": "Planifiez une démonstration personnalisée et découvrez comment digitaliser la gestion de votre école.",
    "response_sla": "Réponse garantie en moins de 24h"
  }'::jsonb,
  '[
    {"title": "30 minutes chrono", "description": "Une démonstration courte et efficace, adaptée à vos besoins."},
    {"title": "100% personnalisée", "description": "Nous présentons les fonctionnalités pertinentes pour votre école."},
    {"title": "Sans engagement", "description": "Découvrez la plateforme sans aucune obligation."}
  ]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{
    "school_types": ["Maternelle", "Primaire", "Secondaire", "Mixte (Maternelle → Secondaire)"],
    "contact_roles": ["Directeur / Directrice", "Promoteur / Promotrice", "Gestionnaire", "Responsable financier"],
    "problem_options": ["Gestion des frais scolaires", "Retards de paiement", "Communication avec les parents", "Suivi des élèves", "Reporting et statistiques", "Autre (précisez)"],
    "demo_modes": ["Visioconférence", "En présentiel", "Appel téléphonique"]
  }'::jsonb
);
