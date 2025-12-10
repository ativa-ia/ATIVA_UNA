-- ============================================
-- SCRIPT SQL PARA CRIAR TABELAS NO SUPABASE
-- Sistema de Monitoramento de Desempenho
-- ============================================

-- Tabela: grades (Notas AV1 e AV2)
-- ============================================
CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    assessment_type VARCHAR(10) NOT NULL CHECK (assessment_type IN ('av1', 'av2')),
    grade FLOAT NOT NULL CHECK (grade >= 0 AND grade <= 10),
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint única: um aluno só pode ter uma nota por tipo de avaliação por disciplina
    UNIQUE(student_id, subject_id, assessment_type)
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_grades_assessment ON grades(assessment_type);

-- Comentários
COMMENT ON TABLE grades IS 'Armazena notas de avaliações (AV1, AV2) dos alunos';
COMMENT ON COLUMN grades.assessment_type IS 'Tipo de avaliação: av1 ou av2';
COMMENT ON COLUMN grades.grade IS 'Nota de 0 a 10';
COMMENT ON COLUMN grades.created_by IS 'ID do professor que lançou a nota';


-- Tabela: activity_submissions (Submissões de Atividades)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_submissions (
    id SERIAL PRIMARY KEY,
    activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'graded')),
    grade FLOAT CHECK (grade IS NULL OR (grade >= 0 AND grade <= 10)),
    submitted_at TIMESTAMP,
    graded_at TIMESTAMP,
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint única: um aluno só pode ter uma submissão por atividade
    UNIQUE(activity_id, student_id)
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_activity_submissions_activity ON activity_submissions(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_submissions_student ON activity_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_submissions_status ON activity_submissions(status);

-- Comentários
COMMENT ON TABLE activity_submissions IS 'Armazena submissões de atividades dos alunos';
COMMENT ON COLUMN activity_submissions.status IS 'Status: pending, submitted ou graded';
COMMENT ON COLUMN activity_submissions.grade IS 'Nota da atividade (0-10), NULL se não avaliada';


-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Execute estas queries para verificar se as tabelas foram criadas:

-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name IN ('grades', 'activity_submissions');

-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'grades' ORDER BY ordinal_position;

-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'activity_submissions' ORDER BY ordinal_position;
