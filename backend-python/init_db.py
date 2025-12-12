
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from app import create_app, db
from app.models.ai_session import AIContextFile

app = create_app()

with app.app_context():
    print("Database URI:", app.config['SQLALCHEMY_DATABASE_URI'])
    print("Criando tabelas...")
    try:
        db.create_all()
        print("Tabelas criadas com sucesso!")
    except Exception as e:
        print(f"Erro ao criar tabelas: {e}")
