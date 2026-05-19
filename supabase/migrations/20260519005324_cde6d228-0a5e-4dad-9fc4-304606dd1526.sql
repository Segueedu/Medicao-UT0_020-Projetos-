-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'financeiro', 'tecnico');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tecnicos
CREATE TABLE public.tecnicos (
  codigo VARCHAR(20) PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  equipe VARCHAR(80),
  especialidade VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tecnicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tecnicos public read" ON public.tecnicos
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "tecnicos finance write" ON public.tecnicos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

-- Apontamentos
CREATE TABLE public.apontamentos (
  id BIGSERIAL PRIMARY KEY,
  numero_os VARCHAR(40),
  tecnico_codigo VARCHAR(20) NOT NULL,
  tecnico_nome VARCHAR(150) NOT NULL,
  especialidade VARCHAR(100),
  equipe VARCHAR(80) NOT NULL,
  tipo_solicitacao VARCHAR(100),
  unidade_negocio VARCHAR(50),
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  horas_decimais NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_hora NUMERIC(10,2) DEFAULT 0,
  valor_mao_obra NUMERIC(12,2) DEFAULT 0,
  mes_ano VARCHAR(7) NOT NULL,
  semana_do_mes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_apont_mes ON public.apontamentos(mes_ano);
CREATE INDEX idx_apont_tecnico ON public.apontamentos(tecnico_codigo);
CREATE INDEX idx_apont_equipe ON public.apontamentos(equipe);

ALTER TABLE public.apontamentos ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas para colunas não sensíveis é feita por convenção no frontend.
-- Política básica: leitura aberta (anon) — campos financeiros são filtrados no client.
CREATE POLICY "apontamentos public read" ON public.apontamentos
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "apontamentos finance insert" ON public.apontamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

CREATE POLICY "apontamentos finance update" ON public.apontamentos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

CREATE POLICY "apontamentos finance delete" ON public.apontamentos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('planilhas', 'planilhas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "planilhas finance read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'planilhas' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')));

CREATE POLICY "planilhas finance upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'planilhas' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')));