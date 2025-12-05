import sys
import os

# Adicionar diretório pai ao path para importar app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from sqlalchemy import text

def init_remote_db():
    print("🚀 Inicializando banco de dados remoto...")
    
    # Forçar ambiente de produção para usar a DATABASE_URL do .env
    os.environ['FLASK_ENV'] = 'production'
    
    app = create_app('production')
    
    with app.app_context():
        try:
            # Testar conexão
            print(f"📡 Conectando em: {app.config['SQLALCHEMY_DATABASE_URI']}")
            db.session.execute(text('SELECT 1'))
            print("✅ Conexão bem sucedida!")
            
            # Criar tabelas
            print("🛠️ Criando tabelas...")
            db.create_all()
            print("✅ Tabelas criadas com sucesso!")
            
            # Verificar se criou
            result = db.session.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
            tables = [row[0] for row in result]
            print(f"📊 Tabelas encontradas: {tables}")
            
        except Exception as e:
            print(f"❌ Erro: {e}")

if __name__ == "__main__":
    init_remote_db()
