import os
import sys
from sqlalchemy import create_engine, MetaData, Table, select
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from app import create_app, db

# Carregar variáveis de ambiente
load_dotenv()

# URL de conexão do destino (Supabase - Transaction Pooler)
TARGET_DB_URL = "postgresql://postgres.gktqtgswqtjfsihvgbmu:101519517_161211215JP@aws-1-us-east-2.pooler.supabase.com:6543/postgres"

def migrate_database():
    print("=" * 60)
    print("🚀 INICIANDO MIGRAÇÃO PARA SUPABASE")
    print("=" * 60)
    
    # 1. Configurar Origem (usando a app atual)
    app = create_app()
    
    # 2. Configurar Destino
    print(f"📡 Conectando ao banco de destino...")
    target_engine = create_engine(TARGET_DB_URL)
    TargetSession = sessionmaker(bind=target_engine)
    target_session = TargetSession()
    
    # Ordem das tabelas para respeitar Foreign Keys
    ordered_tables = [
        'users',
        'subjects',
        'courses',
        'classes',
        'teachings',
        'enrollments',
        'transcription_sessions',
        'transcription_checkpoints',
        'live_activities',
        'live_activity_responses',
        'ai_sessions',
        'ai_messages',
        'ai_context_files'
    ]
    
    with app.app_context():
        # Obter metadata da origem
        metadata = db.metadata
        
        # 3. Criar tabelas no destino
        print("\n🏗️  Criando estrutura das tabelas no destino...")
        # Drop all tables in target to ensure clean state (optional, but safer for clone)
        # metadata.drop_all(bind=target_engine) 
        # Vamos criar apenas se não existirem
        metadata.create_all(bind=target_engine)
        print("✅ Estrutura criada!")
        
        # 4. Migrar dados tabela por tabela
        print("\n📦 Migrando dados...")
        
        for table_name in ordered_tables:
            if table_name not in metadata.tables:
                continue
                
            table = metadata.tables[table_name]
            print(f"  ➡️  Processando tabela: {table_name}")
            
            # Ler dados da origem
            # Usando connection direta
            with db.engine.connect() as source_conn:
                rows = source_conn.execute(table.select()).fetchall()
                
            if not rows:
                print(f"      To empty, skipping.")
                continue
                
            print(f"      Encontrados {len(rows)} registros.")
            
            # Limpar tabela no destino antes de inserir (para evitar duplicatas se rodar 2x)
            # CUIDADO: Isso deve ser feito na ordem inversa se tiver FKs, ou usar CASCADE.
            # Como estamos fazendo inserção 'inteligente', vamos verificar se já existe ou limpar tudo.
            # Para um clone 'identico', o ideal é o destino estar vazio.
            # Vou assumir que o destino está vazio ou limpar tabela por tabela na ordem?
            # Se limpar na ordem de criação, vai dar erro de FK.
            # Vou apenas tentar inserir, se der conflito de ID, ignora ou avisa.
            
            try:
                # Converter linhas para dicionários
                data_to_insert = [dict(row._mapping) for row in rows]
                
                # Inserir no destino
                # Usando core insert para ser mais rápido e ignorar validações de modelo do ORM
                with target_engine.begin() as target_conn:
                    # Verificar se tabela tem dados
                    existing_count = target_conn.execute(select(table)).rowcount
                    if existing_count > 0:
                         print(f"      ⚠️  Tabela {table_name} já tem dados no destino. Pulando inserção em massa.")
                         # Aqui poderia fazer um upsert, mas é complexo. 
                         # Se o usuário disse "banco vazio", vou assumir vazio.
                         # Se der erro de duplicate key, vai falhar a transação.
                    else:
                        target_conn.execute(table.insert(), data_to_insert)
                        print(f"      ✅ Inseridos {len(data_to_insert)} registros.")
                        
            except Exception as e:
                print(f"      ❌ Erro ao migrar {table_name}: {e}")
                # Não parar tudo, tentar próxima (mas provavelmente vai falhar nas dependentes)
        
        # Ajustar sequências (IDs automáticos) no Postgres
        print("\n🔧 Ajustando sequências de ID...")
        for table_name in ordered_tables:
            if table_name not in metadata.tables:
                continue
            
            try:
                with target_engine.begin() as conn:
                    # Resetar a sequência para o MAX(id) + 1
                    sql = f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE(MAX(id), 1) ) FROM {table_name};"
                    conn.execute(db.text(sql))
                    print(f"  ✅ Sequência ajustada para {table_name}")
            except Exception as e:
                # Algumas tabelas podem não ter coluna ID ou sequence, ignorar
                pass

    print("\n" + "=" * 60)
    print("✅ MIGRAÇÃO CONCLUÍDA!")
    print("=" * 60)

if __name__ == "__main__":
    migrate_database()
