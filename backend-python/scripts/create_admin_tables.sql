-- ============================================================
-- ATIVA IA - Super Admin Infrastructure
-- Script para criar tabelas administrativas no Supabase
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- 1. Tabela de administradores da plataforma (desenvolvedores)
-- Completamente separada da tabela 'users' (alunos/professores/admins escola)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Índice para buscas rápidas por email no login
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- 2. Tabela de auditoria (registro de todas as ações do Super Admin)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,          -- Ex: 'DELETE_USER', 'UPDATE_SETTING', 'APPROVE_PROFESSOR'
    target_type VARCHAR(50),               -- Ex: 'users', 'subjects', 'system_settings'
    target_id VARCHAR(50),                 -- ID do registro afetado (string para flexibilidade)
    old_data JSONB,                        -- Snapshot do dado antes da alteração
    new_data JSONB,                        -- Snapshot do dado após a alteração
    ip_address VARCHAR(45),                -- IPv4 ou IPv6
    user_agent TEXT,                       -- Browser/client info
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas no painel de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user ON audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 3. Row Level Security (RLS)
-- Garante que mesmo via Supabase client, ninguém leia admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Apenas o service_role (backend Flask) pode acessar essas tabelas
-- Usuários anon e authenticated do Supabase NÃO terão acesso
CREATE POLICY "Service role only - admin_users" ON admin_users
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role only - audit_logs" ON audit_logs
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- IMPORTANTE: Após rodar o script acima, rode o INSERT abaixo 
-- trocando os valores pelo seu nome, email e senha hashada.
-- 
-- Para gerar o hash da senha, rode no terminal Python:
--   import bcrypt
--   bcrypt.hashpw('SUA_SENHA_AQUI'.encode(), bcrypt.gensalt()).decode()
--
-- Exemplo (TROCAR os dados!):
-- INSERT INTO admin_users (name, email, password_hash) VALUES
--   ('Seu Nome', 'seu@email.com', '$2b$12$HASH_GERADO_AQUI');
-- ============================================================
