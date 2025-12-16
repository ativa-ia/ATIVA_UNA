-- Migração Supabase: Adicionar campos de suporte personalizado
-- Execute no SQL Editor do Supabase

ALTER TABLE live_activities 
ADD COLUMN IF NOT EXISTS target_students JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_support_content BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parent_activity_id INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_live_activities_support 
ON live_activities(is_support_content) 
WHERE is_support_content = TRUE;

ALTER TABLE live_activities 
ADD CONSTRAINT fk_parent_activity 
FOREIGN KEY (parent_activity_id) 
REFERENCES live_activities(id) 
ON DELETE SET NULL;
