-- Migration: Add file_url and file_path to ai_context_files
-- Date: 2026-02-04

ALTER TABLE ai_context_files 
ADD COLUMN file_url VARCHAR(500),
ADD COLUMN file_path VARCHAR(500);

-- Add comment
COMMENT ON COLUMN ai_context_files.file_url IS 'URL do arquivo original no Supabase Storage';
COMMENT ON COLUMN ai_context_files.file_path IS 'Path do arquivo no Storage';
