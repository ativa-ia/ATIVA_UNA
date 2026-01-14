"""
Criar tabela presentation_sessions

Migration para adicionar suporte a apresentações/transmissões
"""

CREATE_PRESENTATION_SESSIONS_TABLE = """
CREATE TABLE IF NOT EXISTS presentation_sessions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(6) UNIQUE NOT NULL,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    current_content JSONB DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_presentation_code ON presentation_sessions(code);
CREATE INDEX IF NOT EXISTS idx_presentation_teacher_status ON presentation_sessions(teacher_id, status);
"""

if __name__ == '__main__':
    import psycopg2
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    if not DATABASE_URL:
        print("❌ DATABASE_URL não encontrada no .env")
        exit(1)
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("📊 Criando tabela presentation_sessions...")
        cursor.execute(CREATE_PRESENTATION_SESSIONS_TABLE)
        
        conn.commit()
        print("✅ Tabela presentation_sessions criada com sucesso!")
        
        # Verificar se foi criada
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'presentation_sessions'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        print("\n📋 Colunas criadas:")
        for col in columns:
            print(f"  - {col[0]}: {col[1]}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Erro ao criar tabela: {e}")
        exit(1)
