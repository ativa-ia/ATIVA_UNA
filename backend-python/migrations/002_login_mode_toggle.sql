-- =============================================================
-- MIGRAÇÃO: Seção 2 - Alternância de Sistema de Login
-- Data: 2026-02-25
-- Descrição: Adiciona campos de matrícula e curso ao usuário,
--            e insere configuração de modo de login.
-- =============================================================

-- 1. Adicionar coluna 'registration_number' (matrícula) à tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50) UNIQUE;

-- 2. Adicionar coluna 'course_id' (curso) à tabela users com FK para courses
ALTER TABLE users ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id);

-- 3. Inserir configuração DEFAULT_LOGIN_MODE (modo de login padrão)
--    Valores possíveis: 'quick_access' ou 'traditional'
--    is_public = true para que o frontend consulte sem auth
INSERT INTO system_settings (key, value, description, is_public)
VALUES ('DEFAULT_LOGIN_MODE', 'quick_access', 'Modo de login padrão: quick_access ou traditional', true)
ON CONFLICT (key) DO NOTHING;
