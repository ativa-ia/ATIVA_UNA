import sys
import os
import traceback

sys.path.append(os.getcwd())

from app import create_app, db
from app.models.user import User

app = create_app()

with app.app_context():
    print("Tentando criar usuário de teste...")
    try:
        if User.find_by_email('test@debug.com'):
            print("Usuário já existe. Deletando...")
            u = User.find_by_email('test@debug.com')
            db.session.delete(u)
            db.session.commit()
            
        print("Criando novo usuário...")
        user = User.create_user(
            email='test@debug.com',
            password='password123',
            role='student',
            name='Debug User'
        )
        print(f"Usuário criado com sucesso: {user.id}")
        
    except Exception as e:
        print(f"ERRO FATAL: {e}")
        traceback.print_exc()
