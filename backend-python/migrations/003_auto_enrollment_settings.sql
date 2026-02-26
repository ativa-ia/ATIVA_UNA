-- =============================================================
-- MIGRAÇÃO: Seção 3 - Controle de Auto-Matrícula
-- Data: 2026-02-26
-- Descrição: Insere configurações para habilitar/desabilitar
--            auto-matrícula e selecionar disciplinas.
-- =============================================================

-- 1. Toggle para ativar/desativar auto-matrícula
--    Valores: 'true' ou 'false'
INSERT INTO system_settings (key, value, description, is_public)
VALUES ('ENABLE_AUTO_ENROLLMENT', 'true', 'Ativar/Desativar auto-matrícula de novos alunos', false)
ON CONFLICT (key) DO NOTHING;

-- 2. Lista de disciplinas para auto-matrícula
--    Valores: 'all' (todas) ou JSON array de IDs ex: [1, 3, 5]
INSERT INTO system_settings (key, value, description, is_public)
VALUES ('AUTO_ENROLLMENT_SUBJECTS', 'all', 'Disciplinas para auto-matrícula: all ou JSON array de IDs', false)
ON CONFLICT (key) DO NOTHING;
