
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from app import create_app, db
# Importar modelos explicitamente para garantir registro
from app.models.user import User
from app.models.subject import Subject
from app.models.course import Course
from app.models.class_model import Class
from app.models.teaching import Teaching
from app.models.enrollment import Enrollment
from app.models.transcription_session import TranscriptionSession, LiveActivity
from app.models.ai_session import AISession

app = create_app()

with app.app_context():
    print("Database URI:", app.config['SQLALCHEMY_DATABASE_URI'])
    print("Criando tabelas...")
    try:
        db.create_all()
        print("Tabelas criadas com sucesso!")
    except Exception as e:
        print(f"Erro ao criar tabelas: {e}")
