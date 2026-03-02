-- Seed: Modo de Manutenção
-- Execute este script no banco de dados para adicionar a configuração inicial.
-- O backoffice irá controlar o valor via toggle na página de Configurações.

INSERT INTO system_settings (key, value, description, is_public)
VALUES (
    'MAINTENANCE_MODE',
    'false',
    'Ativa ou desativa o modo de manutenção para alunos e professores no app mobile. Valores: true | false',
    false
)
ON CONFLICT (key) DO NOTHING;
