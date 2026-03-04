-- ============================================================
-- Migration: Lesson Recap (Recap da Aula)
-- Tabelas: lesson_events, lesson_recaps
-- ============================================================

-- 1. Log de eventos da aula (cada ação relevante)
CREATE TABLE IF NOT EXISTS lesson_events (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES transcription_sessions(id) ON DELETE CASCADE,
    presentation_id INTEGER REFERENCES presentation_sessions(id),
    
    -- Tipo do evento
    event_type VARCHAR(50) NOT NULL,
    -- Valores possíveis:
    --   'transcription_start', 'transcription_end', 'checkpoint',
    --   'quiz_generated', 'quiz_broadcast', 'summary_generated', 'summary_shared',
    --   'open_question_created', 'content_displayed', 'content_cleared',
    --   'document_shared', 'audio_generated', 'presentation_ended'
    
    -- Dados do evento (JSON flexível)
    event_data JSONB DEFAULT '{}',
    
    -- Referência opcional à atividade
    activity_id INTEGER REFERENCES live_activities(id) ON DELETE SET NULL,
    
    -- Quem disparou o evento
    triggered_by INTEGER REFERENCES users(id),
    
    occurred_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_events_session ON lesson_events(session_id);
CREATE INDEX IF NOT EXISTS idx_lesson_events_type ON lesson_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lesson_events_occurred ON lesson_events(occurred_at);


-- 2. Recap consolidado da aula
CREATE TABLE IF NOT EXISTS lesson_recaps (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL UNIQUE REFERENCES transcription_sessions(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    
    -- Título gerado (ex: "Aula sobre Leis de Newton - 04/03/2026")
    title VARCHAR(300) NOT NULL,
    
    -- Resumo narrativo gerado por IA
    ai_summary TEXT,
    
    -- Dados estruturados do recap (JSON)
    recap_data JSONB NOT NULL DEFAULT '{}',
    
    -- Status: 'generating', 'ready', 'error'
    status VARCHAR(20) DEFAULT 'generating',
    
    -- Compartilhamento
    shared_with_students BOOLEAN DEFAULT FALSE,
    shared_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_recaps_subject ON lesson_recaps(subject_id);
CREATE INDEX IF NOT EXISTS idx_lesson_recaps_teacher ON lesson_recaps(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_recaps_status ON lesson_recaps(status);
