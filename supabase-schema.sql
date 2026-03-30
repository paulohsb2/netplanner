-- =============================================
-- NetPlanner — Schema Supabase
-- Execute no SQL Editor: supabase.com → SQL Editor
-- =============================================

-- Tabela de perfis de usuário (complementa auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','basic','pro','enterprise')),
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  subscription_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de projetos
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Novo Projeto',
  data JSONB NOT NULL DEFAULT '{}',
  thumbnail TEXT, -- base64 da miniatura (futuro)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects(updated_at DESC);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Políticas RLS — perfis
CREATE POLICY "Usuário vê seu perfil" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuário atualiza seu perfil" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Políticas RLS — projetos (CRUD completo)
CREATE POLICY "Usuário vê seus projetos" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuário cria projetos" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza seus projetos" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuário deleta seus projetos" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger: criar perfil automaticamente ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: updated_at automático em projetos
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_projects_updated_at ON projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
