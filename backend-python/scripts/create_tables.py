"""
Script para criar tabelas no banco de dados
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db

def create_tables():
    """Criar todas as tabelas no banco"""
    app = create_app()
    with app.app_context():
        print("🔨 Criando tabelas no banco de dados...")
        
        try:
            # Importar todos os modelos para garantir que sejam registrados
            from app.models import (
                User, Course, Class, Subject, Enrollment, Teaching,
                Material, Activity, Announcement, AISession, AIMessage,
                Quiz, QuizQuestion, QuizResponse, ChatMessage,
                Grade, ActivitySubmission
            )
            
            # Criar todas as tabelas
            db.create_all()
            
            print("✅ Tabelas criadas com sucesso!")
            print("\nTabelas criadas:")
            print("  - users")
            print("  - courses")
            print("  - classes")
            print("  - subjects")
            print("  - enrollments")
            print("  - teachings")
            print("  - materials")
            print("  - activities")
            print("  - announcements")
            print("  - ai_sessions")
            print("  - ai_messages")
            print("  - quizzes")
            print("  - quiz_questions")
            print("  - quiz_responses")
            print("  - chat_messages")
            print("  - grades ⭐ (NOVA)")
            print("  - activity_submissions ⭐ (NOVA)")
            
        except Exception as e:
            print(f"❌ Erro ao criar tabelas: {str(e)}")
            import traceback
            print(traceback.format_exc())

if __name__ == '__main__':
    create_tables()
