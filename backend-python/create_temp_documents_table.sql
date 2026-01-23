-- Tabela para armazenar documentos temporariamente
-- Evita passar conteúdo gigante pelo orquestrador
CREATE TABLE IF NOT EXISTS temp_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id TEXT NOT NULL,
  filename TEXT,
  document_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para busca rápida por classroom_id
CREATE INDEX IF NOT EXISTS idx_temp_documents_classroom 
ON temp_documents(classroom_id);

-- Índice para busca por data (para limpeza automática)
CREATE INDEX IF NOT EXISTS idx_temp_documents_created 
ON temp_documents(created_at);

-- Função para limpar documentos antigos (mais de 24h)
CREATE OR REPLACE FUNCTION cleanup_old_temp_documents()
RETURNS void AS $$
BEGIN
  DELETE FROM temp_documents 
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TABLE temp_documents IS 'Armazena documentos temporariamente para evitar tráfego excessivo de dados';
COMMENT ON COLUMN temp_documents.id IS 'ID único do documento temporário';
COMMENT ON COLUMN temp_documents.classroom_id IS 'ID da sala/disciplina';
COMMENT ON COLUMN temp_documents.filename IS 'Nome do arquivo original';
COMMENT ON COLUMN temp_documents.document_data IS 'Dados completos do documento (seções, chunks, etc)';
