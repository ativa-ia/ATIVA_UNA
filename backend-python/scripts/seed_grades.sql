-- ============================================
-- SCRIPT SQL PARA POPULAR NOTAS DE TESTE
-- Execute no Supabase SQL Editor
-- ============================================

-- IMPORTANTE: Ajuste os IDs conforme seu banco de dados
-- Este script assume que você tem:
-- - Pelo menos 1 professor (users.role = 'teacher')
-- - Pelo menos 1 disciplina (subjects)
-- - Alunos matriculados (enrollments)

-- ============================================
-- PARTE 1: Verificar dados existentes
-- ============================================
-- Execute primeiro para ver os IDs disponíveis:

SELECT id, name, role FROM users WHERE role = 'teacher' LIMIT 1;
SELECT id, name FROM subjects LIMIT 5;
SELECT e.student_id, u.name as student_name, e.subject_id, s.name as subject_name 
FROM enrollments e 
JOIN users u ON e.student_id = u.id 
JOIN subjects s ON e.subject_id = s.id 
LIMIT 10;


-- ============================================
-- PARTE 2: Popular notas (EXEMPLO)
-- ============================================
-- ATENÇÃO: Substitua os valores abaixo pelos IDs reais do seu banco!
-- Este é apenas um EXEMPLO com IDs fictícios

-- Exemplo: Assumindo professor_id = 1, subject_id = 1
-- E alunos com IDs de 2 a 10

-- Função para gerar nota aleatória realista
-- 70% entre 6.0-9.0, 20% entre 3.0-6.0, 10% entre 9.0-10.0

-- AV1 - Notas para alunos na disciplina 1
INSERT INTO grades (student_id, subject_id, assessment_type, grade, created_by)
SELECT 
    e.student_id,
    e.subject_id,
    'av1',
    CASE 
        WHEN random() < 0.7 THEN 6.0 + random() * 3.0  -- 70%: 6.0-9.0
        WHEN random() < 0.9 THEN 3.0 + random() * 3.0  -- 20%: 3.0-6.0
        ELSE 9.0 + random() * 1.0                      -- 10%: 9.0-10.0
    END,
    (SELECT id FROM users WHERE role = 'teacher' LIMIT 1)
FROM enrollments e
WHERE e.subject_id IN (SELECT id FROM subjects)
ON CONFLICT (student_id, subject_id, assessment_type) DO NOTHING;

-- AV2 - Notas para alunos na disciplina 1
INSERT INTO grades (student_id, subject_id, assessment_type, grade, created_by)
SELECT 
    e.student_id,
    e.subject_id,
    'av2',
    CASE 
        WHEN random() < 0.7 THEN 6.0 + random() * 3.0  -- 70%: 6.0-9.0
        WHEN random() < 0.9 THEN 3.0 + random() * 3.0  -- 20%: 3.0-6.0
        ELSE 9.0 + random() * 1.0                      -- 10%: 9.0-10.0
    END,
    (SELECT id FROM users WHERE role = 'teacher' LIMIT 1)
FROM enrollments e
WHERE e.subject_id IN (SELECT id FROM subjects)
ON CONFLICT (student_id, subject_id, assessment_type) DO NOTHING;


-- ============================================
-- PARTE 3: Verificar notas criadas
-- ============================================
-- Execute para ver as notas criadas:

SELECT 
    g.id,
    u.name as student_name,
    s.name as subject_name,
    g.assessment_type,
    ROUND(g.grade::numeric, 1) as grade,
    t.name as created_by_teacher
FROM grades g
JOIN users u ON g.student_id = u.id
JOIN subjects s ON g.subject_id = s.id
JOIN users t ON g.created_by = t.id
ORDER BY s.name, u.name, g.assessment_type;

-- Ver estatísticas por disciplina:
SELECT 
    s.name as subject,
    g.assessment_type,
    COUNT(*) as total_grades,
    ROUND(AVG(g.grade)::numeric, 2) as average,
    ROUND(MIN(g.grade)::numeric, 1) as min_grade,
    ROUND(MAX(g.grade)::numeric, 1) as max_grade
FROM grades g
JOIN subjects s ON g.subject_id = s.id
GROUP BY s.name, g.assessment_type
ORDER BY s.name, g.assessment_type;


-- ============================================
-- ALTERNATIVA: Popular com notas específicas
-- ============================================
-- Se preferir controlar as notas manualmente, use este formato:
-- (Substitua os IDs pelos valores reais)

/*
INSERT INTO grades (student_id, subject_id, assessment_type, grade, created_by) VALUES
-- Disciplina 1, Aluno 2
(2, 1, 'av1', 8.5, 1),
(2, 1, 'av2', 7.0, 1),
-- Disciplina 1, Aluno 3
(3, 1, 'av1', 9.0, 1),
(3, 1, 'av2', 8.5, 1),
-- Disciplina 1, Aluno 4
(4, 1, 'av1', 6.5, 1),
(4, 1, 'av2', 7.5, 1)
ON CONFLICT (student_id, subject_id, assessment_type) DO NOTHING;
*/


-- ============================================
-- LIMPEZA (se necessário)
-- ============================================
-- Para deletar todas as notas e recomeçar:
-- DELETE FROM grades;
